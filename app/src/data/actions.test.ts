import 'fake-indexeddb/auto'
import { describe, test, expect, beforeEach } from 'vitest'
import { ShiftDB } from './db'
import { createActions, LockError, ShiftLockedError, PaymentError } from './actions'
import { flush } from './outbox'
import { SHEET_PRODUCTS, SHEET_OPENING } from '../domain/fixtures'

let db: ShiftDB
let n = 0
let clock: Date
const act = () => createActions(db, { now: () => clock, uuid: () => `id-${++n}` })

beforeEach(async () => {
  db = new ShiftDB(`test-${Math.random()}`)
  await db.products.bulkPut(SHEET_PRODUCTS)
  clock = new Date('2026-11-28T18:02:00Z') // 20:02 SAST
})

async function readyToLock(a: ReturnType<typeof act>, shiftId: string) {
  await a.setCash(shiftId, 20000); await a.setCardSlip(shiftId, 0)
  await a.confirmPin(shiftId, 'out', 'a'); await a.confirmPin(shiftId, 'in', 'b')
}

describe('openShift', () => {
  test('first shift uses the given opening and the date/kind from the clock', async () => {
    const s = await act().openShift({ by: 'a', floatCents: 20000, opening: SHEET_OPENING })
    expect(s).toMatchObject({ kind: 'night', date: '2026-11-28', floatCents: 20000 })
    expect(s.opening.outdoor).toBe(59)
  })
  test('next shift opens with the previous shift\'s counted close', async () => {
    const a = act()
    const s1 = await a.openShift({ by: 'a', floatCents: 20000, opening: SHEET_OPENING })
    await a.recordSale(s1.id, 'a', [{ productId: 'outdoor', qty: 2 }], [{ method: 'cash', cents: 4000 }])
    await a.setCount(s1.id, 'supercheese', 23)
    await readyToLock(a, s1.id)
    await a.setCash(s1.id, 24000)
    await a.lockShift(s1.id)
    clock = new Date('2026-11-29T06:01:00Z') // 08:01 SAST
    const s2 = await a.openShift({ by: 'b', floatCents: 20000 })
    expect(s2).toMatchObject({ kind: 'day', date: '2026-11-29' })
    expect(s2.opening.outdoor).toBe(57)     // expected, not counted
    expect(s2.opening.supercheese).toBe(23) // counted wins
  })
})

describe('recordSale', () => {
  test('writes one sale, one outbox row and uses the current price', async () => {
    const a = act()
    const s = await a.openShift({ by: 'a', floatCents: 0, opening: SHEET_OPENING })
    const sale = await a.recordSale(s.id, 'a', [{ productId: 'pinkink', qty: 0.5 }], [{ method: 'cash', cents: 5000 }])
    expect(sale.lines[0].unitCents).toBe(10000)
    expect(await db.sales.count()).toBe(1)
    const box = await db.outbox.toArray()
    expect(box.map(b => b.table)).toEqual(['shifts', 'sales'])
  })
  test('payments that do not add up to the total are refused', async () => {
    const a = act()
    const s = await a.openShift({ by: 'a', floatCents: 0, opening: SHEET_OPENING })
    await expect(a.recordSale(s.id, 'a', [{ productId: 'kings', qty: 1 }], [{ method: 'cash', cents: 1000 }])).rejects.toBeInstanceOf(PaymentError)
  })
})

describe('stock out approval', () => {
  test('pending out blocks lock until decided', async () => {
    const a = act()
    const s = await a.openShift({ by: 'a', floatCents: 20000, opening: SHEET_OPENING })
    const m = await a.requestOut(s.id, 'a', 'martian', 0.5, 'Given to boss')
    expect(m.status).toBe('pending')
    await readyToLock(a, s.id)
    const err = await a.lockShift(s.id).catch(e => e)
    expect(err).toBeInstanceOf(LockError)
    expect((err as LockError).reasons).toEqual(['pending_out'])
    await a.decideOut(m.id, true, 'boss')
    expect((await db.moves.get(m.id))!.status).toBe('approved')
    await expect(a.lockShift(s.id)).resolves.toBeTruthy()
  })
})

describe('locked shifts', () => {
  test('no more changes after lock, but it can be marked sent', async () => {
    const a = act()
    const s = await a.openShift({ by: 'a', floatCents: 20000, opening: SHEET_OPENING })
    await readyToLock(a, s.id)
    await a.lockShift(s.id)
    await expect(a.addExpense(s.id, 'a', 2000, 'Late')).rejects.toBeInstanceOf(ShiftLockedError)
    await a.markSent(s.id)
    expect((await db.shifts.get(s.id))!.sentAt).toBeTruthy()
  })
})

describe('outbox', () => {
  test('a failed send is retried with the same id and removed after success', async () => {
    const a = act()
    const s = await a.openShift({ by: 'a', floatCents: 0, opening: SHEET_OPENING })
    await a.addExpense(s.id, 'a', 2000, 'Cleaning supplies')
    const seen: string[] = []
    let fail = true
    const send = async (e: { id: string }) => { seen.push(e.id); if (fail) throw new Error('offline') }
    const r1 = await flush(db, send)
    expect(r1).toEqual({ sent: 0, failed: true })
    fail = false
    const r2 = await flush(db, send)
    expect(r2).toEqual({ sent: 2, failed: false })
    expect(seen[0]).toBe(seen[1])
    expect(await db.outbox.count()).toBe(0)
  })
  test('every action leaves an audit row', async () => {
    const a = act()
    const s = await a.openShift({ by: 'a', floatCents: 0, opening: SHEET_OPENING })
    await a.addStockIn(s.id, 'a', 'coke', 24)
    const audit = await db.audit.toArray()
    expect(audit.map(x => x.action)).toEqual(['open_shift', 'stock_in'])
  })
})
