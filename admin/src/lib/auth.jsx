import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { rpc } from './api'

const AuthContext = createContext(null)

// Invite and password-reset links land here with a token in the URL; note
// that before supabase-js consumes it, so we can ask for a new password.
const arrivedToSetPassword = /type=(invite|recovery)/.test(window.location.hash)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)   // undefined = still checking
  const [me, setMe] = useState(null)                    // { user_id, email, role }
  const [needsPassword, setNeedsPassword] = useState(arrivedToSetPassword)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setNeedsPassword(true)
      setSession(s ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setMe(null); return }
    let live = true
    rpc('site_me').then(m => { if (live) { setMe(m); setError('') } })
      .catch(e => { if (live) setError(e.message) })
    return () => { live = false }
  }, [session?.user?.id])

  const value = {
    session, me, error, needsPassword,
    loading: session === undefined || (session && !me && !error),
    signOut: async () => { await supabase.auth.signOut(); setMe(null) },
    passwordSet: () => {
      setNeedsPassword(false)
      history.replaceState(null, '', window.location.pathname)
    },
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
