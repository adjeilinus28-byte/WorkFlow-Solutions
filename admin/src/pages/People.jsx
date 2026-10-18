import { useEffect, useState } from 'react'
import { Check, Copy, Lock, Trash2, UserPlus } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { callFunction, date, initials, ROLE_LABELS, rpc, when } from '../lib/api'
import { PageTitle } from '../components/Layout'
import { Notice } from '../components/fields'
import Dialog from '../components/Dialog'

const ROLE_NAMES = { admin: 'Admin', editor: 'Editor', sales: 'Sales' }
const ROLE_CAN = {
  admin: ['Everything below', 'People and the Activity log'],
  editor: ['Website content', 'Publish and Publish history'],
  sales: ['The Leads inbox: status, notes, replies'],
}

export default function People() {
  const { me } = useAuth()
  const [people, setPeople] = useState(null)
  const [notice, setNotice] = useState(null)
  const [adding, setAdding] = useState(false)
  const load = () => rpc('site_users_list').then(setPeople).catch(e => setNotice({ tone: 'error', text: e.message }))
  useEffect(() => { load() }, [])

  async function setRole(p, role, select) {
    // A role change is confirmed first; cancelling puts the menu back
    if (!confirm(`Change ${p.email} from ${ROLE_NAMES[p.role]} to ${ROLE_NAMES[role]}?`)) { select.value = p.role; return }
    try { await rpc('site_user_set_role', { p_user: p.user_id, p_role: role }); setNotice({ tone: 'ok', text: `${p.email} is now ${ROLE_NAMES[role]}.` }); load() }
    catch (e) { select.value = p.role; setNotice({ tone: 'error', text: e.message }) }
  }
  async function remove(p) {
    if (!confirm(`Remove ${p.email}’s access to the website admin? Their login itself isn’t deleted.`)) return
    try { await rpc('site_user_remove', { p_user: p.user_id }); setNotice({ tone: 'ok', text: `${p.email} no longer has access.` }); load() }
    catch (e) { setNotice({ tone: 'error', text: e.message }) }
  }

  return (
    <>
      <PageTitle title="People" sub="Who can use the website admin, and what each person can do.">
        <button type="button" className="btn-primary" onClick={() => setAdding(true)}>Add person <UserPlus size={16} aria-hidden="true" /></button>
      </PageTitle>
      {notice && <div className="mb-5" aria-live="polite"><Notice tone={notice.tone}>{notice.text}</Notice></div>}
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div aria-hidden="true" className="eyebrow flex justify-between border-b border-slate-200 bg-slate-50 px-5 py-3"><span>Person</span><span>Role · Added</span></div>
          {!people && <p className="px-5 py-4 text-sm text-slate-600">Loading…</p>}
          {people && (
            <ul aria-label="People with access">
              {people.map(p => {
                const self = p.user_id === me?.user_id
                return (
                  <li key={p.user_id} className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-slate-100 px-5 py-4 last:border-0">
                    <span className="flex min-w-0 flex-1 basis-56 items-center gap-3">
                      <span className="avatar">{initials(p.email)}</span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate font-semibold text-navy">{p.email}</span>
                          {self && <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">You</span>}
                        </span>
                        <span className="block truncate text-[13px] text-slate-600">
                          {p.last_sign_in_at ? `Last signed in ${when(p.last_sign_in_at)}` : p.confirmed ? 'Hasn’t signed in yet' : 'Invite not accepted yet'}
                        </span>
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <label htmlFor={`role-${p.user_id}`} className="sr-only">Role for {p.email}</label>
                      <select id={`role-${p.user_id}`} className="inp min-h-[40px] w-auto py-1.5 font-semibold" defaultValue={p.role} key={p.role}
                        onChange={e => setRole(p, e.target.value, e.target)}>
                        {Object.keys(ROLE_NAMES).map(r => <option key={r} value={r}>{ROLE_NAMES[r]}</option>)}
                      </select>
                      {p.created_at && <span className="hidden whitespace-nowrap text-sm text-slate-600 sm:inline">Added {date(p.created_at)}</span>}
                      <button type="button" className="btn-icon h-10 w-10 text-slate-500 hover:text-red-700" disabled={self}
                        onClick={() => remove(p)} aria-label={`Remove access for ${p.email}`} title={self ? 'You can’t remove yourself' : 'Remove access'}>
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
          <p className="flex items-start gap-2.5 border-t border-slate-200 bg-slate-50 px-5 py-3.5 text-[13px] text-slate-600">
            <Lock size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            Changing a role asks you to confirm. The last admin can’t be demoted or removed, and you can’t remove yourself.
          </p>
        </div>

        <section className="card" aria-labelledby="roles-title">
          <h2 id="roles-title" className="card-title">What each role can do</h2>
          <dl className="mt-2">
            {Object.entries(ROLE_CAN).map(([r, list]) => (
              <div key={r} className="border-t border-slate-200 py-4 first:mt-3 last:pb-0">
                <dt className="font-mono text-xs uppercase tracking-[.12em] text-amber-700">{ROLE_NAMES[r]}</dt>
                {list.map(t => <dd key={t} className="mt-2 flex items-start gap-2.5 text-[15px]"><Check size={16} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />{t}</dd>)}
              </div>
            ))}
          </dl>
        </section>
      </div>
      {adding && <AddPerson onClose={() => setAdding(false)} onAdded={load} />}
    </>
  )
}

function AddPerson({ onClose, onAdded }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('editor')
  const [method, setMethod] = useState('invite')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [copied, setCopied] = useState(false)

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
          ? { tone: 'ok', text: `Login created for ${r.email}. Give them this password — it’s shown only once, and they can change it with “Forgot your password?”:`, password: r.password }
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
  async function copy() {
    try { await navigator.clipboard.writeText(result.password); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* the password stays on screen to copy by hand */ }
  }
  const done = result?.tone === 'ok'

  return (
    <Dialog title="Add a person" sub="They’ll be able to sign in to the website admin with the role you choose." onClose={onClose}
      footer={done
        ? <button type="button" className="btn-dark" onClick={onClose}>Done</button>
        : <>
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" form="add-person" className="btn-primary" disabled={busy}>{busy ? 'Adding…' : 'Add person'}</button>
          </>}>
      {done ? (
        <Notice tone="ok">
          {result.text}
          {result.password && (
            <span className="mt-3 flex flex-wrap items-center gap-2">
              <code className="rounded-lg bg-white px-2.5 py-1.5 font-mono text-base text-navy">{result.password}</code>
              <button type="button" className="btn-ghost min-h-[36px] px-3" onClick={copy}>
                {copied ? <><Check size={14} aria-hidden="true" /> Copied</> : <><Copy size={14} aria-hidden="true" /> Copy</>}
              </button>
              <span className="sr-only" aria-live="polite">{copied ? 'Password copied' : ''}</span>
            </span>
          )}
        </Notice>
      ) : (
        <form id="add-person" className="space-y-5" onSubmit={submit}>
          <div>
            <label htmlFor="add-email" className="label">Email address</label>
            <input id="add-email" type="email" required className="inp" autoComplete="off" spellCheck={false} data-autofocus
              placeholder="name@company.com…" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <fieldset>
            <legend className="label">Role</legend>
            <div className="grid gap-2">
              {Object.entries(ROLE_LABELS).map(([r, text]) => (
                <label key={r} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${role === r ? 'border-amber bg-amber-50/60' : 'border-slate-200 hover:border-slate-300'}`}>
                  <input type="radio" name="role" className="mt-1 accent-amber-600" checked={role === r} onChange={() => setRole(r)} />
                  <span><span className="block font-semibold">{ROLE_NAMES[r]}</span><span className="block text-sm text-slate-600">{text.split(' — ')[1]}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="label">If they don’t have a login yet</legend>
            <div className="grid gap-1 text-[15px]">
              <label className="flex min-h-[40px] cursor-pointer items-center gap-3"><input type="radio" name="method" className="accent-amber-600" checked={method === 'invite'} onChange={() => setMethod('invite')} /> Email them an invite</label>
              <label className="flex min-h-[40px] cursor-pointer items-center gap-3"><input type="radio" name="method" className="accent-amber-600" checked={method === 'password'} onChange={() => setMethod('password')} /> Create a password for me to pass on</label>
            </div>
          </fieldset>
          {result && <Notice tone={result.tone}>{result.text}</Notice>}
        </form>
      )}
    </Dialog>
  )
}
