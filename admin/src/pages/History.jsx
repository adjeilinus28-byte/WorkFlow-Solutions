import { useEffect, useState } from 'react'
import { Eye, RotateCcw } from 'lucide-react'
import { rpc, when } from '../lib/api'
import { useDraft } from '../lib/content'
import { PageTitle } from '../components/Layout'
import { Notice } from '../components/fields'
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
      setNotice({ tone: 'ok', text: `Version ${id} is now the draft. Check it in Website content, then publish it from the Overview.` })
    } catch (e) {
      setNotice({ tone: 'error', text: e.message })
    }
  }

  return (
    <>
      <PageTitle title="Publish history" sub="Every version that has been published. Look at any of them, or load one back into the draft to undo later changes." />
      <div className="space-y-4">
        {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        {list && list.length === 0 && <p className="text-sm text-slate-600">Nothing has been published from the admin yet.</p>}
        {list && list.length > 0 && (
          <ol className="card divide-y divide-slate-100 p-0">
            {list.map((p, i) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="font-semibold">
                    Version {p.id}{i === 0 && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Live</span>}
                  </p>
                  <p className="text-sm text-slate-600">{when(p.published_at)} · {p.published_by || 'unknown'} · {STATUS[p.deploy_status]}</p>
                  {p.note && <p className="mt-1 text-sm text-navy">“{p.note}”</p>}
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn-ghost" onClick={() => view(p.id)}><Eye size={15} /> View</button>
                  <button type="button" className="btn-ghost" onClick={() => restore(p.id)}><RotateCcw size={15} /> Restore</button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
      {viewing && <Preview content={viewing.content} title={`Version ${viewing.id}, published ${when(viewing.published_at)}`} onClose={() => setViewing(null)} />}
    </>
  )
}
