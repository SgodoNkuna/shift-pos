import { describe, test, expect } from 'vitest'
import { itemLines, shiftTotals, changeDue, shiftFlags, canLock } from './calc'
import { sheet28Nov, sheet28NovMoney, prototypeNight } from './fixtures'

const line = (d: ReturnType<typeof prototypeNight>, id: string) => itemLines(d).find(l => l.productId === id)!

describe('itemLines on the 28 Nov sheet', () => {
  const d = sheet28Nov()
  test('Outdoor: 44 + 28 − 13 sold = 59, R260 sales, R1,180 stock', () => {
    expect(line(d, 'outdoor')).toMatchObject({ open: 44, stockIn: 28, sold: 13, expected: 59, counted: 59, diff: 0, salesCents: 26000, stockValueCents: 118000 })
  })
  test('Super Cheese: 17 + 34 − 26 = 25, R780 sales, R750 stock', () => {
    expect(line(d, 'supercheese')).toMatchObject({ expected: 25, salesCents: 78000, stockValueCents: 75000, diff: 0 })
  })
  test('Exodus C: 27 − 1 = 26, R80 sales', () => {
    expect(line(d, 'exodus')).toMatchObject({ sold: 1, expected: 26, salesCents: 8000 })
  })
})

describe('shiftTotals', () => {
  test('sheet money: R2,905 − R40 − R2,370 = R495 cash', () => {
    expect(shiftTotals(sheet28NovMoney())).toMatchObject({ salesCents: 290500, cardCents: 237000, cashCents: 53500, expensesCents: 4000, expectedCashCents: 49500 })
  })
  test('prototype night: float R200 + cash R170 − R20 = R350', () => {
    const t = shiftTotals(prototypeNight())
    expect(t).toMatchObject({ salesCents: 37000, cardCents: 20000, cashCents: 17000, expensesCents: 2000, expectedCashCents: 35000, cashDiffCents: 0, cardDiffCents: 0 })
  })
  test('category sales add up to total', () => {
    const t = shiftTotals(prototypeNight())
    expect(Object.values(t.categorySalesCents).reduce((a, b) => a + b, 0)).toBe(t.salesCents)
    expect(t.categorySalesCents.main).toBe(37000)
  })
  test('no cash counted gives null difference', () => {
    const d = prototypeNight(); delete d.shift.cashCountedCents
    expect(shiftTotals(d).cashDiffCents).toBeNull()
  })
})

describe('prototype night items', () => {
  const d = prototypeNight()
  test('Super Cheese counted 23 vs expected 24 is −1, −R30', () => {
    expect(line(d, 'supercheese')).toMatchObject({ expected: 24, counted: 23, diff: -1, diffCents: -3000 })
  })
  test('approved stock out of 0.5 g Martian F leaves 3.5 g', () => {
    expect(line(d, 'martian')).toMatchObject({ out: 0.5, pendingOut: 0, expected: 3.5 })
  })
  test('Pink Ink 1 g − 0.5 g sold = 0.5 g', () => { expect(line(d, 'pinkink').expected).toBe(0.5) })
  test('Coke stock in 24', () => { expect(line(d, 'coke')).toMatchObject({ stockIn: 24, expected: 24 }) })
  test('uncounted item has null counted and diff', () => {
    expect(line(d, 'outdoor')).toMatchObject({ counted: null, diff: null, diffCents: null, expected: 57 })
  })
})

describe('prices and voids', () => {
  test('a price change after a sale keeps the old sale price', () => {
    const d = prototypeNight()
    d.products.find(p => p.id === 'kings')!.priceCents = 30000
    expect(line(d, 'kings').salesCents).toBe(25000)
    expect(line(d, 'kings').stockValueCents).toBe(2 * 30000)
  })
  test('a voided sale is left out of sales, card and sold', () => {
    const d = prototypeNight()
    d.sales[1].void = { by: 'a', reason: 'Wrong item', at: '2026-11-28T19:06:00Z' }
    const t = shiftTotals(d)
    expect(t.salesCents).toBe(9000)
    expect(t.cardCents).toBe(0)
    expect(line(d, 'kings').sold).toBe(0)
  })
})

describe('pending stock out', () => {
  test('pending out is held aside and blocks lock', () => {
    const d = prototypeNight()
    d.moves[1].status = 'pending'
    expect(line(d, 'martian')).toMatchObject({ out: 0, pendingOut: 0.5, expected: 3.5 })
    const r = canLock(d)
    expect(r.ok).toBe(false)
    expect(r.reasons).toContain('pending_out')
  })
  test('rejected out does not change stock', () => {
    const d = prototypeNight()
    d.moves[1].status = 'rejected'
    expect(line(d, 'martian')).toMatchObject({ out: 0, pendingOut: 0, expected: 4 })
  })
})

describe('canLock', () => {
  test('everything done is ok', () => { expect(canLock(prototypeNight())).toEqual({ ok: true, reasons: [] }) })
  test('lists every missing item', () => {
    const d = prototypeNight()
    delete d.shift.cashCountedCents; delete d.shift.cardSlipCents; delete d.shift.pinOutBy; delete d.shift.pinInBy
    expect(canLock(d).reasons).toEqual(['no_cash_count', 'no_card_slip', 'missing_pin_out', 'missing_pin_in'])
  })
})

describe('changeDue', () => {
  test('R100 for R90 gives R10', () => { expect(changeDue(9000, 10000)).toBe(1000) })
  test('too little gives negative', () => { expect(changeDue(9000, 5000)).toBe(-4000) })
})

describe('shiftFlags', () => {
  const f = shiftFlags(prototypeNight())
  const codes = f.map(x => x.code)
  test('stock difference is bad and names the product', () => {
    const s = f.find(x => x.code === 'stock_diff')!
    expect(s.level).toBe('bad'); expect(s.productId).toBe('supercheese'); expect(s.text).toContain('Super Cheese')
  })
  test('cash and card match', () => { expect(codes).toContain('cash_ok'); expect(codes).toContain('card_ok') })
  test('stock out listed', () => { expect(codes).toContain('stock_out') })
  test('low stock lists Pink Ink', () => { expect(f.find(x => x.code === 'low_stock')!.text).toContain('Pink Ink') })
  test('category totals ok', () => { expect(codes).toContain('category_ok') })
  test('cash short is flagged bad', () => {
    const d = prototypeNight(); d.shift.cashCountedCents = 30000
    const c = shiftFlags(d).find(x => x.code === 'cash_diff')!
    expect(c.level).toBe('bad'); expect(c.text).toContain('−R50')
  })
  test('void is listed', () => {
    const d = prototypeNight(); d.sales[0].void = { by: 'a', reason: 'Wrong item', at: 'x' }
    expect(shiftFlags(d).map(x => x.code)).toContain('void')
  })
})
