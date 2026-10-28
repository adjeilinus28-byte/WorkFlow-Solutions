import { useEffect, useState } from 'react'
import { ArrowRight, Check, Copy, Eye, EyeOff, ShieldCheck } from 'lucide-react'
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

// A password box with a button to show what's been typed
function PasswordField({ id, label, autoComplete, value, onChange, invalid, describedBy, help }) {
  const [shown, setShown] = useState(false)
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <div className="relative">
        <input id={id} type={shown ? 'text' : 'password'} autoComplete={autoComplete} required className="inp pr-12"
          spellCheck={false} autoCapitalize="off" aria-invalid={invalid || undefined} aria-describedby={describedBy}
          value={value} onChange={onChange} />
        <button type="button" onClick={() => setShown(s => !s)} aria-pressed={shown}
          aria-label={shown ? 'Hide password' : 'Show password'} title={shown ? 'Hide password' : 'Show password'}
          className="absolute inset-y-0 right-0 grid w-12 place-items-center text-slate-500 hover:text-navy focus-visible:outline-offset-[-3px]">
          {shown ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
      {help && <p className="help">{help}</p>}
    </div>
  )
}

// The six digits from the authenticator app
function CodeField({ value, onChange, invalid }) {
  return (
    <div>
      <label htmlFor="otp" className="label">6-digit code</label>
      <input id="otp" className="inp text-center font-mono text-2xl tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code"
        maxLength={6} required placeholder="000000" aria-invalid={invalid || undefined} aria-describedby={invalid ? 'otp-err' : 'otp-help'}
        value={value} onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))} data-autofocus autoFocus />
      {invalid
        ? <p id="otp-err" className="mt-2 text-sm text-red-700">That code didn’t work. Codes change every 30 seconds, so enter the one showing now.</p>
        : <p id="otp-help" className="help">From your authenticator app. It changes every 30 seconds.</p>}
    </div>
  )
}

const badCode = err => /invalid|expired|code/i.test(String(err?.message))

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
            <PasswordField id="password" label="Password" autoComplete="current-password" value={password}
              invalid={wrong} describedBy={wrong ? 'password-err' : undefined} onChange={e => { setPassword(e.target.value); setWrong(false) }} />
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
        <PasswordField id="new-password" label="New password" autoComplete="new-password" value={password}
          onChange={e => setPassword(e.target.value)} help="At least 10 characters." />
        <PasswordField id="new-password-2" label="Type it again" autoComplete="new-password" value={again} onChange={e => setAgain(e.target.value)} />
        {msg && <Notice tone="error">{msg}</Notice>}
        <button type="submit" className="btn-primary min-h-[48px] w-full" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
      </form>
    </Shell>
  )
}

