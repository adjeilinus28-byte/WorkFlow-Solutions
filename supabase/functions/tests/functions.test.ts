// Behaviour tests for the edge functions, with Supabase, Brevo and Netlify
// replaced by an in-memory fake (no network needed).
//   deno test --allow-env --allow-read supabase/functions/tests/
import { assert, assertEquals, assertMatch } from 'jsr:@std/assert@1'
import defaults from '../_shared/defaults.json' with { type: 'json' }

const SB = 'https://fake.supabase.co'
Deno.env.set('SUPABASE_URL', SB)
Deno.env.set('SUPABASE_ANON_KEY', 'anon-key')
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-key')

type Call = { method: string; path: string; search: URLSearchParams; body: any; headers: Headers }
const world = {
  calls: [] as Call[],
  rpc: {} as Record<string, (args: any, auth: string) => { status?: number; body: unknown }>,
  leadCount: 0,
  authUsers: new Set<string>(),
  reset() { this.calls = []; this.rpc = {}; this.leadCount = 0; this.authUsers = new Set() },
  find(method: string, path: string) { return this.calls.filter((c) => c.method === method && c.path === path) },
}

const reply = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })

globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
  const req = new Request(input, init)
  const url = new URL(req.url)
  const text = req.method === 'GET' || req.method === 'HEAD' ? '' : await req.text()
  let body: any = text
  try { body = text ? JSON.parse(text) : null } catch { /* form or plain text */ }
  world.calls.push({ method: req.method, path: `${url.origin}${url.pathname}`, search: url.searchParams, body, headers: req.headers })

  if (url.origin === SB && url.pathname.startsWith('/rest/v1/rpc/')) {
    const fn = url.pathname.split('/').pop()!
    const handler = world.rpc[fn]
    if (!handler) return reply(404, { message: `no fake for ${fn}` })
    const r = handler(body, req.headers.get('authorization') || '')
    return reply(r.status ?? 200, r.body)
  }
  if (url.origin === SB && url.pathname === '/rest/v1/site_leads' && (req.method === 'HEAD' || req.method === 'GET'))
    return new Response(null, { status: 200, headers: { 'content-range': `*/${world.leadCount}` } })
  if (url.origin === SB && url.pathname.startsWith('/rest/v1/')) return reply(201, undefined)
  if (url.origin === SB && url.pathname.startsWith('/auth/v1/admin/users/') && req.method === 'PUT')
    return reply(200, { id: url.pathname.split('/').pop(), app_metadata: body.app_metadata })
  if (url.origin === SB && url.pathname === '/auth/v1/invite' || url.pathname === '/auth/v1/admin/users') {
    if (world.authUsers.has(body.email)) return reply(422, { code: 422, msg: 'A user with this email address has already been registered' })
    return reply(200, { id: 'new-user-id', email: body.email, user_metadata: body.data ?? body.user_metadata })
  }
  if (url.hostname === 'api.brevo.com') return reply(201, { messageId: 'x' })
  if (url.hostname === 'api.netlify.com') return reply(200, {})
  return reply(599, { error: `unexpected call to ${req.url}` })
}

// Each function calls Deno.serve(handler) when imported: capture the handler
async function load(name: string): Promise<(req: Request) => Promise<Response>> {
  let handler: any
  const realServe = Deno.serve
  ;(Deno as any).serve = (h: any) => { handler = h; return {} }
  await import(`../${name}/index.ts`)
  ;(Deno as any).serve = realServe
  return handler
}

const lead = await load('site-lead')
const publish = await load('site-publish')
const admin = await load('site-admin')

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://fn.example/x', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', ...headers } })
const SITE = { origin: 'https://workflow-app.net', 'x-forwarded-for': '41.66.1.2' }
const FORM = { 'first-name': 'Ama', 'last-name': 'Owusu', email: 'ama@example.com', organisation: 'Obuasi Mine', 'inquiry-type': 'Book a demo', message: 'Two TSFs to monitor.' }

// ── site-lead ─────────────────────────────────────────────

