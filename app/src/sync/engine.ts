import { db } from '../app/store'
import { flush } from '../data/outbox'
import { supabase, deviceStaffId } from './client'
import { makeSend } from './send'
import { pull } from './pull'

export type SyncState = { mode: 'phone' | 'online' | 'offline' | 'error'; waiting: number; lastOk?: string }
let state: SyncState = { mode: supabase ? 'offline' : 'phone', waiting: 0 }
const listeners = new Set<(s: SyncState) => void>()
const set = (s: Partial<SyncState>) => { state = { ...state, ...s }; listeners.forEach(f => f(state)) }
export const syncState = () => state
export const onSync = (f: (s: SyncState) => void) => { listeners.add(f); return () => { listeners.delete(f) } }

let running = false
let again = false

/** Send what is waiting, then fetch what changed. Safe to call often. */
export async function syncNow(): Promise<void> {
  if (!supabase) return
  if (running) { again = true; return }
  running = true
  try {
    do {
      again = false
      const me = await deviceStaffId()
      if (!me) { set({ mode: 'phone', waiting: await db.outbox.count() }); return }
      if (!navigator.onLine) { set({ mode: 'offline', waiting: await db.outbox.count() }); return }
      const r = await flush(db, makeSend(supabase))
      await pull(supabase, me)
      set({ mode: r.failed ? 'offline' : 'online', waiting: await db.outbox.count(), lastOk: r.failed ? state.lastOk : new Date().toISOString() })
    } while (again)
  } catch {
    set({ mode: navigator.onLine ? 'error' : 'offline', waiting: await db.outbox.count() })
  } finally { running = false }
}

let started = false
/** Every 15 seconds, when the connection comes back, after every local change, and live when others change things. */
export function startSync(): void {
  if (!supabase || started) return
  started = true
  let t: ReturnType<typeof setTimeout> | undefined
  const soon = () => { clearTimeout(t); t = setTimeout(() => void syncNow(), 400) }
  setInterval(() => void syncNow(), 15_000)
  addEventListener('online', soon)
  db.outbox.hook('creating', () => { soon() })
  const ch = supabase.channel('shift-live')
  for (const table of ['moves', 'shifts', 'sales', 'expenses', 'products', 'staff']) ch.on('postgres_changes', { event: '*', schema: 'public', table }, soon)
  ch.subscribe()
  void syncNow()
}
