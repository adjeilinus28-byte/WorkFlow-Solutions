// site-admin — adds a person who has no login yet (admins only).
//
//   { "email", "role": "admin"|"editor"|"sales", "mode": "invite" }
//       Supabase emails them a link to set their password.
//   { "email", "role", "mode": "password" }
//       Creates the login with a one-time password, returned once, for the
//       admin to pass on (for when invite emails aren't set up).
//
// New logins are marked role "website" in the ops platform's profiles, which
// gives them no access there. People who already have a login are added by the
// site_user_add_existing database function instead; this function falls back
// to that when the email is already registered.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { env, json, originAllowed, preflight } from '../_shared/http.ts'

const ROLES = ['admin', 'editor', 'sales']
const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i

function tempPassword(): string {
  // 16 characters from an alphabet without look-alikes (no 0/O, 1/l/I)
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return [...bytes].map((b) => abc[b % abc.length]).join('')
}

Deno.serve(async (req) => {
  const early = preflight(req)
  if (early) return early
  const auth = req.headers.get('authorization')
  if (!auth) return json(req, 401, { error: 'Sign in first' })

  const asUser = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: me, error: meErr } = await asUser.rpc('site_me')
  if (meErr || me?.role !== 'admin') return json(req, 403, { error: 'Only admins can add people' })

  const body = await req.json().catch(() => ({}))
  const email = String(body.email || '').trim().toLowerCase()
  const role = String(body.role || '')
  const mode = body.mode === 'password' ? 'password' : 'invite'
  if (!EMAIL_RE.test(email)) return json(req, 400, { error: 'Enter a valid email address' })
  if (!ROLES.includes(role)) return json(req, 400, { error: 'Choose a role' })

  const service = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })
  const meta = { role: 'website', full_name: String(body.full_name || '').trim().slice(0, 80) || undefined }
  let userId: string | null = null
  let password: string | null = null

  if (mode === 'invite') {
    // Back to the admin they were invited from — only ever one of the site's own addresses
    const origin = req.headers.get('origin')
    const redirectTo = `${originAllowed(origin) ? origin : 'https://workflow-app.net'}/admin/`
    const { data, error } = await service.auth.admin.inviteUserByEmail(email, { data: meta, redirectTo })
    if (error && !/already been registered|already registered|exists/i.test(error.message)) {
      return json(req, 400, { error: `Couldn't send the invite: ${error.message}. Try "Set a password" instead.` })
    }
    userId = data?.user?.id ?? null
  } else {
    password = tempPassword()
    const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: meta })
    if (error && !/already been registered|already registered|exists/i.test(error.message)) {
      return json(req, 400, { error: `Couldn't create the login: ${error.message}` })
    }
    userId = data?.user?.id ?? null
    if (!userId) password = null   // they already had a login; their password is unchanged
  }

  // Already registered: give the existing login access instead
  if (!userId) {
    const { data: added, error } = await asUser.rpc('site_user_add_existing', { p_email: email, p_role: role })
    if (error) return json(req, 400, { error: error.message })
    if (!added) return json(req, 400, { error: 'That email is registered but could not be found. Try again.' })
    return json(req, 200, { email, role, existing: true })
  }

  const { error: addErr } = await service.from('site_users').upsert({ user_id: userId, role, created_by: me.user_id })
  if (addErr) return json(req, 500, { error: `The login was created but access wasn't granted: ${addErr.message}` })
  await service.from('site_activity').insert({
    user_id: me.user_id, user_email: me.email, action: 'user.add', detail: { email, role, mode },
  })
  return json(req, 200, { email, role, invited: mode === 'invite', password })
})
