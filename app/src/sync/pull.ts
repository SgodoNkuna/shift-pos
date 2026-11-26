import type { SupabaseClient } from '@supabase/supabase-js'
import { db, setMeta } from '../app/store'
import type { StaffMember } from '../data/db'
import type { Expense, Product, Sale, Shift, StockMove } from '../domain/types'
import { fromRow } from './map'

type Row = Record<string, unknown>

export class SignedOutError extends Error { constructor() { super('This phone is no longer signed in to the shop') } }

/** Brings the server's view into this phone, without overwriting anything still waiting to be sent. */
export async function pull(sb: SupabaseClient, meId: string): Promise<void> {
  const waiting = new Set((await db.outbox.toArray()).map(e => e.id))
  const keep = <T extends { id: string }>(rows: T[]) => rows.filter(r => !waiting.has(r.id))

  const since = new Date(Date.now() - 31 * 86400_000).toISOString().slice(0, 10)
  const [staff, products, settings, shifts, costs] = await Promise.all([
    sb.from('staff').select('id, name, role, phone, active'),
    sb.from('products').select('*'),
    sb.from('settings').select('key, value'),
    sb.from('shifts').select('*').gte('date', since).order('opened_at', { ascending: false }).limit(70),
    sb.from('product_costs').select('product_id, cents'), // empty unless this is the boss
  ])
  for (const r of [staff, products, settings, shifts]) if (r.error) throw r.error
  // If the shop does not recognise this phone (its account moved to another phone), it sees nothing.
  // Never treat that as "everything was deleted": stop here and leave this phone's data alone.
  if (!(staff.data as Row[]).some(s => s.id === meId)) throw new SignedOutError()

  const mine = await db.staff.get(meId)
  const people: StaffMember[] = (staff.data as Row[]).filter(s => s.active).map(s => {
    const local = s.id === meId ? mine : undefined
    return { id: s.id as string, name: s.name as string, role: s.role as StaffMember['role'], phone: (s.phone as string) ?? undefined,
      salt: local?.salt ?? '', pinHash: local?.pinHash ?? '', failed: local?.failed ?? 0, locked: local?.locked ?? false }
  })
  const shiftRows = keep((shifts.data as Row[]).map(r => fromRow<Shift>('shifts', r)))
  const ids = (shifts.data as Row[]).map(r => r.id as string)

  const [sales, moves, expenses] = ids.length ? await Promise.all([
    sb.from('sales').select('*').in('shift_id', ids),
    sb.from('moves').select('*').in('shift_id', ids),
    sb.from('expenses').select('*').in('shift_id', ids),
  ]) : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }]
  for (const r of [sales, moves, expenses]) if (r.error) throw r.error

  const settingMap = Object.fromEntries((settings.data as Row[]).map(s => [s.key, s.value]))
  await db.transaction('rw', [db.staff, db.products, db.shifts, db.sales, db.moves, db.expenses, db.meta], async () => {
    await db.staff.bulkPut(people)
    await db.products.bulkPut((products.data as Row[]).map(r => fromRow<Product>('products', r)))
    // Shifts the server no longer has (e.g. an empty test shift that was removed) go from this phone too,
    // unless this phone still has unsent changes for them.
    const onServer = new Set(ids)
    const gone = (await db.shifts.where('date').aboveOrEqual(since).toArray()).filter(s => !onServer.has(s.id) && !waiting.has(s.id))
    for (const s of gone) {
      const rows = await Promise.all([db.sales, db.moves, db.expenses].map(t => (t as typeof db.sales).where('shiftId').equals(s.id).primaryKeys()))
      if (rows.flat().some(id => waiting.has(id as string))) continue
      await Promise.all([db.sales.where('shiftId').equals(s.id).delete(), db.moves.where('shiftId').equals(s.id).delete(), db.expenses.where('shiftId').equals(s.id).delete()])
      await db.shifts.delete(s.id)
    }
    await db.shifts.bulkPut(shiftRows)
    await db.sales.bulkPut(keep((sales.data as Row[]).map(r => fromRow<Sale>('sales', r))))
    await db.moves.bulkPut(keep((moves.data as Row[]).map(r => fromRow<StockMove>('moves', r))))
    await db.expenses.bulkPut(keep((expenses.data as Row[]).map(r => fromRow<Expense>('expenses', r))))
    if (settingMap.first_opening) await setMeta('firstOpening', settingMap.first_opening)
    if (settingMap.float_cents != null) await setMeta('floatCents', Number(settingMap.float_cents))
    if (settingMap.stock_out_reasons) await setMeta('stockOutReasons', settingMap.stock_out_reasons)
    if (settingMap.escalate_after_min != null) await setMeta('escalateMin', Number(settingMap.escalate_after_min))
    if (settingMap.remind_sender_after_min != null) await setMeta('remindMin', Number(settingMap.remind_sender_after_min))
    if (settingMap.alert_leads_after_min != null) await setMeta('alertMin', Number(settingMap.alert_leads_after_min))
    if (!costs.error && costs.data?.length) await setMeta('costs', Object.fromEntries((costs.data as Row[]).map(c => [c.product_id, c.cents])))
    await setMeta('lastPull', new Date().toISOString())
  })
}
