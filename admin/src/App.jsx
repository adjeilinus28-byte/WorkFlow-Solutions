import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { DraftProvider } from './lib/content'
import { can } from './lib/api'
import Layout from './components/Layout'
import { NoAccess, SetPassword, SignIn, TwoStepSetup, TwoStepVerify } from './pages/SignIn'
import Overview from './pages/Overview'
import Content from './pages/Content'
import History from './pages/History'
import Leads from './pages/Leads'
import People from './pages/People'
import Activity from './pages/Activity'

function Gate() {
  const { session, me, aal, error, loading, needsPassword } = useAuth()
  const spinner = <div role="status" className="grid min-h-dvh place-items-center"><span className="sr-only">Loading…</span><span aria-hidden="true" className="skel h-1.5 w-40 rounded-full" /></div>
  if (loading) return spinner
  if (!session) return <SignIn />
  if (needsPassword) return <SetPassword />
  if (error || !(me?.has_role ?? me?.role)) return <NoAccess />
  // Everyone with website access signs in with a code from their phone too
  if (aal?.currentLevel !== 'aal2') return aal?.nextLevel === 'aal2' ? <TwoStepVerify /> : <TwoStepSetup />
  if (!me.role) return spinner   // the role arrives once the code has been checked

  const role = me.role
  const pages = (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Overview />} />
        {can.content(role) && <Route path="content/:tab?" element={<Content />} />}
        {can.content(role) && <Route path="history" element={<History />} />}
        {can.leads(role) && <Route path="leads" element={<Leads />} />}
        {can.people(role) && <Route path="people" element={<People />} />}
        {can.people(role) && <Route path="activity" element={<Activity />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
  // Editors share one draft across Overview, Content and History
  return can.content(role) ? <DraftProvider>{pages}</DraftProvider> : pages
}

export default function App() {
  return (
    <BrowserRouter basename="/admin">
      <AuthProvider><Gate /></AuthProvider>
    </BrowserRouter>
  )
}
