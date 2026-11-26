import { db, getMeta } from '../app/store'
import { flush } from '../data/outbox'
import { supabase, deviceStaffId } from './client'
import { makeSend } from './send'
import { pull, SignedOutError } from './pull'

export type SyncState = { mode: 'phone' | 'online' | 'offline' | 'error' | 'signed-out'; waiting: number; refused: number; lastOk?: string }
let state: SyncState = { mode: supabase ? 'offline' : 'phone', waiting: 0, refused: 0 }
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
      if (!me) {
        // A phone that was set up for the shop but has lost its sign-in: say so, keep its data.
        const setUp = (await db.staff.toArray()).some(s => s.pinHash) && !(await getMeta<boolean>('demo', false))
        set({ mode: setUp && (await db.shifts.count()) > 0 ? 'signed-out' : 'phone', waiting: await db.outbox.count() }); return
      }
      if (!navigator.onLine) { set({ mode: 'offline', waiting: await db.outbox.count() }); return }
      // Check the shop still knows this phone before sending anything (otherwise every change would be refused).
      const { data: known, error: knownErr } = await supabase.from('staff').select('id').eq('id', me).maybeSingle()
      if (knownErr) throw knownErr
      if (!known) { set({ mode: 'signed-out', waiting: await db.outbox.count() }); return }
      const r = await flush(db, makeSend(supabase))
      await pull(supabase, me)
      set({ mode: r.failed ? 'offline' : 'online', waiting: await db.outbox.count(), refused: await getMeta<number>('syncRefused', 0),
        lastOk: r.failed ? state.lastOk : new Date().toISOString() })
    } while (again)
  } catch (e) {
    set({ mode: e instanceof SignedOutError ? 'signed-out' : navigator.onLine ? 'error' : 'offline', waiting: await db.outbox.count() })
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
