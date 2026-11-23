import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined

/** Null when the app was built without a server (phone-only mode). */
export const supabase: SupabaseClient | null = url && key
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'shiftpos-auth' } })
  : null
export const SUPABASE_URL = url ?? ''
export const SUPABASE_KEY = key ?? ''

/** The staff id this phone is signed in as, or null. */
export async function deviceStaffId(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return (data.session?.user.user_metadata?.staff_id as string | undefined) ?? null
}
