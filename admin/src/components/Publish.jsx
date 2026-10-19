import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, CloudUpload, Eye, Pencil, RefreshCw } from 'lucide-react'
import { defaults, useDraft } from '../lib/content'
import { rpc, when } from '../lib/api'
import { Notice, Problems } from './fields'
import Dialog from './Dialog'
import Preview from './Preview'

export const SECTION_LABELS = {
  announcement: 'Announcement bar', hero: 'Headline', products: 'Products', video: 'Video',
  pricing: 'Pricing', faq: 'FAQ', contact: 'Contact details',
}
export const SECTION_TAB = { announcement: 'top', hero: 'top', products: 'products', pricing: 'pricing', faq: 'faq', contact: 'contact', video: 'contact' }

const DEPLOY = {
  triggered: { tone: 'ok', text: 'Netlify is rebuilding the site. The changes are live in about a minute.' },
  pending: { tone: 'info', text: 'Saved — waiting to be sent to Netlify.' },
  no_hook: { tone: 'warn', text: 'Saved, but the site won’t update until the Netlify build hook is set up (see the setup notes). It will go live with the next deploy.' },
  failed: { tone: 'error', text: 'Saved, but Netlify couldn’t be reached to rebuild the site.' },
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// Which saved sections differ from what's live, with who saved them and when
export function useChanges() {
  const draft = useDraft()
  const [live, setLive] = useState(undefined)
  const pubId = draft.saved?.published?.id
  useEffect(() => {
    if (!draft.saved) return
    if (!pubId) { setLive(null); return }
    let on = true
    rpc('site_publication_get', { p_id: pubId }).then(p => { if (on) setLive(p.content) }).catch(() => { if (on) setLive(null) })
    return () => { on = false }
  }, [pubId, draft.saved])
  if (!draft.saved || live === undefined) return null
  const saved = draft.saved.content || {}
  return Object.keys(SECTION_LABELS)
    .filter(n => !same(saved[n] ?? defaults[n], live?.[n] ?? defaults[n]))
    .map(n => ({ name: n, label: SECTION_LABELS[n], ...(draft.saved.sections?.[n] || {}) }))
}

function ChangeList({ changes }) {
  return (
    <ul className="[&>*:nth-child(even)]:bg-slate-50">
      {changes.map(c => (
        <li key={c.name}>
          <Link to={`/content/${SECTION_TAB[c.name]}`} className="group flex items-center gap-4 py-3.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center border border-amber-200 bg-amber-50 text-amber-700"><Pencil size={15} aria-hidden="true" /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-navy group-hover:text-amber-700">{c.label}</span>
              {c.updated_by && <span className="block truncate text-sm text-slate-600">Saved by {c.updated_by}</span>}
            </span>
            <span className="shrink-0 text-sm text-slate-500">{when(c.updated_at)}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

// Overview: what's waiting, with Preview and Review & publish
export function ChangesCard() {
  const draft = useDraft()
  const changes = useChanges()
  const [publishing, setPublishing] = useState(false)
  const [preview, setPreview] = useState(false)
  if (!draft.saved) return null
  const published = draft.saved.published
  const waiting = draft.saved.unpublished_changes

  return (
    <section className="card" aria-labelledby="changes-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="changes-title" className="card-title">
            {!waiting ? 'The live site is up to date' : changes?.length ? `${changes.length} ${changes.length === 1 ? 'change' : 'changes'} waiting to publish` : 'Changes waiting to publish'}
          </h2>
          <p className="mt-0.5 text-sm text-slate-600">
            {published ? `The live site shows version ${published.id}, published ${when(published.published_at)}.` : 'Nothing has been published from here yet — the site shows its original content.'}
          </p>
        </div>
        {waiting && (
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={() => setPreview(true)}><Eye size={15} aria-hidden="true" /> Preview</button>
            <button type="button" className="btn-primary" onClick={() => setPublishing(true)}>Review &amp; publish <ArrowRight size={15} aria-hidden="true" /></button>
          </div>
        )}
      </div>
      {waiting && changes?.length > 0 && <div className="mt-4"><ChangeList changes={changes} /></div>}
      {!waiting && (
        <p className="mt-4 flex items-center gap-2 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 size={16} aria-hidden="true" /> Everything saved is live. Edit in <Link to="/content" className="font-semibold underline">Website content</Link>.
        </p>
      )}
      <DeployStatus />
      {publishing && <PublishDialog onClose={() => setPublishing(false)} />}
      {preview && <Preview content={draft.saved.content} title="Preview of the saved draft" onClose={() => setPreview(false)} />}
    </section>
  )
}

// A problem with the last deploy, and a way to retry it
function DeployStatus() {
  const draft = useDraft()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const published = draft.saved?.published
  const status = published && DEPLOY[published.deploy_status]
  if (!status || published.deploy_status === 'triggered') return null
  return (
    <div className="mt-4">
      <Notice tone={status.tone}>
        Version {published.id}: {status.text}{published.deploy_error ? ` (${published.deploy_error})` : ''}
        {(published.deploy_status === 'failed' || published.deploy_status === 'no_hook') && (
          <button type="button" className="ml-2 inline-flex items-center gap-1 font-semibold underline" disabled={busy}
            onClick={async () => { setBusy(true); setError(''); try { await draft.rebuild() } catch (e) { setError(e.message) } finally { setBusy(false) } }}>
            <RefreshCw size={13} aria-hidden="true" /> {busy ? 'Trying…' : 'Try again'}
          </button>
        )}
        {error && <span className="mt-1 block">{error}</span>}
      </Notice>
    </div>
  )
}

export function PublishDialog({ onClose }) {
  const draft = useDraft()
  const changes = useChanges()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const waiting = draft.saved?.unpublished_changes
  const unsaved = draft.dirty.length > 0

  async function publish(e) {
    e.preventDefault()
    setBusy(true); setError(null)
    try { setResult(await draft.publish(note.trim())) } catch (err) { setError(err) } finally { setBusy(false) }
  }

  const done = result && DEPLOY[result.deploy_status]
  return (
    <Dialog title={done ? `Version ${result.id} published` : 'Publish to the live site'} onClose={onClose}
      sub={done ? null : 'Everything saved in the draft goes live. Unsaved edits stay in the editor.'}
      footer={done
        ? <button type="button" className="btn-dark" onClick={onClose} data-autofocus>Done</button>
        : <>
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" form="publish-form" className="btn-primary" disabled={busy || !waiting}>
              <CloudUpload size={16} aria-hidden="true" /> {busy ? 'Publishing…' : 'Publish now'}
            </button>
          </>}>
      {done ? <Notice tone={done.tone}>{done.text}</Notice> : (
        <form id="publish-form" onSubmit={publish} className="space-y-5">
          {unsaved && <Notice tone="warn">You have unsaved edits in {draft.dirty.map(n => SECTION_LABELS[n]).join(', ')}. Save them first if they should go live too.</Notice>}
          {!waiting
            ? <Notice tone="ok">The live site already matches the saved draft.</Notice>
            : changes?.length > 0 && (
              <div>
                <p className="col-head mb-1">Going live</p>
                <ChangeList changes={changes} />
              </div>
            )}
          {waiting && (
            <div>
              <label htmlFor="publish-note" className="label">What changed <span className="normal-case tracking-normal text-slate-500">(optional)</span></label>
              <input id="publish-note" className="inp" maxLength={200} value={note} onChange={e => setNote(e.target.value)} autoComplete="off" data-autofocus
                placeholder="e.g. New Sales Manager link…" />
              <p className="help">Shown in Publish history, so it’s easy to find this version later.</p>
            </div>
          )}
          {error && (error.problems?.length ? <Problems problems={error.problems} title={error.message} /> : <Notice tone="error">{error.message}</Notice>)}
        </form>
      )}
    </Dialog>
  )
}
