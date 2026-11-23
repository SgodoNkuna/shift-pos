import type { Product, ShiftData, Shift } from './types'

const P = (id: string, name: string, categoryId: string, rand: number, unit: 'ea' | 'g'): Product =>
  ({ id, name, categoryId, unit, step: unit === 'g' ? 0.5 : 1, lowAt: unit === 'g' ? 1 : 3, priceCents: rand * 100, active: true })

/** Products and opening counts from the paper sheet (closing counts of 28 Nov day shift). */
export const SHEET_PRODUCTS: Product[] = [
  P('outdoor', 'Outdoor', 'main', 20, 'ea'), P('supercheese', 'Super Cheese', 'main', 30, 'ea'),
  P('castro', 'Castro Pop', 'main', 60, 'ea'), P('exodus', 'Exodus C', 'main', 80, 'ea'),
  P('pinkink', 'Pink Ink', 'main', 100, 'g'), P('eucalypto', 'Eucalypto', 'main', 100, 'g'),
  P('cadillac', 'Cadillac', 'main', 120, 'g'), P('icecool', 'Ice Cool', 'main', 120, 'g'),
  P('grapeballs', 'Grape Balls', 'main', 150, 'g'), P('martian', 'Martian F', 'main', 150, 'g'),
  P('gummies', 'Gummies', 'main', 30, 'ea'), P('kings', 'Kings', 'main', 250, 'ea'),
  P('coke', 'Coke', 'drinks', 20, 'ea'), P('sprite', 'Sprite', 'drinks', 20, 'ea'),
  P('monster', 'Monster', 'drinks', 25, 'ea'), P('powerade', 'Powerade', 'drinks', 25, 'ea'),
  P('bluestar', 'Blue Star', 'rolling', 20, 'ea'), P('bobmarley', 'Bob Marley', 'rolling', 20, 'ea'),
  P('limitless', 'Limitless', 'rolling', 30, 'ea'), P('rizla30', 'Rizla', 'rolling', 30, 'ea'),
  P('rizla20', 'Rizla', 'rolling', 20, 'ea'), P('bejo', 'Bejo', 'rolling', 30, 'ea'),
  P('raw', 'Raw', 'rolling', 40, 'ea'), P('honeyp', 'Honey P', 'rolling', 20, 'ea'),
]

export const SHEET_OPENING: Record<string, number> = {
  outdoor: 59, supercheese: 25, castro: 29, exodus: 26, pinkink: 1, eucalypto: 1, cadillac: 3, icecool: 3,
  grapeballs: 5, martian: 4, gummies: 8, kings: 3, coke: 0, sprite: 0, monster: 5, powerade: 0,
  bluestar: 18, bobmarley: 4, limitless: 50, rizla30: 50, rizla20: 13, bejo: 12, raw: 12, honeyp: 3,
}

const shift = (over: Partial<Shift>): Shift => ({
  id: 's1', kind: 'night', date: '2026-11-28', openedBy: 'a', openedAt: '2026-11-28T18:02:00Z',
  opening: {}, floatCents: 0, ...over,
})

/** Three rows of the 28 Nov day sheet, as till sales. */
export function sheet28Nov(): ShiftData {
  const sale = (id: string, productId: string, qty: number, unitCents: number) =>
    ({ id, shiftId: 's1', at: '2026-11-28T08:30:00Z', by: 'x', lines: [{ productId, qty, unitCents }], payments: [{ method: 'cash' as const, cents: qty * unitCents }] })
  return {
    shift: shift({ kind: 'day', opening: { outdoor: 44, supercheese: 17, exodus: 27 }, counts: { outdoor: 59, supercheese: 25, exodus: 26 } }),
    products: SHEET_PRODUCTS.filter(p => ['outdoor', 'supercheese', 'exodus'].includes(p.id)),
    sales: [sale('a', 'outdoor', 13, 2000), sale('b', 'supercheese', 26, 3000), sale('c', 'exodus', 1, 8000)],
    moves: [
      { id: 'm1', shiftId: 's1', productId: 'outdoor', qty: 28, kind: 'in', status: 'done', by: 'x', at: '2026-11-28T09:00:00Z' },
      { id: 'm2', shiftId: 's1', productId: 'supercheese', qty: 34, kind: 'in', status: 'done', by: 'x', at: '2026-11-28T09:00:00Z' },
    ],
    expenses: [],
  }
}

/** The money lines of the 28 Nov sheet: total R2,905, card R2,370, expenses R40, no float. */
export function sheet28NovMoney(): ShiftData {
  return {
    shift: shift({ kind: 'day' }),
    products: [P('misc', 'All sales', 'main', 2905, 'ea')],
    sales: [{ id: 'a', shiftId: 's1', at: '2026-11-28T10:00:00Z', by: 'x', lines: [{ productId: 'misc', qty: 1, unitCents: 290500 }],
      payments: [{ method: 'card', cents: 237000 }, { method: 'cash', cents: 53500 }] }],
    moves: [],
    expenses: [
      { id: 'e1', shiftId: 's1', cents: 2000, note: 'Expense 1', by: 'x', at: '2026-11-28T10:00:00Z' },
      { id: 'e2', shiftId: 's1', cents: 2000, note: 'Expense 2', by: 'x', at: '2026-11-28T11:00:00Z' },
    ],
  }
}

/** The night shift played in the approved prototype. */
export function prototypeNight(): ShiftData {
  return {
    shift: shift({ opening: { ...SHEET_OPENING }, floatCents: 20000, counts: { supercheese: 23 }, cashCountedCents: 35000, cardSlipCents: 20000, pinOutBy: 'a', pinInBy: 'b' }),
    products: SHEET_PRODUCTS.map(p => ({ ...p })),
    sales: [
      { id: 'x1', shiftId: 's1', at: '2026-11-28T18:41:00Z', by: 'a', lines: [{ productId: 'outdoor', qty: 2, unitCents: 2000 }, { productId: 'pinkink', qty: 0.5, unitCents: 10000 }], payments: [{ method: 'cash', cents: 9000 }] },
      { id: 'x2', shiftId: 's1', at: '2026-11-28T19:05:00Z', by: 'a', lines: [{ productId: 'kings', qty: 1, unitCents: 25000 }, { productId: 'supercheese', qty: 1, unitCents: 3000 }], payments: [{ method: 'card', cents: 20000 }, { method: 'cash', cents: 8000 }] },
    ],
    moves: [
      { id: 'm1', shiftId: 's1', productId: 'coke', qty: 24, kind: 'in', status: 'done', by: 'a', at: '2026-11-28T19:30:00Z' },
      { id: 'm2', shiftId: 's1', productId: 'martian', qty: 0.5, kind: 'out', status: 'approved', reason: 'Given to boss', by: 'a', at: '2026-11-28T20:14:00Z', decidedBy: 'boss', decidedAt: '2026-11-28T20:21:00Z' },
    ],
    expenses: [{ id: 'e1', shiftId: 's1', cents: 2000, note: 'Cleaning supplies', by: 'a', at: '2026-11-28T21:10:00Z' }],
  }
}
