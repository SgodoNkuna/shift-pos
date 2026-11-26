import { describe, test, expect } from 'vitest'
import { toRow, fromRow, planSend, isPermanent } from './map'
import { prototypeNight } from '../domain/fixtures'
import type { OutboxEntry } from '../data/db'

const d = prototypeNight()
const entry = (table: OutboxEntry['table'], row: unknown): OutboxEntry => ({ id: 'x', table, op: 'upsert', row, tries: 0, at: '' })

describe('toRow / fromRow', () => {
  test('a sale round-trips', () => {
    const s = d.sales[1]
    expect(toRow('sales', s)).toMatchObject({ id: 'x2', shift_id: 's1', by_staff: 'a', payments: s.payments })
    expect(fromRow('sales', toRow('sales', s))).toEqual({ ...s, void: undefined })
  })
  test('a stock out round-trips with decision fields', () => {
    const m = d.moves[1]
    expect(toRow('moves', m)).toMatchObject({ product_id: 'martian', status: 'approved', decided_by: 'boss', reason: 'Given to boss' })
    expect(fromRow('moves', toRow('moves', m))).toEqual(m)
  })
  test('a shift round-trips; missing numbers become null on the server and undefined on the phone', () => {
    const s = { ...d.shift }; delete s.cashCountedCents
    const row = toRow('shifts', s) as Record<string, unknown>
    expect(row.cash_counted_cents).toBeNull()
    expect(row.card_slip_cents).toBe(20000)
    expect(fromRow('shifts', row)).toEqual(s)
  })
  test('helpers are received from the server but never sent from a phone', () => {
    expect('helpers' in toRow('shifts', { ...d.shift, helpers: ['b'] })).toBe(false)
    expect(fromRow<{ helpers: string[] }>('shifts', { ...toRow('shifts', d.shift), helpers: ['b'] }).helpers).toEqual(['b'])
  })
  test('a product keeps its sort order and numeric step', () => {
    const p = d.products[4]
    expect(fromRow('products', { ...toRow('products', p) as object, step: '0.5', low_at: '1.0' })).toEqual(p)
  })
})

describe('planSend', () => {
  test('new sale is insert-only, so a resend is ignored', () => {
    expect(planSend(entry('sales', d.sales[0]))).toMatchObject({ how: 'insert_ignore', table: 'sales' })
  })
  test('voided sale is an update of the void only', () => {
    const v = { ...d.sales[0], void: { by: 'a', reason: 'Undo', at: 't' } }
    expect(planSend(entry('sales', v))).toEqual({ how: 'update', table: 'sales', id: 'x1', patch: { void: v.void } })
  })
  test('pending stock out is insert-only; a decision is an update', () => {
    expect(planSend(entry('moves', { ...d.moves[1], status: 'pending' })).how).toBe('insert_ignore')
    expect(planSend(entry('moves', d.moves[1]))).toMatchObject({ how: 'update', patch: { status: 'approved', decided_by: 'boss' } })
  })
  test('shift is update-then-insert', () => { expect(planSend(entry('shifts', d.shift)).how).toBe('update_or_insert') })
})

describe('isPermanent', () => {
  test('database refusals are permanent, network trouble is not', () => {
    expect(isPermanent({ code: '42501' })).toBe(true)  // row-level security
    expect(isPermanent({ code: 'P0001' })).toBe(true)  // raised by a guard
    expect(isPermanent({ code: '23503' })).toBe(true)  // missing reference
    expect(isPermanent({ code: '' })).toBe(false)
    expect(isPermanent({ message: 'Failed to fetch' })).toBe(false)
  })
})
