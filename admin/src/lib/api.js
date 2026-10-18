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

// Dates follow the reader's own locale settings, in British English wording
const LOCALE = 'en-GB'
const fmt = opts => new Intl.DateTimeFormat(LOCALE, opts)
const DAY = fmt({ day: 'numeric', month: 'short' })
const DAY_YEAR = fmt({ day: 'numeric', month: 'short', year: 'numeric' })
const LONG_DAY = fmt({ day: 'numeric', month: 'long', year: 'numeric' })
const TIME = fmt({ hour: '2-digit', minute: '2-digit' })
const sameDay = (a, b) => a.toDateString() === b.toDateString()
const thisYear = d => d.getFullYear() === new Date().getFullYear()

export const time = ts => (ts ? TIME.format(new Date(ts)) : '')
export const date = ts => (ts ? (thisYear(new Date(ts)) ? DAY : DAY_YEAR).format(new Date(ts)) : '')

// "just now", "5 min ago", "3 h ago", then "8 Oct, 18:16"
export function when(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const mins = Math.round((Date.now() - d) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} h ago`
  return `${date(ts)}, ${time(ts)}`
}

// Headings for a list grouped by day: Today, Yesterday, 8 October 2026
export function dayLabel(ts) {
  const d = new Date(ts), now = new Date()
  if (sameDay(d, now)) return 'Today'
  const y = new Date(now); y.setDate(now.getDate() - 1)
  if (sameDay(d, y)) return 'Yesterday'
  return LONG_DAY.format(d)
}

// "Kwame Mensah" → "KM", "ama@workflow-app.net" → "AM"
export function initials(name) {
  const s = String(name || '').split('@')[0]
  const parts = s.split(/[\s._-]+/).filter(Boolean)
  return ((parts.length > 1 ? parts[0][0] + parts[1][0] : s.slice(0, 2)) || '?').toUpperCase()
}

// Status colours, shared by the inbox, the overview and the lead panel
export const STATUS_TONES = {
  new: 'bg-sky-50 text-sky-700',
  contacted: 'bg-amber-50 text-amber-800',
  demo_booked: 'bg-violet-50 text-violet-700',
  trial: 'bg-indigo-50 text-indigo-700',
  won: 'bg-emerald-50 text-emerald-700',
  lost: 'bg-slate-100 text-slate-600',
  spam: 'bg-red-50 text-red-700',
}
export const OPEN_STATUSES = ['new', 'contacted', 'demo_booked', 'trial']
