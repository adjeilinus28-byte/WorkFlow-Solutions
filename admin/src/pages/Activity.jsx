import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CloudUpload, Inbox, Pencil, RotateCcw, Trash2, Users } from 'lucide-react'
import { dayLabel, rpc, STATUS_LABELS, time } from '../lib/api'
import { PageTitle } from '../components/Layout'
import { Notice, Skeleton } from '../components/fields'

const SECTION = { announcement: 'announcement bar', hero: 'headline', products: 'products', video: 'video', pricing: 'pricing', faq: 'FAQ', contact: 'contact details' }

export function describe({ action, detail: d = {} }) {
  switch (action) {
    case 'content.save': return `saved the ${SECTION[d.section] || d.section}`
    case 'content.restore': return `loaded version ${d.publication_id} back into the draft`
    case 'publish': return `published version ${d.publication_id}${d.note ? ` — “${d.note}”` : ''}`
    case 'lead.update': return d.from === d.to ? 'updated notes on a lead' : `moved a lead from ${STATUS_LABELS[d.from] || d.from} to ${STATUS_LABELS[d.to] || d.to}`
    case 'lead.delete': return 'deleted a lead'
    case 'user.add': return `gave ${d.email} ${d.role} access`
    case 'user.role': return `changed ${d.email} from ${d.from} to ${d.to}`
    case 'user.remove': return `removed ${d.email}’s access`
    default: return action
  }
}

export const KINDS = {
  publishing: { label: 'Publishing', test: a => a === 'publish' },
  content: { label: 'Content', test: a => a.startsWith('content.') },
  leads: { label: 'Leads', test: a => a.startsWith('lead.') },
  people: { label: 'People', test: a => a.startsWith('user.') },
}

export function ActivityIcon({ action }) {
  const Icon = action === 'publish' ? CloudUpload : action === 'content.restore' ? RotateCcw : action.startsWith('content.') ? Pencil
    : action === 'lead.delete' ? Trash2 : action.startsWith('lead.') ? Inbox : Users
  return <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-700"><Icon size={16} aria-hidden="true" /></span>
}

export function ActivityItem({ row, stamp }) {
  return (
    <li className="flex items-start gap-3.5 py-3">
      <ActivityIcon action={row.action} />
      <span className="min-w-0 pt-0.5">
        <span className="block break-words text-[15px] text-navy"><strong className="font-semibold">{row.user_email || 'Someone'}</strong> {describe(row)}</span>
        <span className="block text-sm text-slate-500">{stamp ? stamp(row.at) : time(row.at)}</span>
      </span>
    </li>
  )
}

const STEPS = [100, 300, 500]

export default function Activity() {
  const [params, setParams] = useSearchParams()
  const kind = KINDS[params.get('type')] ? params.get('type') : ''
  const [limit, setLimit] = useState(STEPS[0])
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { rpc('site_activity_list', { p_limit: limit }).then(setRows).catch(e => setError(e.message)) }, [limit])

  const shown = useMemo(() => (rows || []).filter(r => !kind || KINDS[kind].test(r.action)), [rows, kind])
  const groups = useMemo(() => {
    const out = []
    for (const r of shown) {
      const label = dayLabel(r.at)
      if (out.at(-1)?.label !== label) out.push({ label, rows: [] })
      out.at(-1).rows.push(r)
    }
    return out
  }, [shown])
  const more = rows && rows.length >= limit && limit < STEPS.at(-1)
  const setKind = k => setParams(p => { const n = new URLSearchParams(p); if (k) n.set('type', k); else n.delete('type'); return n }, { replace: true })

  return (
    <>
      <PageTitle title="Activity log" sub="Every change made in the admin, newest first." />
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Show">
        {[['', 'All', rows?.length], ...Object.entries(KINDS).map(([k, v]) => [k, v.label, rows?.filter(r => v.test(r.action)).length])].map(([k, label, n]) => (
          <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>
            {label}{rows && <>{' '}<span className="chip-count">{n}{rows.length >= limit ? '+' : ''}</span></>}
          </button>
        ))}
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {!rows && !error && <div className="card"><Skeleton rows={5} /></div>}
      {rows && (
        <section className="card" aria-label="Activity">
          {shown.length === 0 && <p className="text-sm text-slate-600">{kind ? 'Nothing of this kind yet.' : 'Nothing yet.'}</p>}
          {groups.map(g => (
            <div key={g.label} className="mb-3 last:mb-0">
              <h2 className="col-head mb-1 mt-2">{g.label}</h2>
              <ol>{g.rows.map(r => <ActivityItem key={r.id} row={r} />)}</ol>
            </div>
          ))}
          {more && (
            <div className="mt-3 flex justify-center">
              <button type="button" className="btn-ghost" onClick={() => setLimit(STEPS[STEPS.indexOf(limit) + 1])}>Show older activity</button>
            </div>
          )}
        </section>
      )}
    </>
  )
}
