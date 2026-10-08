import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, Mail, Search, Trash2, X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { rpc, STATUS_LABELS, when } from '../lib/api'
import { PageTitle } from '../components/Layout'
import { Notice } from '../components/fields'

const BADGE = {
  new: 'bg-amber-100 text-amber-900', contacted: 'bg-sky-100 text-sky-900', demo_booked: 'bg-violet-100 text-violet-900',
  trial: 'bg-indigo-100 text-indigo-900', won: 'bg-emerald-100 text-emerald-900', lost: 'bg-slate-200 text-slate-700', spam: 'bg-red-100 text-red-800',
}

function csv(leads) {
  const cols = ['created_at', 'first_name', 'last_name', 'email', 'organisation', 'inquiry_type', 'status', 'message', 'notes']
  const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  return [cols.join(','), ...leads.map(l => cols.map(c => cell(l[c])).join(','))].join('\r\n')
}

export default function Leads() {
  const { me } = useAuth()
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState(params.get('status') || '')
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const openId = params.get('open')

  const load = () => rpc('site_leads_list', { p_status: status || null, p_search: search || null, p_limit: 500 })
    .then(d => { setData(d); setError('') }).catch(e => setError(e.message))
  useEffect(() => { load() }, [status, search])   // eslint-disable-line react-hooks/exhaustive-deps

  const open = data?.leads.find(l => l.id === openId)
  const setOpen = id => setParams(p => { const n = new URLSearchParams(p); if (id) n.set('open', id); else n.delete('open'); return n })
  const total = Object.values(data?.counts || {}).reduce((a, b) => a + b, 0)

  function download() {
    const blob = new Blob(['﻿' + csv(data.leads)], { type: 'text/csv;charset=utf-8' })
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `leads-${new Date().toISOString().slice(0, 10)}.csv` })
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <>
      <PageTitle title="Leads" sub="Everyone who used the contact form on workflow-app.net.">
        {data?.leads.length > 0 && <button type="button" className="btn-ghost" onClick={download}><Download size={15} /> Download CSV</button>}
      </PageTitle>

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {[['', `All (${total})`], ...Object.entries(STATUS_LABELS).map(([k, v]) => [k, `${v} (${data?.counts?.[k] || 0})`])].map(([k, label]) => (
          <button key={k} type="button" aria-pressed={status === k} onClick={() => setStatus(k)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${status === k ? 'bg-navy text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-slate-400'}`}>
            {label}
          </button>
        ))}
      </div>
      <form className="mb-5 flex gap-2" onSubmit={e => { e.preventDefault(); setSearch(query.trim()) }} role="search">
        <label htmlFor="lead-search" className="sr-only">Search leads</label>
        <input id="lead-search" className="inp" placeholder="Search names, emails, organisations, messages" value={query} onChange={e => setQuery(e.target.value)} />
        <button type="submit" className="btn-dark"><Search size={15} /> Search</button>
      </form>

      {error && <Notice tone="error">{error}</Notice>}
      {!data && !error && <p className="text-sm text-slate-500">Loading…</p>}
      {data && data.leads.length === 0 && <p className="text-sm text-slate-600">{search || status ? 'No leads match.' : 'No messages yet.'}</p>}
      {data && data.leads.length > 0 && (
        <ul className="card divide-y divide-slate-100 p-0">
          {data.leads.map(l => (
            <li key={l.id}>
              <button type="button" onClick={() => setOpen(l.id)} className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-slate-50">
                <span className="min-w-0">
                  <span className="block font-semibold">{l.first_name} {l.last_name}{l.organisation && <span className="font-normal text-slate-600"> · {l.organisation}</span>}</span>
                  <span className="block truncate text-sm text-slate-600">{l.inquiry_type ? `${l.inquiry_type} — ` : ''}{l.message}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-slate-500">{when(l.created_at)}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE[l.status]}`}>{STATUS_LABELS[l.status]}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && <LeadPanel lead={open} canDelete={me?.role === 'admin'} onClose={() => setOpen(null)} onChanged={load} />}
    </>
  )
}

function LeadPanel({ lead, canDelete, onClose, onChanged }) {
  const [status, setStatus] = useState(lead.status)
  const [notes, setNotes] = useState(lead.notes || '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const closeRef = useRef(null)
  useEffect(() => { closeRef.current?.focus() }, [lead.id])
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const changed = status !== lead.status || notes !== (lead.notes || '')
  async function save() {
    setBusy(true); setMsg(null)
    try {
      await rpc('site_lead_update', { p_id: lead.id, p_status: status, p_notes: notes })
      await onChanged()
      setMsg({ tone: 'ok', text: 'Saved.' })
    } catch (e) { setMsg({ tone: 'error', text: e.message }) } finally { setBusy(false) }
  }
  async function remove() {
    if (!confirm(`Delete ${lead.first_name} ${lead.last_name}'s message for good? Use this for spam or when someone asks to be erased.`)) return
    setBusy(true)
    try { await rpc('site_lead_delete', { p_id: lead.id }); await onChanged(); onClose() } catch (e) { setMsg({ tone: 'error', text: e.message }); setBusy(false) }
  }

  const subject = encodeURIComponent(`Re: your message to WorkFlow Solutions${lead.inquiry_type ? ` (${lead.inquiry_type})` : ''}`)
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/40" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-labelledby="lead-title" className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 id="lead-title" className="font-display text-xl font-extrabold">{lead.first_name} {lead.last_name}</h2>
            <p className="text-sm text-slate-600">{lead.organisation || 'No organisation given'} · {when(lead.created_at)}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 hover:bg-slate-100"><X size={20} /></button>
        </div>
        <dl className="mb-5 space-y-2 text-sm">
          <div><dt className="inline font-medium text-slate-600">Email: </dt><dd className="inline"><a className="text-amber-700 underline" href={`mailto:${lead.email}`}>{lead.email}</a></dd></div>
          {lead.inquiry_type && <div><dt className="inline font-medium text-slate-600">Needs: </dt><dd className="inline">{lead.inquiry_type}</dd></div>}
          {lead.updated_by && <div><dt className="inline font-medium text-slate-600">Last updated: </dt><dd className="inline">{when(lead.updated_at)} by {lead.updated_by}</dd></div>}
        </dl>
        <div className="mb-5 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm">{lead.message}</div>
        <a className="btn-dark mb-6 w-full" href={`mailto:${lead.email}?subject=${subject}`}><Mail size={15} /> Reply by email</a>

        <div className="space-y-4">
          <div>
            <label htmlFor="lead-status" className="label">Status</label>
            <select id="lead-status" className="inp" value={status} onChange={e => setStatus(e.target.value)}>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="lead-notes" className="label">Notes (only your team sees these)</label>
            <textarea id="lead-notes" className="inp" rows={5} maxLength={5000} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Called Tuesday, demo booked for the 14th" />
          </div>
          {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
          <div className="flex flex-wrap justify-between gap-2">
            <button type="button" className="btn-primary" disabled={!changed || busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
            {canDelete && <button type="button" className="btn-danger" disabled={busy} onClick={remove}><Trash2 size={15} /> Delete</button>}
          </div>
        </div>
      </div>
    </div>
  )
}
