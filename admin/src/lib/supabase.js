import { createClient } from '@supabase/supabase-js'
import config from '../../../site.config.json'

// The public URL and key are safe in the browser: every table is closed to
// direct access, and each database function checks the signed-in person's
// website role before doing anything.
export const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'wfs-site-admin' },
})

export const SITE_URL = config.siteUrl
