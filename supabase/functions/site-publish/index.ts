// site-publish — the admin's Publish button.
//
// With the editor's own login it checks the draft passes the same validation
// the site build uses, snapshots it as a new published version (the database
// checks they're an admin or editor), then asks Netlify to rebuild the site.
// { "action": "rebuild" } re-sends the latest version to Netlify without
// creating a new one, for when a build hook call failed.
//
// Secret (Supabase → Edge Functions → Secrets):
//   NETLIFY_BUILD_HOOK_URL   from Netlify → Site configuration → Build hooks.
//   Without it versions are still saved, marked "no_hook", and go live with
//   the next deploy.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { env, json, preflight } from '../_shared/http.ts'
import { validateContent, withDefaults } from '../_shared/render.js'
import defaults from '../_shared/defaults.json' with { type: 'json' }

async function triggerBuild(id: number): Promise<{ status: string; error: string | null }> {
  const hook = env('NETLIFY_BUILD_HOOK_URL')
  if (!hook) return { status: 'no_hook', error: 'The Netlify build hook is not set up yet' }
  try {
    const url = `${hook}${hook.includes('?') ? '&' : '?'}trigger_title=${encodeURIComponent(`Published from the admin (version ${id})`)}`
    const res = await fetch(url, { method: 'POST', body: '{}' })
    if (!res.ok) return { status: 'failed', error: `Netlify answered ${res.status}` }
    return { status: 'triggered', error: null }
  } catch (err) {
    return { status: 'failed', error: String(err).slice(0, 300) }
  }
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
  const service = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })
  const body = await req.json().catch(() => ({}))

  // Loading the draft is also the permission check: admins and editors only
  const { data: draft, error: loadErr } = await asUser.rpc('site_get_content')
  if (loadErr) return json(req, loadErr.code === '42501' ? 403 : 400, { error: loadErr.message })

  let id: number
  if (body.action === 'rebuild') {
    if (!draft.published) return json(req, 400, { error: 'Nothing has been published yet' })
    id = draft.published.id
  } else {
    const problems = validateContent(withDefaults(draft.content, defaults))
    if (problems.length) return json(req, 422, { error: 'Fix these before publishing', problems })
    const { data, error } = await asUser.rpc('site_create_publication', { p_note: String(body.note || '').slice(0, 200) || null })
    if (error) return json(req, 400, { error: error.message })
    id = data
  }

  const result = await triggerBuild(id)
  await service.from('site_publications').update({ deploy_status: result.status, deploy_error: result.error }).eq('id', id)
  return json(req, 200, { id, deploy_status: result.status, deploy_error: result.error })
})
