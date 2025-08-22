
import { createClient } from '@supabase/supabase-js'

export function getSupabaseConfig() {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || ''
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  if (envUrl && envKey) return { url: envUrl, key: envKey, fromEnv: true }
  const saved = localStorage.getItem('volleytrack_supabase')
  return saved ? { ...JSON.parse(saved), fromEnv: false } : { url: '', key: '', fromEnv: false }
}

export function saveSupabaseConfig(url, key) {
  const next = { url: (url||'').trim(), key: (key||'').trim(), fromEnv: false }
  localStorage.setItem('volleytrack_supabase', JSON.stringify(next))
  return next
}

export function createSupabaseClient({ url, key }) {
  if (!url || !key) return null
  return createClient(url, key)
}
