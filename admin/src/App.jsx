import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { DraftProvider } from './lib/content'
import { can } from './lib/api'
import Layout from './components/Layout'
import { NoAccess, SetPassword, SignIn } from './pages/SignIn'
import Overview from './pages/Overview'
import Content from './pages/Content'
import History from './pages/History'
import Leads from './pages/Leads'
import People from './pages/People'
import Activity from './pages/Activity'

function Gate() {
  const { session, me, error, loading, needsPassword } = useAuth()
  if (loading) return <p className="p-8 text-sm text-slate-500">Loading…</p>
  if (!session) return <SignIn />
  if (needsPassword) return <SetPassword />
  if (error || !me?.role) return <NoAccess />

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
