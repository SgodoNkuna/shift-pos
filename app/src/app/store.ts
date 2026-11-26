import { ShiftDB, type StaffMember } from '../data/db'
import { createActions } from '../data/actions'
import { hashPin } from '../auth/pin'
import { SHEET_OPENING, SHEET_PRODUCTS } from '../domain/fixtures'
import { CATALOG, CATALOG_OPENING } from '../domain/catalog'
import type { Role } from '../domain/types'

export const db = new ShiftDB()
export const actions = createActions(db)

export const DEFAULT_REASONS = ['Given to boss', 'Sample', 'Damaged', 'Other']

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await db.meta.get(key)
  return row ? (row.value as T) : fallback
}
export const setMeta = (key: string, value: unknown) => db.meta.put({ key, value })

export async function addStaff(name: string, role: Role, pin: string): Promise<StaffMember> {
  const salt = crypto.randomUUID()
  const m: StaffMember = { id: crypto.randomUUID(), name: name.trim(), role, salt, pinHash: await hashPin(pin, salt), failed: 0, locked: false }
  await db.staff.put(m)
  await db.audit.add({ at: new Date().toISOString(), by: m.id, action: 'add_staff', ref: m.id, detail: { role } })
  return m
}

/** First run on a phone: add the first person. Demo products come from the paper sheet. */
export async function firstRun(o: { name: string; pin: string; demo: boolean; role: Role }): Promise<StaffMember> {
  const me = await addStaff(o.name, o.role, o.pin)
  if (o.demo) {
    await db.products.bulkPut(SHEET_PRODUCTS)
    await setMeta('firstOpening', SHEET_OPENING)
  }
  return me
}

/** The opening a new shift would get: the last locked shift's close, else the first-run stock. */
export async function nextOpening(): Promise<{ opening: Record<string, number>; from: string }> {
  const locked = (await db.shifts.toArray()).filter(s => s.lockedAt).sort((a, b) => a.lockedAt!.localeCompare(b.lockedAt!))
  const last = locked.at(-1)
  if (!last) return { opening: await getMeta<Record<string, number>>('firstOpening', {}), from: 'starting stock' }
  const { itemLines } = await import('../domain/calc')
  const opening: Record<string, number> = {}
  for (const l of itemLines(await actions.loadShiftData(last.id))) opening[l.productId] = l.counted ?? l.expected
  const by = (await db.staff.get(last.pinOutBy ?? last.openedBy))?.name ?? 'someone'
  return { opening, from: `${last.kind === 'day' ? 'Day' : 'Night'} shift ${last.date}, locked by ${by}` }
}

export const openShiftNow = async () => (await db.shifts.toArray()).find(s => !s.lockedAt)

/** Demo people and their PINs. Demo data stays on this phone and never reaches the shop's database. */
export const DEMO_LOGINS: { name: string; role: Role; pin: string }[] = [
  { name: 'Demo Boss', role: 'boss', pin: '1111' },
  { name: 'Demo Manager', role: 'manager', pin: '2222' },
  { name: 'Demo Employee', role: 'employee', pin: '3333' },
  { name: 'Demo Employee 2', role: 'employee', pin: '4444' },
]

export async function startDemo(): Promise<void> {
  for (const d of DEMO_LOGINS) await addStaff(d.name, d.role, d.pin)
  await db.products.bulkPut(CATALOG)
  await setMeta('firstOpening', CATALOG_OPENING)
  await setMeta('floatCents', 20000)
  await setMeta('costs', Object.fromEntries(CATALOG.map(p => [p.id, Math.round(p.priceCents * 0.5)])))
  await setMeta('demo', true)
}

/** Wipes everything on this phone (demo or test data) and starts again at the welcome screen. */
export async function resetPhone(): Promise<void> {
  await db.delete()
  history.replaceState(null, '', location.pathname)
  location.reload()
}
