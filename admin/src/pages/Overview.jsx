import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, TrendingDown, TrendingUp } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { can, date, initials, OPEN_STATUSES, rpc, STATUS_LABELS, STATUS_TONES, when } from '../lib/api'
import { PageTitle } from '../components/Layout'
import { Notice, Skeleton } from '../components/fields'
import { ChangesCard } from '../components/Publish'
import { useDraft } from '../lib/content'
import { ActivityItem } from './Activity'

const WEEK = 7 * 24 * 3600 * 1000

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

// Monday 00:00 of the week a date falls in
function weekStart(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

export default function Overview() {
  const { me } = useAuth()
  const role = me?.role
  const [leads, setLeads] = useState(null)
  const [activity, setActivity] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (can.leads(role)) rpc('site_leads_list', { p_limit: 500 }).then(setLeads).catch(e => setError(e.message))
    if (can.people(role)) rpc('site_activity_list', { p_limit: 4 }).then(setActivity).catch(() => setActivity([]))
  }, [role])

  return (
    <>
      <PageTitle title={greeting()} sub="Here’s what’s happening on workflow-app.net.">
        {can.content(role) && <LivePill />}
      </PageTitle>
      {error && <div className="mb-6"><Notice tone="error">{error}</Notice></div>}
      <div className="space-y-6">
        <Tiles role={role} leads={leads} />
        {can.leads(role) && (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <LeadsChart leads={leads} />
            <RecentLeads leads={leads} />
          </div>
        )}
        {(can.content(role) || can.people(role)) && (
          <div className={`grid grid-cols-[minmax(0,1fr)] gap-6 ${can.content(role) && can.people(role) ? 'xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]' : ''}`}>
            {can.content(role) && <ContentChanges />}
            {can.people(role) && <RecentActivity rows={activity} />}
          </div>
        )}
      </div>
    </>
  )
}

function LivePill() {
  const draft = useDraft()
  const pub = draft.saved?.published
  if (!pub) return null
  return (
    <span className="badge badge-dot bg-emerald-50 px-3 py-1.5 text-sm text-emerald-700">Live · version {pub.id}</span>
  )
}

function ContentChanges() {
  const draft = useDraft()
  if (draft.error) return <Notice tone="error">{draft.error}</Notice>
  if (draft.loading) return <div className="card"><Skeleton rows={2} /></div>
  return <ChangesCard />
}

function Tile({ label, value, foot, children, to }) {
  const body = (
    <>
      <p className="text-sm text-slate-600">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="font-display text-[32px] font-bold leading-none tabular-nums tracking-[-0.02em] text-navy">{value}</p>
        {children}
      </div>
      {foot && <p className="mt-3 text-[13px] text-slate-600">{foot}</p>}
    </>
  )
  return to
    ? <Link to={to} className="card block animate-fade-up p-5 transition-[transform,border-color] duration-700 ease-fluid hover:-translate-y-1 hover:border-navy/[.14]">{body}</Link>
    : <div className="card animate-fade-up p-5">{body}</div>
}