Deno.test('site-lead answers the CORS pre-check', async () => {
  world.reset()
  const res = await lead(new Request('https://fn.example/x', { method: 'OPTIONS', headers: { origin: 'https://workflow-app.net' } }))
  assertEquals(res.status, 204)
  assertEquals(res.headers.get('access-control-allow-origin'), 'https://workflow-app.net')
})

Deno.test('site-lead refuses other websites', async () => {
  world.reset()
  const res = await lead(post(FORM, { origin: 'https://evil.example' }))
  assertEquals(res.status, 403)
  assertEquals(world.find('POST', `${SB}/rest/v1/site_leads`).length, 0)
})

Deno.test('site-lead accepts deploy previews', async () => {
  world.reset()
  const res = await lead(post(FORM, { ...SITE, origin: 'https://deploy-preview-2--workflowsolution.netlify.app' }))
  assertEquals(res.status, 200)
})

Deno.test('site-lead silently drops honeypot submissions', async () => {
  world.reset()
  const res = await lead(post({ ...FORM, 'bot-field': 'spam' }, SITE))
  assertEquals(res.status, 200)
  assertEquals(world.find('POST', `${SB}/rest/v1/site_leads`).length, 0)
})

Deno.test('site-lead rejects incomplete forms', async () => {
  world.reset()
  const res = await lead(post({ ...FORM, email: 'nope', message: '' }, SITE))
  assertEquals(res.status, 400)
  const body = await res.json()
  assert(body.problems.includes('message is required'))
  assert(body.problems.includes('email is not valid'))
})

Deno.test('site-lead saves the lead and emails an alert with reply-to', async () => {
  world.reset()
  Deno.env.set('BREVO_API_KEY', 'brevo-key')
  const res = await lead(post(FORM, { ...SITE, referer: 'https://workflow-app.net/' }))
  Deno.env.delete('BREVO_API_KEY')
  assertEquals(res.status, 200)
  const [insert] = world.find('POST', `${SB}/rest/v1/site_leads`)
  assertEquals(insert.body.first_name, 'Ama')
  assertEquals(insert.body.inquiry_type, 'Book a demo')
  assertEquals(insert.body.source, 'https://workflow-app.net/')
  assertMatch(insert.body.ip_hash, /^[0-9a-f]{32}$/)
  assert(!JSON.stringify(insert.body).includes('41.66.1.2'), 'the address itself is never stored')
  const [mail] = world.find('POST', 'https://api.brevo.com/v3/smtp/email')
  assertEquals(mail.body.replyTo.email, 'ama@example.com')
  assertEquals(mail.body.to[0].email, 'admin@workflow-app.net')
  assertMatch(mail.body.subject, /Book a demo — Ama Owusu/)
})

Deno.test('site-lead works without an email key', async () => {
  world.reset()
  const res = await lead(post(FORM, SITE))
  assertEquals(res.status, 200)
  assertEquals(world.find('POST', `${SB}/rest/v1/site_leads`).length, 1)
  assertEquals(world.find('POST', 'https://api.brevo.com/v3/smtp/email').length, 0)
})

Deno.test('site-lead limits each address to 5 messages per 10 minutes', async () => {
  world.reset()
  world.leadCount = 5
  const res = await lead(post(FORM, SITE))
  assertEquals(res.status, 429)
  assertEquals(world.find('POST', `${SB}/rest/v1/site_leads`).length, 0)
})

// ── site-publish ──────────────────────────────────────────

const draftOk = () => ({ body: { content: structuredClone(defaults), published: { id: 7 } } })

Deno.test('site-publish needs a login', async () => {
  world.reset()
  assertEquals((await publish(post({}))).status, 401)
})

Deno.test('site-publish refuses people without editor access', async () => {
  world.reset()
  world.rpc.site_get_content = () => ({ status: 403, body: { code: '42501', message: "You don't have access" } })
  const res = await publish(post({}, { authorization: 'Bearer user' }))
  assertEquals(res.status, 403)
  assertEquals(world.find('POST', `${SB}/rest/v1/rpc/site_create_publication`).length, 0)
})

