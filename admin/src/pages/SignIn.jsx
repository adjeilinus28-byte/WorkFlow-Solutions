import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Logo } from '../components/Layout'
import { Notice } from '../components/fields'

function Shell({ title, children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy px-4 py-10">
      <main id="main" className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="rounded-2xl bg-white p-6 shadow-xl sm:p-8">
          <h1 className="mb-5 font-display text-xl font-extrabold">{title}</h1>
          {children}
        </div>
        <p className="mt-6 text-center text-xs text-slate-400">WorkFlow Solutions · website admin</p>
      </main>
    </div>
  )
}

export function SignIn() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setMsg(null)
    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) setMsg({ tone: 'error', text: /invalid/i.test(error.message) ? 'That email and password don\'t match.' : error.message })
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/admin/` })
      setMsg(error ? { tone: 'error', text: error.message } : { tone: 'ok', text: 'If that email has a login, a reset link is on its way. Check your inbox.' })
    }
    setBusy(false)
  }

  return (
    <Shell title={mode === 'signin' ? 'Sign in' : 'Reset your password'}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" type="email" autoComplete="username" required className="inp" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        {mode === 'signin' && (
          <div>
            <label htmlFor="password" className="label">Password</label>
            <input id="password" type="password" autoComplete="current-password" required className="inp" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
        )}
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        <button type="submit" className="btn-dark w-full" disabled={busy}>
          {busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : 'Send reset link'}
        </button>
      </form>
      <button type="button" className="mt-4 text-sm font-medium text-amber-700 underline"
        onClick={() => { setMode(m => (m === 'signin' ? 'reset' : 'signin')); setMsg(null) }}>
        {mode === 'signin' ? 'Forgot your password?' : 'Back to sign in'}
      </button>
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
    if (password !== again) return setMsg('The two passwords don\'t match.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return setMsg(error.message)
    passwordSet()
  }

  return (
    <Shell title="Choose your password">
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
        <button type="submit" className="btn-dark w-full" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
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
          : <p>You're signed in as <strong>{me?.email}</strong>, but this login hasn't been given access to the website admin. Ask an admin to add you under People.</p>}
        <button type="button" className="btn-ghost w-full" onClick={signOut}>Sign out</button>
      </div>
    </Shell>
  )
}
