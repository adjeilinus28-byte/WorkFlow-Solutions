import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Activity, ExternalLink, FileText, History, Inbox, LayoutDashboard, LogOut, Menu, Users, X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { can } from '../lib/api'
import { SITE_URL } from '../lib/supabase'

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, show: () => true, end: true },
  { to: '/content', label: 'Website content', icon: FileText, show: can.content },
  { to: '/history', label: 'Publish history', icon: History, show: can.content },
  { to: '/leads', label: 'Leads', icon: Inbox, show: can.leads },
  { to: '/people', label: 'People', icon: Users, show: can.people },
  { to: '/activity', label: 'Activity log', icon: Activity, show: can.people },
]

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 60 42" className="h-7 w-10" aria-hidden="true">
        <polyline points="5,6 17,36 30,18 43,36 55,6" fill="none" stroke="#CBD5E1" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="5" cy="6" r="4" fill="none" stroke="#CBD5E1" strokeWidth="1.8" />
        <circle cx="30" cy="18" r="3.2" fill="none" stroke="#94A3B8" strokeWidth="1.6" />
        <circle cx="55" cy="6" r="4" fill="none" stroke="#CBD5E1" strokeWidth="1.8" />
        <circle cx="17" cy="36" r="5.5" fill="#F59E0B" /><circle cx="17" cy="36" r="2.1" fill="#0F172A" />
        <circle cx="43" cy="36" r="5.5" fill="#F59E0B" /><circle cx="43" cy="36" r="2.1" fill="#0F172A" />
      </svg>
      <span className="whitespace-nowrap font-display text-[15px] font-extrabold tracking-tight text-white">WorkFlow <span className="text-amber">admin</span></span>
    </span>
  )
}

export default function Layout() {
  const { me, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const links = NAV.filter(n => n.show(me?.role))

  const nav = (
    <nav aria-label="Admin sections" className="flex flex-col gap-1">
      {links.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}
          className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}>
          <Icon size={17} aria-hidden="true" /> {label}
        </NavLink>
      ))}
      <a href={SITE_URL} target="_blank" rel="noopener noreferrer"
        className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white">
        <ExternalLink size={17} aria-hidden="true" /> View the live site
      </a>
    </nav>
  )
  const account = (
    <div className="border-t border-white/10 pt-4 text-sm">
      <p className="truncate text-slate-200" title={me?.email}>{me?.email}</p>
      <p className="mb-3 text-xs capitalize text-slate-400">{me?.role}</p>
      <button type="button" onClick={signOut} className="flex items-center gap-2 text-slate-300 hover:text-white"><LogOut size={15} /> Sign out</button>
    </div>
  )

  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden w-64 shrink-0 flex-col justify-between bg-navy p-5 lg:sticky lg:top-0 lg:flex lg:h-screen">
        <div className="space-y-8"><Logo />{nav}</div>
        {account}
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between bg-navy px-4 py-3 lg:hidden">
        <Logo />
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label="Menu" className="rounded-md p-1.5 text-white">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>
      {open && <div className="sticky top-[52px] z-20 space-y-6 bg-navy px-4 pb-5 lg:hidden">{nav}{account}</div>}

      <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:py-10">
        <div className="mx-auto max-w-5xl"><Outlet /></div>
      </main>
    </div>
  )
}

export function PageTitle({ title, sub, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-sm text-slate-600">{sub}</p>}
      </div>
      {children}
    </div>
  )
}
