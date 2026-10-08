import { supabase } from './supabase'

// Errors arrive as database or function errors; turn them into one message
// a person can act on.
export class ApiError extends Error {
  constructor(message, { code, problems } = {}) {
    super(message)
    this.code = code
    this.problems = problems || []
  }
}

function friendly(error) {
  const msg = error?.message || 'Something went wrong'
  if (error?.code === 'PGRST202' || /Could not find the function/i.test(msg))
    return new ApiError('This needs a database update that hasn\'t been applied yet. See the setup notes.', { code: 'missing_function' })
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg))
    return new ApiError('Can\'t reach the server. Check your connection and try again.', { code: 'network' })
  if (/JWT expired|invalid JWT/i.test(msg)) return new ApiError('Your session has expired. Sign in again.', { code: 'auth' })
  return new ApiError(msg, { code: error?.code })
}

export async function rpc(name, args = {}) {
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw friendly(error)
  return data
}

// Edge functions answer { error, problems? } with a non-2xx status on failure
export async function callFunction(name, body = {}) {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (!error) return data
  let payload = null
  try { payload = await error.context?.json?.() } catch { /* not JSON */ }
  if (payload?.error) throw new ApiError(payload.error, { code: error.context?.status, problems: payload.problems })
  throw friendly(error)
}

export const STATUS_LABELS = {
  new: 'New',
  contacted: 'Contacted',
  demo_booked: 'Demo booked',
  trial: 'On trial',
  won: 'Won',
  lost: 'Lost',
  spam: 'Spam',
}

export const ROLE_LABELS = {
  admin: 'Admin — everything, including people and leads',
  editor: 'Editor — website content and publishing',
  sales: 'Sales — the leads inbox only',
}

export const can = {
  content: role => role === 'admin' || role === 'editor',
  leads: role => role === 'admin' || role === 'sales',
  people: role => role === 'admin',
}

export function when(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const mins = Math.round((Date.now() - d) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} h ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })
    + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
