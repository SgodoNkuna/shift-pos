import { roundQty, formatQty, formatRand } from './num'
import type { Product, Sale, ShiftData } from './types'

export interface ItemLine {
  productId: string
  open: number
  stockIn: number
  /** Approved stock out */
  out: number
  pendingOut: number
  /** Sold on the till (voided sales excluded) */
  sold: number
  expected: number
  counted: number | null
  diff: number | null
  diffCents: number | null
  salesCents: number
  stockValueCents: number
}

export interface ShiftTotals {
  salesCents: number
  cardCents: number
  cashCents: number
  expensesCents: number
  expectedCashCents: number
  cashDiffCents: number | null
  cardDiffCents: number | null
  categorySalesCents: Record<string, number>
}

export type FlagCode = 'opening_changed' | 'stock_diff' | 'cash_diff' | 'card_diff' | 'cash_ok' | 'card_ok' | 'stock_out'
  | 'low_stock' | 'category_mismatch' | 'category_ok' | 'void' | 'self_handover'
export interface Flag { level: 'bad' | 'warn' | 'ok' | 'info'; code: FlagCode; text: string; productId?: string }

export type LockReason = 'pending_out' | 'no_cash_count' | 'no_card_slip' | 'missing_pin_out' | 'missing_pin_in'

const live = (sales: Sale[]) => sales.filter(s => !s.void)
const sumBy = <T>(xs: T[], f: (x: T) => number) => xs.reduce((a, x) => a + f(x), 0)

/** Shows the price when two products share a name (e.g. two Rizlas). */
export function displayName(p: Product, all: Product[]): string {
  return all.filter(x => x.name === p.name).length > 1 ? `${p.name} R${p.priceCents / 100}` : p.name
}

export function itemLines(d: ShiftData): ItemLine[] {
  const sales = live(d.sales)
  return d.products.map(p => {
    const moves = d.moves.filter(m => m.productId === p.id)
    const qtyOf = (f: (m: (typeof moves)[number]) => boolean) => roundQty(sumBy(moves.filter(f), m => m.qty))
    const counted0 = p.track === false ? undefined : d.shift.counts?.[p.id]
    const open = p.track === false ? 0 : d.shift.opening[p.id] ?? 0
    const stockIn = qtyOf(m => m.kind === 'in' && m.status === 'done')
    const out = qtyOf(m => m.kind === 'out' && m.status === 'approved')
    const pendingOut = qtyOf(m => m.kind === 'out' && m.status === 'pending')
    const lines = sales.flatMap(s => s.lines.filter(l => l.productId === p.id))
    const sold = roundQty(sumBy(lines, l => l.qty))
    const salesCents = Math.round(sumBy(lines, l => l.qty * l.unitCents))
    const expected = p.track === false ? 0 : roundQty(open + stockIn - out - pendingOut - sold)
    const c = counted0
    const counted = c == null ? null : roundQty(c)
    const diff = counted == null ? null : roundQty(counted - expected)
    return {
      productId: p.id, open, stockIn, out, pendingOut, sold, expected, counted, diff,
      diffCents: diff == null ? null : Math.round(diff * p.priceCents),
      salesCents,
      stockValueCents: Math.round((counted ?? expected) * p.priceCents),
    }
  })
}

export function shiftTotals(d: ShiftData): ShiftTotals {
  const sales = live(d.sales)
  const salesCents = Math.round(sumBy(sales, s => sumBy(s.lines, l => l.qty * l.unitCents)))
  const cardCents = sumBy(sales, s => sumBy(s.payments.filter(p => p.method === 'card'), p => p.cents))
  const cashCents = salesCents - cardCents
  const expensesCents = sumBy(d.expenses, e => e.cents)
  const expectedCashCents = d.shift.floatCents + cashCents - expensesCents
  const categorySalesCents: Record<string, number> = {}
  for (const s of sales) for (const l of s.lines) {
    const cat = d.products.find(p => p.id === l.productId)?.categoryId ?? 'unknown'
    categorySalesCents[cat] = Math.round((categorySalesCents[cat] ?? 0) + l.qty * l.unitCents)
  }
  return {
    salesCents, cardCents, cashCents, expensesCents, expectedCashCents,
    cashDiffCents: d.shift.cashCountedCents == null ? null : d.shift.cashCountedCents - expectedCashCents,
    cardDiffCents: d.shift.cardSlipCents == null ? null : d.shift.cardSlipCents - cardCents,
    categorySalesCents,
  }
}

