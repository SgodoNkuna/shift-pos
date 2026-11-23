import { describe, test, expect } from 'vitest'
import { roundQty, parseQty, parseRand, formatRand, formatQty, shiftFor } from './num'
import type { Product } from './types'

const gram: Product = { id: 'pinkink', name: 'Pink Ink', categoryId: 'main', unit: 'g', step: 0.5, lowAt: 1, priceCents: 10000, active: true }
const each: Product = { id: 'kings', name: 'Kings', categoryId: 'main', unit: 'ea', step: 1, lowAt: 3, priceCents: 25000, active: true }

describe('roundQty', () => {
  test('gram sums land exactly on zero', () => { expect(roundQty(0.5 + 0.5 + 0.5 - 1.5)).toBe(0) })
  test('0.1 + 0.2 is 0.3', () => { expect(roundQty(0.1 + 0.2)).toBe(0.3) })
})

describe('parseQty', () => {
  test('comma decimal', () => { expect(parseQty('1,5')).toBe(1.5) })
  test('spaces', () => { expect(parseQty(' 3 ')).toBe(3) })
  test('empty is null', () => { expect(parseQty('')).toBeNull() })
  test('junk is null', () => { expect(parseQty('abc')).toBeNull() })
  test('negative is null', () => { expect(parseQty('-2')).toBeNull() })
})

describe('parseRand', () => {
  test('with R', () => { expect(parseRand('R350')).toBe(35000) })
  test('with space thousands', () => { expect(parseRand('2 905')).toBe(290500) })
  test('with comma thousands', () => { expect(parseRand('R2,905')).toBe(290500) })
  test('with cents', () => { expect(parseRand('12.50')).toBe(1250) })
  test('empty is null', () => { expect(parseRand('')).toBeNull() })
})

describe('format', () => {
  test('rand', () => { expect(formatRand(118000)).toBe('R1,180') })
  test('negative rand', () => { expect(formatRand(-3000)).toBe('−R30') })
  test('rand with cents', () => { expect(formatRand(1250)).toBe('R12.50') })
  test('grams', () => { expect(formatQty(gram, 0.5)).toBe('0.5 g') })
  test('each', () => { expect(formatQty(each, 3)).toBe('3') })
})

describe('shiftFor (Africa/Johannesburg)', () => {
  test('02:00 on 29 Nov belongs to night of 28 Nov', () => {
    expect(shiftFor(new Date('2026-11-29T00:00:00Z'))).toEqual({ kind: 'night', date: '2026-11-28' })
  })
  test('09:00 on 28 Nov is day of 28 Nov', () => {
    expect(shiftFor(new Date('2026-11-28T07:00:00Z'))).toEqual({ kind: 'day', date: '2026-11-28' })
  })
  test('20:00 on 28 Nov is night of 28 Nov', () => {
    expect(shiftFor(new Date('2026-11-28T18:00:00Z'))).toEqual({ kind: 'night', date: '2026-11-28' })
  })
  test('07:59 on 1 Dec is night of 30 Nov', () => {
    expect(shiftFor(new Date('2026-12-01T05:59:00Z'))).toEqual({ kind: 'night', date: '2026-11-30' })
  })
})
