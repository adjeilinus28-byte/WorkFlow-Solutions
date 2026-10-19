import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Logo } from '../components/Layout'
import { Notice } from '../components/fields'

// The brand's W, drawn once as the page opens
function Motif() {
  const nodes = [[20, 30, 'ring'], [148, 260, 'hub'], [272, 120, 'ring-sm'], [396, 260, 'hub'], [524, 30, 'ring']]
  return (
    <svg viewBox="0 0 544 300" className="w-full max-w-[520px] overflow-visible" aria-hidden="true">
      <path d="M20 30 L148 260 L272 120 L396 260 L524 30" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="10" strokeLinejoin="round" />
      <path d="M20 30 L148 260 L272 120 L396 260 L524 30" pathLength="1" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1" className="animate-draw" />
      {nodes.map(([x, y, kind], i) => (
        <g key={i} className="animate-pop [transform-box:fill-box] [transform-origin:center]" style={{ animationDelay: `${0.35 + i * 0.25}s` }}>
          {kind === 'hub'
            ? <><circle cx={x} cy={y} r="26" fill="rgba(245,158,11,.14)" /><circle cx={x} cy={y} r="14" fill="#F59E0B" /><circle cx={x} cy={y} r="5" fill="#0B1120" /></>
            : <circle cx={x} cy={y} r={kind === 'ring' ? 12 : 9} fill="#0B1120" stroke="#CBD5E1" strokeWidth="2.5" />}
        </g>
      ))}
    </svg>
  )
}

function Shell({ title, sub, children }) {
  return (
    <div className="min-h-dvh bg-slate-50 lg:grid lg:grid-cols-[minmax(0,640px)_1fr]">
      <aside className="relative hidden overflow-hidden bg-navy-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="relative"><Logo tag="Admin" /></div>
        <div className="relative py-10"><Motif /></div>
        <div className="relative max-w-[520px]">
          <p className="text-balance font-display text-[46px] font-bold leading-[1.04] tracking-[-0.02em]">Change the site. See it. Publish it.</p>
          <p className="mt-5 text-lg leading-relaxed text-slate-300">Edit what workflow-app.net says, follow up every lead from the contact form, and publish — without touching code.</p>
        </div>
      </aside>
      <div className="flex min-h-dvh flex-col lg:min-h-0">
        <div className="bg-navy px-5 py-4 lg:hidden"><Logo tag="Admin" size="sm" /></div>
        <main id="main" className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-[420px] animate-fade-up bg-white p-7 sm:p-10">
            <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.02em]">{title}</h1>
            {sub && <p className="mt-1.5 text-[15px] text-slate-600">{sub}</p>}
            <div className="mt-6">{children}</div>
          </div>
        </main>
      </div>
    </div>
  )
}

export function SignIn() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [wrong, setWrong] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setMsg(null); setWrong(false)
    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) {
        if (/invalid/i.test(error.message)) { setWrong(true); document.getElementById('password')?.focus() }
        else setMsg({ tone: 'error', text: error.message })
      }
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/admin/` })
      setMsg(error ? { tone: 'error', text: error.message } : { tone: 'ok', text: 'If that email has a login, a reset link is on its way. Check your inbox.' })
    }
    setBusy(false)
  }

  return (
    <Shell title={mode === 'signin' ? 'Sign in' : 'Reset your password'}
      sub={mode === 'signin' ? 'Use the same login as the WFS ops platform.' : 'We’ll email you a link to choose a new password.'}>
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label htmlFor="email" className="label">Email address</label>
          <input id="email" type="email" autoComplete="username" spellCheck={false} required className="inp" placeholder="you@company.com…"
            aria-invalid={wrong || undefined} value={email} onChange={e => { setEmail(e.target.value); setWrong(false) }} />
        </div>
        {mode === 'signin' && (
          <div>
            <label htmlFor="password" className="label">Password</label>
            <input id="password" type="password" autoComplete="current-password" required className="inp"
              aria-invalid={wrong || undefined} aria-describedby={wrong ? 'password-err' : undefined} value={password} onChange={e => { setPassword(e.target.value); setWrong(false) }} />
            {wrong && <p id="password-err" className="mt-2 text-sm text-red-700">That email and password don’t match. Check both, or reset your password below.</p>}
          </div>
        )}
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        <button type="submit" className="btn-primary min-h-[48px] w-full text-[15px]" disabled={busy}>
          {busy ? 'One moment…' : mode === 'signin' ? <>Sign in <ArrowRight size={16} aria-hidden="true" /></> : 'Send reset link'}
        </button>
      </form>
      <button type="button" className="link mt-5"
        onClick={() => { setMode(m => (m === 'signin' ? 'reset' : 'signin')); setMsg(null); setWrong(false) }}>
        {mode === 'signin' ? 'Forgot your password?' : 'Back to sign in'}
      </button>
      <p className="mt-8 bg-slate-100 p-4 text-[13px] leading-relaxed text-slate-600">
        Access is granted per person by a website admin. An ops-platform role doesn’t give access here, and a website role gives nothing in the ops platform.
      </p>
    </Shell>
  )
}

export function SetPassword() {
  const { passwordSet } = useAuth()
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (password.length < 10) return setMsg('Use at least 10 characters.')
    if (password !== again) return setMsg('The two passwords don’t match.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return setMsg(error.message)
    passwordSet()
  }

  return (
    <Shell title="Choose your password" sub="You’ll use it with your email to sign in.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="new-password" className="label">New password</label>
          <input id="new-password" type="password" autoComplete="new-password" required className="inp" value={password} onChange={e => setPassword(e.target.value)} />
          <p className="help">At least 10 characters.</p>
        </div>
        <div>
          <label htmlFor="new-password-2" className="label">Type it again</label>
          <input id="new-password-2" type="password" autoComplete="new-password" required className="inp" value={again} onChange={e => setAgain(e.target.value)} />
        </div>
        {msg && <Notice tone="error">{msg}</Notice>}
        <button type="submit" className="btn-primary min-h-[48px] w-full" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
      </form>
    </Shell>
  )
}

export function NoAccess() {
  const { me, error, signOut } = useAuth()
  return (
    <Shell title={error ? 'Something went wrong' : 'No access yet'}>
      <div className="space-y-4 text-sm text-slate-700">
        {error
          ? <Notice tone="error">{error}</Notice>
          : <p>You’re signed in as <strong className="break-all">{me?.email}</strong>, but this login hasn’t been given access to the website admin. Ask an admin to add you under People.</p>}
        <button type="button" className="btn-ghost w-full" onClick={signOut}>Sign out</button>
      </div>
    </Shell>
  )
}
