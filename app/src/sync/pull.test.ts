import 'fake-indexeddb/auto'
import { describe, test, expect, beforeEach } from 'vitest'
import { db } from '../app/store'
import { pull } from './pull'
import type { Shift } from '../domain/types'

/** A stand-in for the Supabase client: every query on a table returns `data[table]`. */
function fakeSupabase(data: Record<string, unknown[]>) {
  const q = (rows: unknown[]) => {
    const r = { data: rows, error: null }
    const chain: Record<string, unknown> = { then: (ok: (v: unknown) => void) => ok(r) }
    for (const m of ['select', 'gte', 'order', 'limit', 'in', 'eq']) chain[m] = () => chain
    return chain
  }
  return { from: (t: string) => q(data[t] ?? []) } as never
}

const today = new Date().toISOString().slice(0, 10)
const shift = (id: string): Shift => ({ id, kind: 'day', date: today, openedBy: 'me', openedAt: new Date().toISOString(), opening: {}, floatCents: 0 })

describe('pull', () => {
  beforeEach(async () => { await Promise.all(db.tables.map(t => t.clear())) })

  test('a shift the server removed is dropped from the phone with its rows', async () => {
    await db.shifts.put(shift('gone'))
    await db.sales.put({ id: 's1', shiftId: 'gone', at: '', by: 'me', lines: [], payments: [] })
    await pull(fakeSupabase({ staff: [{ id: 'me', name: 'Me', role: 'employee', active: true }] }), 'me')
    expect(await db.shifts.get('gone')).toBeUndefined()
    expect(await db.sales.count()).toBe(0)
  })

  test('a shift with unsent changes on this phone is kept', async () => {
    await db.shifts.put(shift('mine'))
    await db.outbox.add({ id: 'mine', table: 'shifts', op: 'upsert', row: {}, tries: 0, at: '' })
    await pull(fakeSupabase({}), 'me')
    expect(await db.shifts.get('mine')).toBeDefined()
  })

  test('a shift the server still has is kept and updated', async () => {
    await db.shifts.put(shift('kept'))
    await pull(fakeSupabase({ shifts: [{ id: 'kept', kind: 'day', date: today, opened_by: 'me', opened_at: new Date().toISOString(), opening: {}, float_cents: 5000, counts: {} }] }), 'me')
    expect((await db.shifts.get('kept'))!.floatCents).toBe(5000)
  })
})
