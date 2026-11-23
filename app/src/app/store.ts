import { ShiftDB, type StaffMember } from '../data/db'
import { createActions } from '../data/actions'
import { hashPin } from '../auth/pin'
import { SHEET_OPENING, SHEET_PRODUCTS } from '../domain/fixtures'
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
