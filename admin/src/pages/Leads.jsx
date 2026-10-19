import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Calendar, Download, Globe, Inbox, Mail, Search, Send, Trash2, X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { date, initials, rpc, STATUS_LABELS, time, when } from '../lib/api'
import { leadsChanged, PageTitle } from '../components/Layout'
import { Notice, Skeleton } from '../components/fields'
import { useModal } from '../components/Dialog'
import { StatusBadge } from './Overview'

function csv(leads) {
  const cols = ['created_at', 'first_name', 'last_name', 'email', 'organisation', 'inquiry_type', 'status', 'message', 'notes']
  const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  return [cols.join(','), ...leads.map(l => cols.map(c => cell(l[c])).join(','))].join('\r\n')
}

export default function Leads() {
  const { me } = useAuth()
  const [params, setParams] = useSearchParams()
  // Filters live in the address, so a filtered view can be bookmarked or shared
  const status = STATUS_LABELS[params.get('status')] ? params.get('status') : ''
  const search = params.get('q') || ''
  const openId = params.get('open')
  const [query, setQuery] = useState(search)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const load = () => rpc('site_leads_list', { p_status: status || null, p_search: search || null, p_limit: 500 })
    .then(d => { setData(d); setError('') }).catch(e => setError(e.message))
  useEffect(() => { load() }, [status, search])   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setQuery(search), [search])

  const set = (key, value) => setParams(p => { const n = new URLSearchParams(p); if (value) n.set(key, value); else n.delete(key); return n }, { replace: key !== 'open' })
  const open = data?.leads.find(l => l.id === openId)
  const total = Object.values(data?.counts || {}).reduce((a, b) => a + b, 0)

  function download() {
    const blob = new Blob(['﻿' + csv(data.leads)], { type: 'text/csv;charset=utf-8' })
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `leads-${new Date().toISOString().slice(0, 10)}.csv` })
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <>
      <PageTitle title="Leads" sub="Everything sent from the contact form. Reply, track progress and keep private notes.">
        {data?.leads.length > 0 && <button type="button" className="btn-ghost" onClick={download}><Download size={15} aria-hidden="true" /> Download CSV</button>}
      </PageTitle>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by status">
        {[['', 'All', total], ...Object.entries(STATUS_LABELS).map(([k, v]) => [k, v, data?.counts?.[k] || 0])].map(([k, label, n]) => (
          <button key={k} type="button" className="chip" aria-pressed={status === k} onClick={() => set('status', k)}>
            {label}{data && <>{' '}<span className="chip-count">{n}</span></>}
          </button>
        ))}
      </div>
      <form className="mb-5 flex gap-2" role="search" onSubmit={e => { e.preventDefault(); set('q', query.trim()) }}>
        <label htmlFor="lead-search" className="sr-only">Search leads</label>
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <input id="lead-search" type="search" className="inp pl-10" placeholder="Search names, emails, organisations, messages…" autoComplete="off"
            value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <button type="submit" className="btn-dark">Search</button>
        {search && <button type="button" className="btn-ghost" onClick={() => set('q', '')}>Clear</button>}
      </form>

      {error && <Notice tone="error">{error}</Notice>}
      {!data && !error && <div className="card"><Skeleton rows={5} /></div>}
      {data && data.leads.length === 0 && (
        <div className="card flex flex-col items-center gap-2 py-12 text-center">
          <Inbox size={28} className="text-slate-400" aria-hidden="true" />
          <p className="font-semibold">{search || status ? 'No leads match' : 'No messages yet'}</p>
          <p className="text-sm text-slate-600">{search || status ? 'Try another filter or search.' : 'They appear here as soon as someone uses the contact form.'}</p>
        </div>
      )}
      {data && data.leads.length > 0 && (
        <div className="overflow-hidden surface">
          <div aria-hidden="true" className="col-head hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_8.5rem_7rem] gap-4 bg-slate-100 px-5 py-3 md:grid">
            <span>Person</span><span>Organisation</span><span>Interested in</span><span>Status</span><span className="text-right">Received</span>
          </div>
          <ul aria-label="Leads">
            {data.leads.map(l => {
              const name = `${l.first_name} ${l.last_name}`
              return (
                <li key={l.id} className="row-cv even:bg-slate-50">
                  <button type="button" onClick={() => set('open', l.id)} aria-current={l.id === openId || undefined}
                    className="relative grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3.5 text-left transition-colors hover:bg-slate-50 aria-[current=true]:bg-amber-50/60 aria-[current=true]:before:absolute aria-[current=true]:before:inset-y-0 aria-[current=true]:before:left-0 aria-[current=true]:before:w-[3px] aria-[current=true]:before:bg-amber md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_8.5rem_7rem]">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="avatar">{initials(name)}</span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-navy">{name}</span>
                        <span className="block truncate text-[13px] text-slate-600">{l.email}</span>
                      </span>
                    </span>
                    <span className="hidden truncate text-sm text-slate-700 md:block">{l.organisation || '—'}</span>
                    <span className="hidden truncate text-sm text-slate-700 md:block">{l.inquiry_type || '—'}</span>
                    <span className="justify-self-end md:justify-self-start"><StatusBadge status={l.status} /></span>
                    <span className="col-span-2 truncate pl-12 text-[13px] text-slate-500 md:col-span-1 md:pl-0 md:text-right">{when(l.created_at)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="bg-slate-100 px-5 py-3 text-[13px] text-slate-600">
            Showing {data.leads.length} of {data.total ?? data.leads.length} · newest first
          </p>
        </div>
      )}

      {open && <LeadPanel key={open.id} lead={open} canDelete={me?.role === 'admin'} onClose={() => set('open', '')}
        onChanged={async () => { await load(); leadsChanged() }} />}
    </>
  )
}

function LeadPanel({ lead, canDelete, onClose, onChanged }) {
  const [notes, setNotes] = useState(lead.notes || '')
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState(null)
  const ref = useRef(null)
  const unsaved = notes !== (lead.notes || '')
  // Closing with notes typed but not saved asks first
  const close = () => { if (!unsaved || confirm('Close without saving your notes?')) onClose() }
  useModal(ref, close)

  async function update(status, what) {
    setBusy(what); setMsg(null)
    try {
      await rpc('site_lead_update', { p_id: lead.id, p_status: status, p_notes: what === 'notes' ? notes : lead.notes || '' })
      await onChanged()
      setMsg({ tone: 'ok', text: what === 'notes' ? 'Notes saved.' : `Marked as ${STATUS_LABELS[status]}.` })
    } catch (e) { setMsg({ tone: 'error', text: e.message }) } finally { setBusy('') }
  }
  async function remove() {
    if (!confirm(`Delete ${lead.first_name} ${lead.last_name}’s message for good? Use this for spam or when someone asks to be erased.`)) return
    setBusy('delete')
    try { await rpc('site_lead_delete', { p_id: lead.id }); await onChanged(); onClose() } catch (e) { setMsg({ tone: 'error', text: e.message }); setBusy('') }
  }

  const name = `${lead.first_name} ${lead.last_name}`
  const subject = encodeURIComponent(`Re: your message to WorkFlow Solutions${lead.inquiry_type ? ` (${lead.inquiry_type})` : ''}`)
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 animate-fade-in bg-slate-900/40" onClick={close} aria-hidden="true" />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="lead-title"
        className="relative flex h-full w-full max-w-[480px] animate-slide-in flex-col bg-white shadow-lift">
        <div className="flex items-start gap-4 px-6 py-5">
          <span className="avatar h-12 w-12 text-sm">{initials(name)}</span>
          <div className="min-w-0 flex-1">
            <h2 id="lead-title" className="break-words font-display text-[22px] font-bold leading-tight tracking-[-0.02em]">{name}</h2>
            <p className="truncate text-sm text-slate-600">{lead.organisation || 'No organisation given'}</p>
          </div>
          <button type="button" className="btn-icon" onClick={close} aria-label="Close"><X size={18} aria-hidden="true" /></button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-6 py-5">
          <div>
            <p className="label" id="status-label">Status</p>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="status-label">
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <button key={k} type="button" className="chip" aria-pressed={lead.status === k} disabled={!!busy}
                  onClick={() => lead.status !== k && update(k, 'status')}>{v}</button>
              ))}
            </div>
          </div>

          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2.5 text-sm">
            <dt className="flex items-center gap-2 text-slate-600"><Mail size={15} aria-hidden="true" /> Email</dt>
            <dd className="break-words"><a className="font-semibold text-amber-700 hover:underline" href={`mailto:${lead.email}`}>{lead.email}</a></dd>
            {lead.inquiry_type && <><dt className="flex items-center gap-2 text-slate-600"><Inbox size={15} aria-hidden="true" /> Wants</dt><dd>{lead.inquiry_type}</dd></>}
            <dt className="flex items-center gap-2 text-slate-600"><Calendar size={15} aria-hidden="true" /> Received</dt>
            <dd>{date(lead.created_at)}, {time(lead.created_at)}{Date.now() - new Date(lead.created_at) < 864e5 && <span className="text-slate-500"> ({when(lead.created_at)})</span>}</dd>
            {lead.source && <><dt className="flex items-center gap-2 text-slate-600"><Globe size={15} aria-hidden="true" /> Sent from</dt><dd className="break-words">{lead.source}</dd></>}
            {lead.updated_by && <><dt className="text-slate-600">Last updated</dt><dd className="break-words">{when(lead.updated_at)} by {lead.updated_by}</dd></>}
          </dl>

          <div>
            <p className="label">Message</p>
            <div className="whitespace-pre-wrap break-words bg-slate-50 p-4 text-[15px] leading-relaxed">{lead.message}</div>
          </div>

          <div>
            <label htmlFor="lead-notes" className="label">Private notes (only admins and sales see these)</label>
            <textarea id="lead-notes" className="inp resize-y" rows={5} maxLength={5000} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Called Tuesday, demo booked for the 14th…" />
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-[13px]">{unsaved && <span className="badge badge-dot px-0 text-amber-700">Unsaved changes</span>}</span>
              <button type="button" className="btn-dark min-h-[36px] px-3.5" disabled={!unsaved || !!busy} onClick={() => update(lead.status, 'notes')}>
                {busy === 'notes' ? 'Saving…' : 'Save notes'}
              </button>
            </div>
          </div>
          <div aria-live="polite">{msg && <Notice tone={msg.tone}>{msg.text}</Notice>}</div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 bg-slate-100 px-6 py-4">
          <a className="btn-primary" href={`mailto:${lead.email}?subject=${subject}`}>Reply by email <Send size={15} aria-hidden="true" /></a>
          {lead.status !== 'spam' && <button type="button" className="btn-ghost" disabled={!!busy} onClick={() => update('spam', 'status')}>Mark as spam</button>}
          {canDelete && (
            <button type="button" className="btn ml-auto px-2 text-red-700 hover:bg-red-50" disabled={!!busy} onClick={remove}>
              <Trash2 size={15} aria-hidden="true" /> {busy === 'delete' ? 'Deleting…' : 'Delete'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
