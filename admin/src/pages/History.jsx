import { useEffect, useState } from 'react'
import { Eye, RotateCcw } from 'lucide-react'
import { date, rpc, time } from '../lib/api'
import { useDraft } from '../lib/content'
import { PageTitle } from '../components/Layout'
import { Notice, Skeleton } from '../components/fields'
import Preview from '../components/Preview'

const STATUS = { triggered: 'Sent to Netlify', pending: 'Saved', no_hook: 'Waiting for build hook', failed: 'Netlify unreachable' }

export default function History() {
  const draft = useDraft()
  const [list, setList] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(null)
  const [viewing, setViewing] = useState(null)

  const load = () => rpc('site_publications_list', { p_limit: 100 }).then(setList).catch(e => setError(e.message))
  useEffect(() => { load() }, [draft.saved?.published?.id])

  async function view(id) {
    try { setViewing(await rpc('site_publication_get', { p_id: id })) } catch (e) { setNotice({ tone: 'error', text: e.message }) }
  }
  async function restore(id) {
    if (draft.dirty.length && !confirm('You have unsaved changes in Website content. Restoring replaces them. Continue?')) return
    if (!confirm(`Load version ${id} into the draft? The live site doesn't change until you publish.`)) return
    try {
      await rpc('site_restore_publication', { p_id: id })
      await draft.reload()
      setNotice({ tone: 'ok', text: `Version ${id} is now the draft. Check it in Website content, then publish it.` })
    } catch (e) {
      setNotice({ tone: 'error', text: e.message })
    }
  }

  return (
    <>
      <PageTitle title="Publish history" sub="Every version that has been published. Look at any of them, or load one back into the draft to undo later changes." />
      <div className="space-y-4">
        {notice && <div aria-live="polite"><Notice tone={notice.tone}>{notice.text}</Notice></div>}
        {error && <Notice tone="error">{error}</Notice>}
        {!list && !error && <div className="card"><Skeleton rows={4} /></div>}
        {list && list.length === 0 && <div className="card text-sm text-slate-600">Nothing has been published from the admin yet.</div>}
        {list && list.length > 0 && (
          <ol className="overflow-hidden surface">
            {list.map((p, i) => (
              <li key={p.id} className="flex flex-wrap items-center gap-4 px-5 py-4 even:bg-slate-50">
                <span className={`grid h-11 w-11 shrink-0 place-items-center text-sm tabular-nums ${i === 0 ? 'bg-navy text-amber' : 'border border-slate-200 bg-slate-50 text-slate-700'}`}>v{p.id}</span>
                <div className="min-w-0 flex-1 basis-60">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    Version {p.id}{i === 0 && <span className="badge badge-dot bg-emerald-50 text-emerald-700">Live</span>}
                  </p>
                  <p className="text-sm text-slate-600">{date(p.published_at)}, {time(p.published_at)} · {p.published_by || 'unknown'} · {STATUS[p.deploy_status]}</p>
                  {p.note && <p className="mt-1 break-words text-sm text-navy">“{p.note}”</p>}
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn-ghost" onClick={() => view(p.id)}><Eye size={15} aria-hidden="true" /> View</button>
                  {i > 0 && <button type="button" className="btn-ghost" onClick={() => restore(p.id)}><RotateCcw size={15} aria-hidden="true" /> Restore</button>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
      {viewing && <Preview content={viewing.content} title={`Version ${viewing.id}, published ${date(viewing.published_at)}, ${time(viewing.published_at)}`} onClose={() => setViewing(null)} />}
    </>
  )
}