// First sign-in after 2-step became required: link an authenticator app.
// Any half-finished setup is cleared first, so a reload starts cleanly.
export function TwoStepSetup() {
  const { me, signOut } = useAuth()
  const [factor, setFactor] = useState(null)   // { id, qr, secret }
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [wrong, setWrong] = useState(false)
  const [msg, setMsg] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let live = true
    ;(async () => {
      const { data: list } = await supabase.auth.mfa.listFactors()
      for (const f of list?.all ?? []) {
        if (f.factor_type === 'totp' && f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id })
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `WorkFlow website admin (${new Date().toISOString().slice(0, 16)})` })
      if (!live) return
      if (error) setMsg(`2-step setup couldn’t start: ${error.message}`)
      else setFactor({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
    })()
    return () => { live = false }
  }, [])

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setWrong(false); setMsg('')
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code })
    setBusy(false)
    if (error) { if (badCode(error)) { setWrong(true); setCode('') } else setMsg(error.message) }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(factor.secret); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* the key stays on screen to copy by hand */ }
  }

  return (
    <Shell title="Set up 2-step sign-in" sub="The website admin asks for a code from your phone as well as your password.">
      <ol className="space-y-6 text-[15px]">
        <li>
          <p className="font-semibold text-navy">1. Scan this with an authenticator app</p>
          <p className="mt-1 text-sm text-slate-600">Google Authenticator, Microsoft Authenticator, 1Password or any app that shows 6-digit codes.</p>
          <div className="mt-3 grid place-items-center bg-slate-50 p-4">
            {factor
              ? <img src={factor.qr} alt="QR code for your authenticator app" width="184" height="184" className="h-[184px] w-[184px] bg-white p-2" />
              : <span aria-hidden="true" className="skel h-[184px] w-[184px]" />}
          </div>
          {factor && (
            <details className="mt-3 text-sm">
              <summary className="link cursor-pointer">Can’t scan? Enter a key instead</summary>
              <span className="mt-2 flex flex-wrap items-center gap-2">
                <code className="break-all bg-slate-100 px-2.5 py-1.5 font-mono text-[13px] text-navy">{factor.secret}</code>
                <button type="button" className="btn-ghost min-h-[36px] px-3" onClick={copy}>
                  {copied ? <><Check size={14} aria-hidden="true" /> Copied</> : <><Copy size={14} aria-hidden="true" /> Copy</>}
                </button>
                <span className="sr-only" aria-live="polite">{copied ? 'Key copied' : ''}</span>
              </span>
            </details>
          )}
        </li>
        <li>
          <p className="font-semibold text-navy">2. Enter the code it shows</p>
          <form onSubmit={submit} className="mt-3 space-y-4">
            <CodeField value={code} onChange={c => { setCode(c); setWrong(false) }} invalid={wrong} />
            {msg && <Notice tone="error">{msg}</Notice>}
            <button type="submit" className="btn-primary min-h-[48px] w-full text-[15px]" disabled={busy || !factor || code.length !== 6}>
              {busy ? 'Checking…' : <>Turn on 2-step <ShieldCheck size={16} aria-hidden="true" /></>}
            </button>
          </form>
        </li>
      </ol>
      <p className="mt-6 bg-slate-100 p-4 text-[13px] leading-relaxed text-slate-600">
        Signed in as <strong className="break-all">{me?.email}</strong>. If you lose your phone, another website admin can reset your 2-step under People.
        {' '}<button type="button" className="link" onClick={signOut}>Sign out</button>
      </p>
    </Shell>
  )
}

// Every sign-in after setup: the code from the app
export function TwoStepVerify() {
  const { me, signOut } = useAuth()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [wrong, setWrong] = useState(false)
  const [msg, setMsg] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setWrong(false); setMsg('')
    const { data, error: listErr } = await supabase.auth.mfa.listFactors()
    const factor = data?.totp?.find(f => f.status === 'verified')
    const { error } = listErr || !factor
      ? { error: listErr || new Error('No authenticator is linked to this login. Ask an admin to reset your 2-step.') }
      : await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code })
    setBusy(false)
    if (error) { if (factor && badCode(error)) { setWrong(true); setCode('') } else setMsg(error.message) }
  }

  return (
    <Shell title="Enter your code" sub="Open your authenticator app for the 6-digit code for the WorkFlow website admin.">
      <form onSubmit={submit} className="space-y-5">
        <CodeField value={code} onChange={c => { setCode(c); setWrong(false) }} invalid={wrong} />
        {msg && <Notice tone="error">{msg}</Notice>}
        <button type="submit" className="btn-primary min-h-[48px] w-full text-[15px]" disabled={busy || code.length !== 6}>
          {busy ? 'Checking…' : <>Continue <ArrowRight size={16} aria-hidden="true" /></>}
        </button>
      </form>
      <p className="mt-6 bg-slate-100 p-4 text-[13px] leading-relaxed text-slate-600">
        Signed in as <strong className="break-all">{me?.email}</strong>. Lost your phone? Another website admin can reset your 2-step under People.
        {' '}<button type="button" className="link" onClick={signOut}>Sign out</button>
      </p>
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