Deno.test('site-publish refuses a draft that would break the site', async () => {
  world.reset()
  world.rpc.site_get_content = () => {
    const d = draftOk(); d.body.content.contact.email = 'not an email'; return d
  }
  const res = await publish(post({}, { authorization: 'Bearer user' }))
  assertEquals(res.status, 422)
  assert((await res.json()).problems.some((p: string) => p.includes('Contact email')))
  assertEquals(world.find('POST', `${SB}/rest/v1/rpc/site_create_publication`).length, 0)
})

Deno.test('site-publish saves a version as the user and triggers the Netlify build', async () => {
  world.reset()
  Deno.env.set('NETLIFY_BUILD_HOOK_URL', 'https://api.netlify.com/build_hooks/abc')
  world.rpc.site_get_content = draftOk
  world.rpc.site_create_publication = (args) => ({ body: args.p_note === 'New prices' ? 8 : -1 })
  const res = await publish(post({ note: 'New prices' }, { authorization: 'Bearer user' }))
  Deno.env.delete('NETLIFY_BUILD_HOOK_URL')
  assertEquals(await res.json(), { id: 8, deploy_status: 'triggered', deploy_error: null })
  const [create] = world.find('POST', `${SB}/rest/v1/rpc/site_create_publication`)
  assertEquals(create.headers.get('authorization'), 'Bearer user', "runs with the editor's own login")
  const [hook] = world.find('POST', 'https://api.netlify.com/build_hooks/abc')
  assertMatch(hook.search.get('trigger_title')!, /version 8/)
  const [mark] = world.find('PATCH', `${SB}/rest/v1/site_publications`)
  assertEquals(mark.body, { deploy_status: 'triggered', deploy_error: null })
  assertEquals(mark.search.get('id'), 'eq.8')
})

Deno.test('site-publish takes the hook address out of the curl line Netlify shows', async () => {
  world.reset()
  Deno.env.set('NETLIFY_BUILD_HOOK_URL', ' curl -X POST -d {} https://api.netlify.com/build_hooks/abc\n')
  world.rpc.site_get_content = draftOk
  world.rpc.site_create_publication = () => ({ body: 10 })
  const body = await (await publish(post({}, { authorization: 'Bearer user' }))).json()
  Deno.env.delete('NETLIFY_BUILD_HOOK_URL')
  assertEquals(body.deploy_status, 'triggered')
  assertEquals(world.find('POST', 'https://api.netlify.com/build_hooks/abc').length, 1)
})