export const changeDue = (totalCents: number, tenderedCents: number): number => tenderedCents - totalCents

/** `names` maps staff ids to names so flags read "approved by Rori", not an id. */
export function shiftFlags(d: ShiftData, names: Record<string, string> = {}): Flag[] {
  const flags: Flag[] = []
  const who = (id?: string) => (id ? names[id] ?? id : '')
  const name = (id: string) => { const p = d.products.find(x => x.id === id)!; return displayName(p, d.products) }
  const prod = (id: string) => d.products.find(x => x.id === id)!
  const lines = itemLines(d)

  if (d.shift.pinInBy && d.shift.pinInBy === d.shift.pinOutBy) flags.push({ level: 'warn', code: 'self_handover',
    text: `Counted alone: ${who(d.shift.pinOutBy)} closed this shift and is working the next one. Boss and manager were alerted.` })
  const changes = Object.entries(d.shift.openingChanges ?? {})
  if (changes.length) flags.push({ level: 'warn', code: 'opening_changed',
    text: `Opening count changed at clock in: ${changes.map(([id, c]) => `${name(id)} ${formatQty(prod(id), c.from)} → ${formatQty(prod(id), c.to)}`).join(', ')}`
      + ` (by ${[...new Set(changes.map(([, c]) => who(c.by)))].join(', ')})` })

  for (const l of lines) if (l.diff) {
    const p = prod(l.productId)
    flags.push({ level: 'bad', code: 'stock_diff', productId: p.id,
      text: `${name(p.id)}: counted ${formatQty(p, l.counted!)}, expected ${formatQty(p, l.expected)} (${l.diff > 0 ? '+' : '−'}${formatQty(p, Math.abs(l.diff))} · ${formatRand(l.diffCents!)})` })
  }

  const t = shiftTotals(d)
  if (t.cardDiffCents != null) flags.push(t.cardDiffCents
    ? { level: 'bad', code: 'card_diff', text: `Card slip ${formatRand(d.shift.cardSlipCents!)} vs till card sales ${formatRand(t.cardCents)} (${formatRand(t.cardDiffCents)})` }
    : { level: 'ok', code: 'card_ok', text: `Card slip matches till card sales (${formatRand(t.cardCents)})` })
  if (t.cashDiffCents != null) flags.push(t.cashDiffCents
    ? { level: 'bad', code: 'cash_diff', text: `Cash counted ${formatRand(d.shift.cashCountedCents!)} vs expected ${formatRand(t.expectedCashCents)} (${t.cashDiffCents! > 0 ? 'over +' : 'short '}${formatRand(t.cashDiffCents)})` }
    : { level: 'ok', code: 'cash_ok', text: `Cash counted matches expected (${formatRand(t.expectedCashCents)})` })

  for (const m of d.moves.filter(m => m.kind === 'out')) {
    const p = prod(m.productId)
    flags.push({ level: m.status === 'rejected' ? 'bad' : m.status === 'pending' ? 'warn' : 'info', code: 'stock_out', productId: p.id,
      text: `Stock out ${formatQty(p, m.qty)} ${name(p.id)} · ${m.reason ?? 'No reason'} · ${m.status}${m.decidedBy ? ` by ${who(m.decidedBy)}` : ''}` })
  }

  for (const s of d.sales.filter(s => s.void)) flags.push({ level: 'warn', code: 'void',
    text: `Voided sale ${formatRand(Math.round(sumBy(s.lines, l => l.qty * l.unitCents)))} · ${s.void!.reason} · by ${who(s.void!.by)}` })

  const low = lines.filter(l => prod(l.productId).active && prod(l.productId).track !== false && (l.counted ?? l.expected) <= prod(l.productId).lowAt)
  if (low.length) flags.push({ level: 'warn', code: 'low_stock',
    text: `Low or out of stock: ${low.map(l => `${name(l.productId)} ${formatQty(prod(l.productId), l.counted ?? l.expected)}`).join(', ')}` })

  const catSum = sumBy(Object.values(t.categorySalesCents), x => x)
  flags.push(catSum === t.salesCents
    ? { level: 'ok', code: 'category_ok', text: `Category totals add up to total sales (${formatRand(t.salesCents)})` }
    : { level: 'bad', code: 'category_mismatch', text: `Category totals ${formatRand(catSum)} do not match total sales ${formatRand(t.salesCents)}` })
  return flags
}