function Spark({ values }) {
  const max = Math.max(1, ...values)
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 96 + 2},${30 - (v / max) * 26}`).join(' ')
  const last = pts.split(' ').at(-1).split(',')
  return (
    <svg viewBox="0 0 100 34" className="h-9 w-24 shrink-0" aria-hidden="true">
      <polyline points={pts} fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="3" fill="#F59E0B" />
    </svg>
  )
}

function Delta({ now, before, unit = 'vs last week' }) {
  const d = now - before
  if (!d) return <span className="text-slate-600">Same as last week</span>
  const Icon = d > 0 ? TrendingUp : TrendingDown
  return <span className={`inline-flex items-center gap-1 ${d > 0 ? 'text-emerald-700' : 'text-slate-600'}`}><Icon size={14} aria-hidden="true" /> {d > 0 ? '+' : '−'}{Math.abs(d)} {unit}</span>
}

function Tiles({ role, leads }) {
  const draft = useDraft()
  const weeks = useWeeks(leads)
  const tiles = []
  if (can.leads(role)) {
    const counts = leads?.counts || {}
    const open = OPEN_STATUSES.reduce((n, s) => n + (counts[s] || 0), 0)
    tiles.push(
      <Tile key="new" label="New leads this week" to="/leads" value={leads ? weeks.at(-1).count : '–'}
        foot={leads && <Delta now={weeks.at(-1).count} before={weeks.at(-2).count} />}>
        {leads && <Spark values={weeks.map(w => w.count)} />}
      </Tile>,
      <Tile key="open" label="Open leads" to="/leads" value={leads ? open : '–'}
        foot={leads && (counts.new ? `${counts.new} not contacted yet` : 'Everyone has had a reply')} />,
    )
  }
  if (can.content(role)) {
    const pub = draft?.saved?.published
    const health = !pub ? ['Original', 'Nothing published from here yet']
      : pub.deploy_status === 'triggered' ? ['Healthy', 'Rebuilt by Netlify after publishing']
      : pub.deploy_status === 'pending' ? ['Updating', 'Waiting to be sent to Netlify']
      : ['Check it', pub.deploy_status === 'no_hook' ? 'The build hook isn’t set up' : 'Netlify couldn’t be reached']
    tiles.push(
      <Tile key="pub" label="Published version" to="/history" value={draft?.saved ? (pub ? `v${pub.id}` : '–') : '…'}
        foot={pub && `${date(pub.published_at)}${pub.published_by ? ` by ${pub.published_by}` : ''}`} />,
      <Tile key="live" label="Live site" value={draft?.saved ? health[0] : '…'} foot={draft?.saved && health[1]} />,
    )
  }
  if (!tiles.length) return null
  return <div className={`grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 ${tiles.length > 2 ? 'xl:grid-cols-4' : ''}`}>{tiles}</div>
}

// The last 8 weeks, Monday to Sunday, oldest first
function useWeeks(leads) {
  return useMemo(() => {
    const start = weekStart(new Date())
    const weeks = Array.from({ length: 8 }, (_, i) => ({ from: new Date(start.getTime() - (7 - i) * WEEK), count: 0 }))
    for (const l of leads?.leads || []) {
      const i = Math.floor((new Date(l.created_at) - weeks[0].from) / WEEK)
      if (i >= 0 && i < 8) weeks[i].count++
    }
    return weeks
  }, [leads])
}

function LeadsChart({ leads }) {
  const weeks = useWeeks(leads)
  const [table, setTable] = useState(false)
  const max = Math.max(4, ...weeks.map(w => w.count))
  const top = Math.ceil(max / 2) * 2
  const summary = weeks.map(w => `${date(w.from)}: ${w.count}`).join(', ')
  return (
    <section className="card" aria-labelledby="chart-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="chart-title" className="card-title">New leads per week</h2>
          <p className="mt-0.5 text-sm text-slate-600">Last 8 weeks · this week so far in amber</p>
        </div>
        <button type="button" className="link" onClick={() => setTable(t => !t)} aria-pressed={table}>{table ? 'View as chart' : 'View as table'}</button>
      </div>
      {!leads ? <div role="status" className="mt-6 flex h-40 items-end gap-2"><span className="sr-only">Loading…</span>{[40, 65, 30, 80, 55, 70, 45, 90].map((h, i) => <span key={i} aria-hidden="true" className="skel flex-1" style={{ height: `${h}%` }} />)}</div> : table ? (
        <table className="mt-5 w-full text-sm">
          <thead><tr className="col-head text-left"><th className="py-2 font-normal">Week starting</th><th className="py-2 text-right font-normal">New leads</th></tr></thead>
          <tbody className="[&>*:nth-child(even)]:bg-slate-50">
            {weeks.map((w, i) => <tr key={i}><td className="py-2">{date(w.from)}{i === 7 && ' (this week)'}</td><td className="py-2 text-right tabular-nums">{w.count}</td></tr>)}
          </tbody>
        </table>
      ) : (
        <div className="mt-6" role="img" aria-label={`New leads per week, oldest first: ${summary}`}>
          <div className="relative h-44">
            {[0, 0.5, 1].map(f => (
              <div key={f} className="absolute inset-x-0 flex items-center gap-2" style={{ bottom: `${f * 100}%` }}>
                <span className="w-4 -translate-y-1/2 text-right text-[13px] tabular-nums text-slate-500">{f ? top * f : ''}</span>
                <span className="h-px flex-1 bg-slate-100" />{/* taste-skill-ignore: chart gridline */}
              </div>
            ))}
            <div className="absolute inset-y-0 left-6 right-0 flex items-end justify-around gap-2">
              {weeks.map((w, i) => (
                <div key={i} className="relative flex h-full w-full max-w-[36px] flex-col justify-end">
                  {i === 7 && <span className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap text-xs font-semibold text-amber-700">{w.count} this week</span>}
                  <div className={`origin-bottom animate-grow ${i === 7 ? 'bg-amber-600' : 'bg-slate-400'}`}
                    style={{ height: `${(w.count / top) * 100}%`, minHeight: w.count ? 4 : 0, animationDelay: `${i * 50}ms` }} />
                </div>
              ))}
            </div>
          </div>
          <div className="ml-6 mt-2 flex justify-around gap-2 pt-2">
            {weeks.map((w, i) => <span key={i} className="w-full max-w-[36px] text-center text-[13px] leading-tight text-slate-500">{date(w.from)}</span>)}
          </div>
        </div>
      )}
    </section>
  )
}

export function StatusBadge({ status }) {
  return <span className={`badge badge-dot ${STATUS_TONES[status]}`}>{STATUS_LABELS[status]}</span>
}

function RecentLeads({ leads }) {
  return (
    <section className="card" aria-labelledby="recent-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="recent-title" className="card-title">Recent leads</h2>
        <Link to="/leads" className="link">Open inbox <ArrowRight size={15} aria-hidden="true" /></Link>
      </div>
      {!leads ? <Skeleton rows={3} className="mt-5" />
        : leads.leads.length === 0 ? <p className="mt-4 text-sm text-slate-600">No messages yet. They appear here as soon as someone uses the contact form.</p>
        : (
          <ul className="mt-3">
            {leads.leads.slice(0, 4).map(l => (
              <li key={l.id}>
                <Link to={`/leads?open=${l.id}`} className="group flex items-center gap-3 py-2.5">
                  <span className="avatar">{initials(`${l.first_name} ${l.last_name}`)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-navy group-hover:text-amber-700">{l.first_name} {l.last_name}</span>
                    <span className="block truncate text-[13px] text-slate-600">{l.organisation ? `${l.organisation} · ` : ''}{when(l.created_at)}</span>
                  </span>
                  <StatusBadge status={l.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
    </section>
  )
}

function RecentActivity({ rows }) {
  return (
    <section className="card" aria-labelledby="activity-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="activity-title" className="card-title">Activity</h2>
        <Link to="/activity" className="link">All activity <ArrowRight size={15} aria-hidden="true" /></Link>
      </div>
      {!rows ? <Skeleton rows={3} className="mt-5" />
        : rows.length === 0 ? <p className="mt-4 text-sm text-slate-600">Nothing yet.</p>
        : <ol className="mt-2">{rows.map(r => <ActivityItem key={r.id} row={r} stamp={when} />)}</ol>}
    </section>
  )
}