Deno.test('site-publish says so when the hook secret has no address in it', async () => {
  world.reset()
  Deno.env.set('NETLIFY_BUILD_HOOK_URL', 'Admin publish')
  world.rpc.site_get_content = draftOk
  world.rpc.site_create_publication = () => ({ body: 11 })
  const body = await (await publish(post({}, { authorization: 'Bearer user' }))).json()
  Deno.env.delete('NETLIFY_BUILD_HOOK_URL')
  assertEquals(body.deploy_status, 'failed')
  assertMatch(body.deploy_error, /https:\/\//)
  assertEquals(world.calls.filter((c) => c.path.includes('netlify')).length, 0)
})

Deno.test('site-publish still saves the version when the build hook is missing', async () => {
  world.reset()
  world.rpc.site_get_content = draftOk
  world.rpc.site_create_publication = () => ({ body: 9 })
  const body = await (await publish(post({}, { authorization: 'Bearer user' }))).json()
  assertEquals(body.deploy_status, 'no_hook')
})

Deno.test('site-publish rebuild re-sends the latest version without a new one', async () => {
  world.reset()
  Deno.env.set('NETLIFY_BUILD_HOOK_URL', 'https://api.netlify.com/build_hooks/abc')
  world.rpc.site_get_content = draftOk
  const body = await (await publish(post({ action: 'rebuild' }, { authorization: 'Bearer user' }))).json()
  Deno.env.delete('NETLIFY_BUILD_HOOK_URL')
  assertEquals(body.id, 7)
  assertEquals(world.find('POST', `${SB}/rest/v1/rpc/site_create_publication`).length, 0)
})

// ── site-admin ────────────────────────────────────────────

const asAdmin = () => { world.rpc.site_me = () => ({ body: { user_id: 'admin-id', email: 'boss@example.com', role: 'admin' } }) }

Deno.test('site-admin is for admins only', async () => {
  world.reset()
  world.rpc.site_me = () => ({ body: { user_id: 'u', email: 'e@example.com', role: 'editor' } })
  const res = await admin(post({ email: 'new@example.com', role: 'editor' }, { authorization: 'Bearer user' }))
  assertEquals(res.status, 403)
  assertEquals(world.calls.filter((c) => c.path.includes('/auth/v1/')).length, 0)
})

Deno.test('site-admin invites a new person with website-only ops access', async () => {
  world.reset(); asAdmin()
  const res = await admin(post({ email: 'New@Example.com', role: 'editor', mode: 'invite' }, { authorization: 'Bearer user', origin: 'https://deploy-preview-3--workflowsolution.netlify.app' }))
  assertEquals(res.status, 200)
  const [invite] = world.find('POST', `${SB}/auth/v1/invite`)
  assertEquals(invite.body.email, 'new@example.com')
  assertEquals(invite.body.data.role, 'website', 'ops platform profile gets a role with no access')
  const [mark] = world.find('PUT', `${SB}/auth/v1/admin/users/new-user-id`)
  assertEquals(mark.body.app_metadata, { role: 'website' }, 'role recorded where only the service role can set it')
  assertEquals(invite.search.get('redirect_to'), 'https://deploy-preview-3--workflowsolution.netlify.app/admin/')
  const [grant] = world.find('POST', `${SB}/rest/v1/site_users`)
  assertEquals(grant.body, { user_id: 'new-user-id', role: 'editor', created_by: 'admin-id' })
  assertEquals(world.find('POST', `${SB}/rest/v1/site_activity`).length, 1)
})

Deno.test('site-admin never sends invite links to other websites', async () => {
  world.reset(); asAdmin()
  await admin(post({ email: 'x@example.com', role: 'editor', mode: 'invite' }, { authorization: 'Bearer user', origin: 'https://evil.example' }))
  assertEquals(world.find('POST', `${SB}/auth/v1/invite`)[0].search.get('redirect_to'), 'https://workflow-app.net/admin/')
})

Deno.test('site-admin can create a login with a one-time password', async () => {
  world.reset(); asAdmin()
  const body = await (await admin(post({ email: 'sales@example.com', role: 'sales', mode: 'password' }, { authorization: 'Bearer user' }))).json()
  assertMatch(body.password, /^[A-Za-z2-9]{16}$/)
  const [create] = world.find('POST', `${SB}/auth/v1/admin/users`)
  assertEquals(create.body.email_confirm, true)
  assertEquals(create.body.user_metadata.role, 'website')
  assertEquals(create.body.app_metadata, { role: 'website' })
})

Deno.test('site-admin gives an existing login access instead of failing', async () => {
  world.reset(); asAdmin()
  world.authUsers.add('ops@example.com')
  world.rpc.site_user_add_existing = (args) => ({ body: args.p_email === 'ops@example.com' && args.p_role === 'sales' })
  const body = await (await admin(post({ email: 'ops@example.com', role: 'sales', mode: 'invite' }, { authorization: 'Bearer user' }))).json()
  assertEquals(body, { email: 'ops@example.com', role: 'sales', existing: true })
  assertEquals(world.find('POST', `${SB}/rest/v1/site_users`).length, 0)
  assertEquals(world.calls.filter((c) => c.method === 'PUT').length, 0, "an existing login's metadata is left alone")
})

Deno.test('site-admin checks its input', async () => {
  world.reset(); asAdmin()
  assertEquals((await admin(post({ email: 'x', role: 'editor' }, { authorization: 'Bearer user' }))).status, 400)
  assertEquals((await admin(post({ email: 'a@b.co', role: 'owner' }, { authorization: 'Bearer user' }))).status, 400)
})
