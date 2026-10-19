import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Activity, ExternalLink, FileText, History, Inbox, LayoutDashboard, LogOut, Menu, Users, X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { can, initials, rpc } from '../lib/api'
import { SITE_URL } from '../lib/supabase'

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, show: () => true, end: true },
  { to: '/content', label: 'Website content', icon: FileText, show: can.content },
  { to: '/history', label: 'Publish history', icon: History, show: can.content },
  { to: '/leads', label: 'Leads', icon: Inbox, show: can.leads, badge: true },
  { to: '/people', label: 'People', icon: Users, show: can.people },
  { to: '/activity', label: 'Activity log', icon: Activity, show: can.people },
]

// Pages that change leads announce it, so the sidebar count stays right
export const leadsChanged = () => window.dispatchEvent(new Event('leads-changed'))

export function Logo({ tag, size = 'md' }) {
  return (
    <span className={`flex min-w-0 items-center ${size === 'sm' ? 'gap-2' : 'gap-2.5'}`}>
      <svg viewBox="0 0 60 42" className={size === 'sm' ? 'h-5 w-7 shrink-0' : 'h-7 w-10 shrink-0'} aria-hidden="true">
        <polyline points="5,6 17,36 30,18 43,36 55,6" fill="none" stroke="#CBD5E1" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="5" cy="6" r="4" fill="none" stroke="#CBD5E1" strokeWidth="1.8" />
        <circle cx="30" cy="18" r="3.2" fill="none" stroke="#94A3B8" strokeWidth="1.6" />
        <circle cx="55" cy="6" r="4" fill="none" stroke="#CBD5E1" strokeWidth="1.8" />
        <circle cx="17" cy="36" r="5.5" fill="#F59E0B" /><circle cx="17" cy="36" r="2.1" fill="#FFFFFF" />
        <circle cx="43" cy="36" r="5.5" fill="#F59E0B" /><circle cx="43" cy="36" r="2.1" fill="#FFFFFF" />
      </svg>
      <span translate="no" className={`whitespace-nowrap font-display font-bold tracking-[-0.02em] text-white ${size === 'sm' ? 'text-[12px]' : 'text-[17px]'}`}>
        WorkFlow <span className="text-amber">Solutions</span>
      </span>
      {tag && <span className="bg-amber px-2 py-0.5 text-[13px] font-semibold text-navy">{tag}</span>}
    </span>
  )
}

function useNewLeads(role) {
  const [count, setCount] = useState(null)
  const { pathname } = useLocation()
  useEffect(() => {
    if (!can.leads(role)) return
    let live = true
    const load = () => rpc('site_leads_list', { p_limit: 1 }).then(d => { if (live) setCount(d.counts?.new || 0) }).catch(() => {})
    load()
    window.addEventListener('leads-changed', load)
    return () => { live = false; window.removeEventListener('leads-changed', load) }
  }, [role, pathname])
  return count
}

export default function Layout() {
  const { me, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const newLeads = useNewLeads(me?.role)
  const links = NAV.filter(n => n.show(me?.role))
  const menuBtn = useRef(null)
  const drawer = useRef(null)

  // The phone menu: focus goes in, Escape closes, focus comes back
  useEffect(() => {
    if (!open) return
    drawer.current?.querySelector('a')?.focus()
    const onKey = e => { if (e.key === 'Escape') { setOpen(false); menuBtn.current?.focus() } }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open])

  const nav = (
    <nav aria-label="Admin sections" className="flex flex-col gap-1">
      {links.map(({ to, label, icon: Icon, end, badge }) => (
        <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}
          className={({ isActive }) => `relative flex min-h-[42px] items-center gap-3 px-3 text-[15px] font-medium transition-colors ${isActive
            ? 'bg-white/[.08] text-white before:absolute before:-left-px before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-amber'
            : 'text-slate-300 hover:bg-white/[.04] hover:text-white'}`}>
          {({ isActive }) => (
            <>
              <Icon size={18} aria-hidden="true" className={isActive ? 'text-amber' : ''} />
              <span className="flex-1">{label}</span>
              {badge && newLeads > 0 && <span className="rounded-full bg-amber px-2 text-xs font-semibold leading-5 text-navy">{newLeads}<span className="sr-only"> new</span></span>}
            </>
          )}
        </NavLink>
      ))}
      <div className="h-6" />
      <a href={SITE_URL} target="_blank" rel="noopener noreferrer"
        className="flex min-h-[42px] items-center gap-3 px-3 text-[15px] font-medium text-slate-300 transition-colors hover:bg-white/[.04] hover:text-white">
        <ExternalLink size={18} aria-hidden="true" /> View the live site
      </a>
    </nav>
  )
  const account = (
    <div className="flex items-center gap-3 border bg-white/[.06] p-3">
      <span className="avatar">{initials(me?.email)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-white" title={me?.email}>{me?.email}</span>
        <span className="block text-xs capitalize text-slate-400">{me?.role}</span>
      </span>
      <button type="button" onClick={signOut} aria-label="Sign out" title="Sign out"
        className="grid h-9 w-9 place-items-center text-slate-300 transition-colors hover:bg-white/10 hover:text-white">
        <LogOut size={18} aria-hidden="true" />
      </button>
    </div>
  )

  return (
    <div className="min-h-dvh lg:flex">
      <a href="#main" className="skip-link">Skip to content</a>
      <aside className="hidden w-[260px] shrink-0 flex-col justify-between bg-navy px-4 py-6 lg:sticky lg:top-0 lg:flex lg:h-dvh">
        <div className="space-y-9"><div className="px-1"><Logo size="sm" /></div>{nav}</div>
        {account}
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-navy px-4 py-3 lg:hidden">
        <Logo size="sm" />
        <button ref={menuBtn} type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="admin-menu" aria-label="Open menu"
          className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white">
          <Menu size={20} aria-hidden="true" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-slate-900/60" onClick={() => setOpen(false)} aria-hidden="true" />
          <div ref={drawer} id="admin-menu" role="dialog" aria-modal="true" aria-label="Menu"
            className="absolute inset-y-0 left-0 flex w-[min(300px,85vw)] animate-slide-in flex-col justify-between overflow-y-auto overscroll-contain bg-navy px-4 py-5">
            <div className="space-y-8">
              <div className="flex items-center justify-between px-2">
                <Logo size="sm" />
                <button type="button" onClick={() => { setOpen(false); menuBtn.current?.focus() }} aria-label="Close menu"
                  className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white"><X size={18} aria-hidden="true" /></button>
              </div>
              {nav}
            </div>
            <div className="pt-6">{account}</div>
          </div>
        </div>
      )}

      <main id="main" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6 focus:outline-none sm:px-8 lg:px-10 lg:py-9">
        <div className="mx-auto max-w-6xl"><Outlet /></div>
      </main>
    </div>
  )
}

export function PageTitle({ title, sub, children }) {
  return (
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-balance font-display text-[28px] font-bold leading-tight tracking-[-0.02em] text-navy sm:text-[34px]">{title}</h1>
        {sub && <p className="mt-1.5 max-w-2xl text-pretty text-[15px] text-slate-600">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2.5">{children}</div>}
    </div>
  )
}
