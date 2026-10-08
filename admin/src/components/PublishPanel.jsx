import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, RefreshCw, Rocket } from 'lucide-react'
import { useDraft } from '../lib/content'
import { when } from '../lib/api'
import { Notice, Problems } from './fields'
import Preview from './Preview'

const DEPLOY = {
  triggered: { tone: 'ok', text: 'Netlify is rebuilding the site. The changes are live in about a minute.' },
  pending: { tone: 'info', text: 'Saved — waiting to be sent to Netlify.' },
  no_hook: { tone: 'warn', text: 'Saved, but the site won\'t update until the Netlify build hook is set up (see the setup notes). It will go live with the next deploy.' },
  failed: { tone: 'error', text: 'Saved, but Netlify couldn\'t be reached to rebuild the site.' },
}

export default function PublishPanel() {
  const draft = useDraft()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [preview, setPreview] = useState(false)
  if (!draft.saved) return null
  const { published, unpublished_changes: changes } = draft.saved
  const status = published && DEPLOY[published.deploy_status]

  async function run(fn) {
    setBusy(true); setError(null); setResult(null)
    try {
      setResult(await fn())
      setNote('')
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card space-y-4" aria-labelledby="publish-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="publish-title" className="font-display text-lg font-extrabold">Publish</h2>
          <p className="text-sm text-slate-600">
            {published
              ? <>Live: version {published.id}, published {when(published.published_at)} by {published.published_by || 'someone'}.</>
              : <>Nothing has been published from here yet — the site shows its original content.</>}
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={() => setPreview(true)}><Eye size={15} /> Preview saved draft</button>
      </div>

      {draft.dirty.length > 0 && (
        <Notice tone="warn">You have unsaved changes in <Link className="font-semibold underline" to="/content">Website content</Link>. Save them first — only saved changes are published.</Notice>
      )}

      {changes ? (
        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={e => { e.preventDefault(); run(() => draft.publish(note)) }}>
          <label className="sr-only" htmlFor="publish-note">What changed (optional)</label>
          <input id="publish-note" className="inp sm:flex-1" maxLength={200} value={note} onChange={e => setNote(e.target.value)}
            placeholder="What changed? e.g. New Sales Manager link (optional)" />
          <button type="submit" className="btn-primary" disabled={busy}><Rocket size={15} /> {busy ? 'Publishing…' : 'Publish to the live site'}</button>
        </form>
      ) : (
        <p className="text-sm text-slate-600">The live site matches the saved draft.</p>
      )}

      {result && DEPLOY[result.deploy_status] && <Notice tone={DEPLOY[result.deploy_status].tone}>Version {result.id}: {DEPLOY[result.deploy_status].text}</Notice>}
      {!result && status && published.deploy_status !== 'triggered' && (
        <Notice tone={status.tone}>
          Version {published.id}: {status.text}{published.deploy_error ? ` (${published.deploy_error})` : ''}
          {(published.deploy_status === 'failed' || published.deploy_status === 'no_hook') && (
            <button type="button" className="ml-2 inline-flex items-center gap-1 font-semibold underline" disabled={busy}
              onClick={() => run(() => draft.rebuild())}><RefreshCw size={13} /> Try again</button>
          )}
        </Notice>
      )}
      {error && (error.problems?.length ? <Problems problems={error.problems} title={error.message} /> : <Notice tone="error">{error.message}</Notice>)}
      {preview && <Preview content={draft.saved.content} title="Preview of the saved draft" onClose={() => setPreview(false)} />}
    </section>
  )
}
