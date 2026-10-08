import { useEffect, useState } from 'react'
import { rpc, STATUS_LABELS, when } from '../lib/api'
import { PageTitle } from '../components/Layout'
import { Notice } from '../components/fields'

const SECTION = { announcement: 'announcement bar', hero: 'top of the page', products: 'products', video: 'video', pricing: 'pricing', faq: 'FAQ', contact: 'contact details' }

function describe({ action, detail: d = {} }) {
  switch (action) {
    case 'content.save': return `saved the ${SECTION[d.section] || d.section}`
    case 'content.restore': return `loaded version ${d.publication_id} back into the draft`
    case 'publish': return `published version ${d.publication_id}${d.note ? ` — “${d.note}”` : ''}`
    case 'lead.update': return d.from === d.to ? 'updated notes on a lead' : `moved a lead from ${STATUS_LABELS[d.from] || d.from} to ${STATUS_LABELS[d.to] || d.to}`
    case 'lead.delete': return 'deleted a lead'
    case 'user.add': return `gave ${d.email} ${d.role} access`
    case 'user.role': return `changed ${d.email} from ${d.from} to ${d.to}`
    case 'user.remove': return `removed ${d.email}'s access`
    default: return action
  }
}

export default function Activity() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { rpc('site_activity_list', { p_limit: 300 }).then(setRows).catch(e => setError(e.message)) }, [])
  return (
    <>
      <PageTitle title="Activity log" sub="Who did what in this admin, newest first." />
      {error && <Notice tone="error">{error}</Notice>}
      {rows && rows.length === 0 && <p className="text-sm text-slate-600">Nothing yet.</p>}
      {rows && rows.length > 0 && (
        <ol className="card divide-y divide-slate-100 p-0">
          {rows.map(r => (
            <li key={r.id} className="flex flex-wrap justify-between gap-2 px-5 py-3 text-sm">
              <span><strong>{r.user_email || 'Someone'}</strong> {describe(r)}</span>
              <span className="text-slate-500">{when(r.at)}</span>
            </li>
          ))}
        </ol>
      )}
    </>
  )
}