export function canLock(d: ShiftData): { ok: boolean; reasons: LockReason[] } {
  const reasons: LockReason[] = []
  if (d.moves.some(m => m.kind === 'out' && m.status === 'pending')) reasons.push('pending_out')
  if (d.shift.cashCountedCents == null) reasons.push('no_cash_count')
  if (d.shift.cardSlipCents == null) reasons.push('no_card_slip')
  if (!d.shift.pinOutBy) reasons.push('missing_pin_out')
  if (!d.shift.pinInBy) reasons.push('missing_pin_in')
  return { ok: reasons.length === 0, reasons }
}

export interface ProfitLine { productId: string; sold: number; salesCents: number; costCents: number | null; profitCents: number | null }

/** Boss only. Profit on what was sold; items with no cost price are listed in `missing` and left out of the totals. */
export function profit(d: ShiftData, costs: Record<string, number>) {
  const lines: ProfitLine[] = itemLines(d).filter(l => l.sold > 0).map(l => {
    const c = costs[l.productId]
    const costCents = c == null ? null : Math.round(l.sold * c)
    return { productId: l.productId, sold: l.sold, salesCents: l.salesCents, costCents, profitCents: costCents == null ? null : l.salesCents - costCents }
  })
  const known = lines.filter(l => l.costCents != null)
  return {
    lines,
    salesCents: sumBy(known, l => l.salesCents),
    costCents: sumBy(known, l => l.costCents!),
    profitCents: sumBy(known, l => l.profitCents!),
    missing: lines.filter(l => l.costCents == null).map(l => l.productId),
  }
}

/** Totals over several shifts for the Reports screen. `profitCents` only counts items that have a cost price. */
export function periodSummary(ds: ShiftData[], costs: Record<string, number>) {
  const t = ds.map(shiftTotals)
  const sold = new Map<string, { qty: number; salesCents: number }>()
  for (const d of ds) for (const l of itemLines(d)) if (l.sold) {
    const x = sold.get(l.productId) ?? { qty: 0, salesCents: 0 }
    sold.set(l.productId, { qty: roundQty(x.qty + l.sold), salesCents: x.salesCents + l.salesCents })
  }
  return {
    shifts: ds.length,
    salesCents: sumBy(t, x => x.salesCents), cardCents: sumBy(t, x => x.cardCents), cashCents: sumBy(t, x => x.cashCents),
    expensesCents: sumBy(t, x => x.expensesCents),
    cashDiffCents: sumBy(t, x => x.cashDiffCents ?? 0),
    stockDiffCents: sumBy(ds, d => sumBy(itemLines(d), l => l.diffCents ?? 0)),
    profitCents: sumBy(ds, d => profit(d, costs).profitCents),
    top: [...sold.entries()].map(([productId, v]) => ({ productId, ...v })).sort((a, b) => b.salesCents - a.salesCents).slice(0, 5),
  }
}
