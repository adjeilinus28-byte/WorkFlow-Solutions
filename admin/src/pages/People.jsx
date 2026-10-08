import { useEffect, useState } from 'react'
import { Copy, UserPlus } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { callFunction, ROLE_LABELS, rpc, when } from '../lib/api'
import { PageTitle } from '../components/Layout'
import { Notice } from '../components/fields'

export default function People() {
  const { me } = useAuth()
  const [people, setPeople] = useState(null)
  const [notice, setNotice] = useState(null)
  const load = () => rpc('site_users_list').then(setPeople).catch(e => setNotice({ tone: 'error', text: e.message }))
  useEffect(() => { load() }, [])

  async function setRole(p, role) {
    try { await rpc('site_user_set_role', { p_user: p.user_id, p_role: role }); setNotice({ tone: 'ok', text: `${p.email} is now ${role}.` }); load() }
    catch (e) { setNotice({ tone: 'error', text: e.message }) }
  }
  async function remove(p) {
    if (!confirm(`Remove ${p.email}'s access to the website admin? Their login itself isn't deleted.`)) return
    try { await rpc('site_user_remove', { p_user: p.user_id }); setNotice({ tone: 'ok', text: `${p.email} no longer has access.` }); load() }
    catch (e) { setNotice({ tone: 'error', text: e.message }) }
  }

  return (
    <>
      <PageTitle title="People" sub="Who can use this admin, and what they can do." />
      <div className="space-y-6">
        {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
        <AddPerson onAdded={load} />
        {people && (
          <ul className="card divide-y divide-slate-100 p-0" aria-label="People with access">
            {people.map(p => (
              <li key={p.user_id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{p.email}{p.user_id === me?.user_id && <span className="font-normal text-slate-500"> (you)</span>}</p>
                  <p className="text-sm text-slate-600">
                    {p.last_sign_in_at ? `Last signed in ${when(p.last_sign_in_at)}` : p.confirmed ? 'Hasn\'t signed in yet' : 'Invite not accepted yet'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor={`role-${p.user_id}`} className="sr-only">Role for {p.email}</label>
                  <select id={`role-${p.user_id}`} className="inp w-auto" value={p.role} onChange={e => setRole(p, e.target.value)}>
                    {Object.keys(ROLE_LABELS).map(r => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>)}
                  </select>
                  <button type="button" className="btn-danger" onClick={() => remove(p)}>Remove</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <dl className="card space-y-2 text-sm">
          {Object.entries(ROLE_LABELS).map(([r, text]) => (
            <div key={r}><dt className="inline font-semibold">{text.split(' — ')[0]}: </dt><dd className="inline text-slate-600">{text.split(' — ')[1]}</dd></div>
          ))}
        </dl>
      </div>
    </>
  )
}

function AddPerson({ onAdded }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('editor')
  const [method, setMethod] = useState('invite')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setResult(null)
    try {
      // Someone with a login already (from the ops platform, say) just gets access
      if (await rpc('site_user_add_existing', { p_email: email.trim(), p_role: role })) {
        setResult({ tone: 'ok', text: `${email.trim()} already had a login and can now sign in here.` })
      } else {
        const r = await callFunction('site-admin', { email: email.trim(), role, mode: method })
        setResult(r.password
          ? { tone: 'ok', text: `Login created for ${r.email}. Give them this password — it's shown only once, and they can change it with "Forgot your password?":`, password: r.password }
          : r.existing
            ? { tone: 'ok', text: `${r.email} already had a login and can now sign in here.` }
            : { tone: 'ok', text: `Invite sent to ${r.email}. The email has a link to choose a password.` })
      }
      setEmail('')
      onAdded()
    } catch (err) {
      setResult({ tone: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card space-y-4" onSubmit={submit} aria-labelledby="add-title">
      <h2 id="add-title" className="flex items-center gap-2 font-display text-lg font-extrabold"><UserPlus size={18} aria-hidden="true" /> Add someone</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="add-email" className="label">Email</label>
          <input id="add-email" type="email" required className="inp" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="add-role" className="label">Role</label>
          <select id="add-role" className="inp" value={role} onChange={e => setRole(e.target.value)}>
            {Object.entries(ROLE_LABELS).map(([r, text]) => <option key={r} value={r}>{text}</option>)}
          </select>
        </div>
      </div>
      <fieldset>
        <legend className="label">If they don't have a login yet</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <label className="flex items-center gap-2"><input type="radio" name="method" className="accent-amber-600" checked={method === 'invite'} onChange={() => setMethod('invite')} /> Email them an invite</label>
          <label className="flex items-center gap-2"><input type="radio" name="method" className="accent-amber-600" checked={method === 'password'} onChange={() => setMethod('password')} /> Create a password for me to pass on</label>
        </div>
      </fieldset>
      {result && (
        <Notice tone={result.tone}>
          {result.text}
          {result.password && (
            <span className="mt-2 flex items-center gap-2">
              <code className="rounded bg-white px-2 py-1 font-mono text-base">{result.password}</code>
              <button type="button" className="btn-ghost px-2 py-1" onClick={() => navigator.clipboard?.writeText(result.password)}><Copy size={14} /> Copy</button>
            </span>
          )}
        </Notice>
      )}
      <button type="submit" className="btn-dark" disabled={busy}>{busy ? 'Adding…' : 'Add'}</button>
    </form>
  )
}
