import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { rpc } from './api'

const AuthContext = createContext(null)

// Invite and password-reset links land here with a token in the URL; note
// that before supabase-js consumes it, so we can ask for a new password.
const arrivedToSetPassword = /type=(invite|recovery)/.test(window.location.hash)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)   // undefined = still checking
  const [me, setMe] = useState(null)                    // { user_id, email, role, has_role }
  const [aal, setAal] = useState(null)                  // { currentLevel, nextLevel }: aal2 once the code is entered
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

  // Re-checked whenever the session changes, including after the 2-step code
  useEffect(() => {
    if (!session) { setMe(null); setAal(null); return }
    let live = true
    Promise.all([rpc('site_me'), supabase.auth.mfa.getAuthenticatorAssuranceLevel()])
      .then(([m, a]) => {
        if (!live) return
        if (a.error) throw a.error
        setMe(m); setAal(a.data); setError('')
      })
      .catch(e => { if (live) setError(e.message) })
    return () => { live = false }
  }, [session?.access_token])

  const value = {
    session, me, aal, error, needsPassword,
    loading: session === undefined || (session && (!me || !aal) && !error),
    signOut: async () => { await supabase.auth.signOut(); setMe(null); setAal(null) },
    passwordSet: () => {
      setNeedsPassword(false)
      history.replaceState(null, '', window.location.pathname)
    },
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
