// site-lead — receives the workflow-app.net contact form.
//
// Public (no login): saves the message to site_leads and emails an alert.
// Defences: only the site's own pages may post (Origin check), a hidden
// honeypot field, length limits, and at most 5 messages per 10 minutes from
// one address (stored only as a salted hash).
//
// Secrets (Supabase → Edge Functions → Secrets), all optional:
//   BREVO_API_KEY      sends the alert email; without it leads are still saved
//   LEAD_ALERT_EMAIL   who gets the alert   (default admin@workflow-app.net)
//   LEAD_ALERT_FROM    a verified Brevo sender (default admin@workflow-app.net)
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { env, json, originAllowed, preflight } from '../_shared/http.ts'

const LIMITS: Record<string, number> = {
  'first-name': 80, 'last-name': 80, email: 200, organisation: 160, 'inquiry-type': 60, message: 5000,
}
const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i
const PER_WINDOW = 5
const WINDOW_MINUTES = 10

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function readFields(req: Request): Promise<Record<string, string>> {
  const type = req.headers.get('content-type') || ''
  if (type.includes('application/json')) {
    const body = await req.json()
    return Object.fromEntries(Object.entries(body ?? {}).map(([k, v]) => [k, typeof v === 'string' ? v : '']))
  }
  return Object.fromEntries(new URLSearchParams(await req.text()))
}

async function sendAlert(lead: Record<string, string>) {
  const key = env('BREVO_API_KEY')
  if (!key) return
  const to = env('LEAD_ALERT_EMAIL', 'admin@workflow-app.net')
  const from = env('LEAD_ALERT_FROM', 'admin@workflow-app.net')
  const name = `${lead.first_name} ${lead.last_name}`
  const lines = [
    `${name} sent a message from the website.`,
    '',
    `Email: ${lead.email}`,
    lead.organisation ? `Organisation: ${lead.organisation}` : '',
    lead.inquiry_type ? `Needs: ${lead.inquiry_type}` : '',
    '',
    lead.message,
    '',
    'Reply to this email to answer them, or open the leads inbox:',
    'https://workflow-app.net/admin/leads',
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '')
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': key, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'WorkFlow Solutions website', email: from },
      to: [{ email: to }],
      replyTo: { email: lead.email, name },
      subject: `New enquiry${lead.inquiry_type ? `: ${lead.inquiry_type}` : ''} — ${name}`,
      textContent: lines.join('\n'),
    }),
  })
  if (!res.ok) console.error('Lead alert email failed', res.status, await res.text())
}

Deno.serve(async (req) => {
  const early = preflight(req)
  if (early) return early
  if (!originAllowed(req.headers.get('origin'))) return json(req, 403, { error: 'Not allowed from this site' })

  let f: Record<string, string>
  try {
    f = await readFields(req)
  } catch {
    return json(req, 400, { error: 'Could not read the form' })
  }
  // Bots fill in the hidden field; tell them it worked and keep nothing
  if ((f['bot-field'] || '').trim()) return json(req, 200, { ok: true })

  const v = (k: string) => (f[k] || '').trim()
  const problems: string[] = []
  for (const k of ['first-name', 'last-name', 'email', 'message']) if (!v(k)) problems.push(`${k} is required`)
  for (const [k, max] of Object.entries(LIMITS)) if (v(k).length > max) problems.push(`${k} is too long`)
  if (v('email') && !EMAIL_RE.test(v('email'))) problems.push('email is not valid')
  if (problems.length) return json(req, 400, { error: 'Please check the form', problems })

  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('cf-connecting-ip') || 'unknown'
  const ipHash = (await sha256(`${ip}|${env('SUPABASE_SERVICE_ROLE_KEY')}`)).slice(0, 32)

  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString()
  const { count, error: countErr } = await db.from('site_leads').select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash).gte('created_at', since)
  if (countErr) {
    console.error('Rate check failed', countErr)
    return json(req, 500, { error: 'Could not save your message' })
  }
  if ((count ?? 0) >= PER_WINDOW) return json(req, 429, { error: 'Too many messages — please try again in a few minutes' })

  const lead = {
    first_name: v('first-name'), last_name: v('last-name'), email: v('email'),
    organisation: v('organisation') || null, inquiry_type: v('inquiry-type') || null, message: v('message'),
    source: (req.headers.get('referer') || '').slice(0, 300) || null, ip_hash: ipHash,
  }
  const { error } = await db.from('site_leads').insert(lead)
  if (error) {
    console.error('Lead insert failed', error)
    return json(req, 500, { error: 'Could not save your message' })
  }
  try {
    await sendAlert(lead as unknown as Record<string, string>)
  } catch (err) {
    console.error('Lead alert email failed', err)
  }
  return json(req, 200, { ok: true })
})
