import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, FileText, Inbox } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { can, rpc, STATUS_LABELS, when } from '../lib/api'
import { PageTitle } from '../components/Layout'
import { Notice } from '../components/fields'
import PublishPanel from '../components/PublishPanel'
import { useDraft } from '../lib/content'

export default function Overview() {
  const { me } = useAuth()
  const first = (me?.email || '').split('@')[0]
  return (
    <>
      <PageTitle title={`Hello${first ? `, ${first}` : ''}`} sub="Change what workflow-app.net says, publish it, and follow up the people who get in touch." />
      <div className="space-y-6">
        {can.content(me?.role) && <ContentSummary />}
        {can.leads(me?.role) && <LeadsSummary />}
      </div>
    </>
  )
}

function ContentSummary() {
  const draft = useDraft()
  if (draft.error) return <Notice tone="error">{draft.error}</Notice>
  if (draft.loading) return <p className="text-sm text-slate-500">Loading the website content…</p>
  return (
    <>
      <PublishPanel />
      <Link to="/content" className="card flex items-center justify-between gap-4 transition hover:border-amber-600">
        <span className="flex items-center gap-3">
          <FileText className="text-amber-700" size={20} aria-hidden="true" />
          <span>
            <span className="block font-semibold">Edit website content</span>
            <span className="block text-sm text-slate-600">Announcement bar, headline, products, pricing, FAQ, contact details and video.</span>
          </span>
        </span>
        <ArrowRight size={18} aria-hidden="true" />
      </Link>
    </>
  )
}

function LeadsSummary() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { rpc('site_leads_list', { p_limit: 5 }).then(setData).catch(e => setError(e.message)) }, [])
  if (error) return <Notice tone="error">{error}</Notice>
  const counts = data?.counts || {}
  return (
    <section className="card" aria-labelledby="leads-title">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="leads-title" className="flex items-center gap-2 font-display text-lg font-extrabold"><Inbox size={18} aria-hidden="true" /> Leads</h2>
        <Link to="/leads" className="text-sm font-semibold text-amber-700 underline">Open the inbox</Link>
      </div>
      {!data ? <p className="text-sm text-slate-500">Loading…</p> : (
        <>
          <dl className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {['new', 'contacted', 'demo_booked', 'won'].map(s => (
              <div key={s} className="rounded-lg bg-slate-50 p-3">
                <dt className="text-xs text-slate-600">{STATUS_LABELS[s]}</dt>
                <dd className="font-display text-2xl font-extrabold">{counts[s] || 0}</dd>
              </div>
            ))}
          </dl>
          {data.leads.length === 0
            ? <p className="text-sm text-slate-600">No messages yet. They'll appear here as soon as someone uses the contact form.</p>
            : (
              <ul className="divide-y divide-slate-100">
                {data.leads.map(l => (
                  <li key={l.id}>
                    <Link to={`/leads?open=${l.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-amber-700">
                      <span className="min-w-0 truncate"><strong>{l.first_name} {l.last_name}</strong>{l.organisation ? ` · ${l.organisation}` : ''}</span>
                      <span className="shrink-0 text-xs text-slate-500">{STATUS_LABELS[l.status]} · {when(l.created_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
        </>
      )}
    </section>
  )
}
