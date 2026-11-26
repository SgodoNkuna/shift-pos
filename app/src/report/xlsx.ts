import ExcelJS from 'exceljs'
import { SHOP } from '../app/brand'
import { displayName, itemLines, shiftFlags, shiftTotals } from '../domain/calc'
import type { ShiftData } from '../domain/types'

export type Names = Record<string, string>
const R = (cents: number | null | undefined) => (cents == null ? null : cents / 100)

export { reportFileName } from './names'

export async function buildXlsxBuffer(d: ShiftData, names: Names = {}): Promise<ArrayBuffer> {
  const n = (id?: string) => (id ? names[id] ?? id : '')
  const t = shiftTotals(d)
  const wb = new ExcelJS.Workbook()
  wb.creator = SHOP.name
  const head = (ws: ExcelJS.Worksheet) => { ws.getRow(1).font = { bold: true }; ws.views = [{ state: 'frozen', ySplit: 1 }] }

  const sum = wb.addWorksheet('Summary')
  sum.columns = [{ header: 'Item', width: 26 }, { header: 'Value', width: 22 }]
  sum.addRows([
    ['Shift', d.shift.kind === 'day' ? 'Day' : 'Night'], ['Date', d.shift.date],
    ['Opened by', n(d.shift.openedBy)], ['Also on shift', (d.shift.helpers ?? []).map(n).join(', ')], ['Handed over to', n(d.shift.pinInBy)],
    ['Locked at', d.shift.lockedAt ?? ''], ['Total sales (R)', R(t.salesCents)], ['Card sales (R)', R(t.cardCents)],
    ['Cash sales (R)', R(t.cashCents)], ['Expenses (R)', R(t.expensesCents)], ['Float (R)', R(d.shift.floatCents)],
    ['Expected cash (R)', R(t.expectedCashCents)], ['Counted cash (R)', R(d.shift.cashCountedCents)], ['Cash difference (R)', R(t.cashDiffCents)],
    ['Card machine slip (R)', R(d.shift.cardSlipCents)], ['Card difference (R)', R(t.cardDiffCents)],
  ])
  head(sum)

  const items = wb.addWorksheet('Items')
  items.columns = ['Category', 'Product', 'Price (R)', 'Open', 'In', 'Out', 'Close', 'Sold', 'Sales (R)', 'Stock (R)', 'Diff', 'Diff (R)']
    .map((h, i) => ({ header: h, width: i === 1 ? 18 : 11 }))
  for (const l of itemLines(d)) {
    const p = d.products.find(x => x.id === l.productId)!
    items.addRow([p.categoryId, displayName(p, d.products), R(p.priceCents), l.open, l.stockIn, l.out, l.counted ?? l.expected, l.sold, R(l.salesCents), R(l.stockValueCents), l.diff ?? 0, R(l.diffCents ?? 0)])
  }
  head(items)

  const sl = wb.addWorksheet('Sales lines')
  sl.columns = ['Time', 'Sold by', 'Product', 'Qty', 'Price (R)', 'Line (R)', 'Paid card (R)', 'Paid cash (R)', 'Voided'].map(h => ({ header: h, width: 14 }))
  for (const s of d.sales) {
    const card = s.payments.filter(p => p.method === 'card').reduce((a, p) => a + p.cents, 0)
    const cash = s.payments.filter(p => p.method === 'cash').reduce((a, p) => a + p.cents, 0)
    s.lines.forEach((l, i) => {
      const p = d.products.find(x => x.id === l.productId)
      sl.addRow([s.at, n(s.by), p ? displayName(p, d.products) : l.productId, l.qty, R(l.unitCents), R(Math.round(l.qty * l.unitCents)),
        i === 0 ? R(card) : null, i === 0 ? R(cash) : null, s.void ? `${s.void.reason} (${n(s.void.by)})` : ''])
    })
  }
  head(sl)

  const name = (pid: string) => { const p = d.products.find(x => x.id === pid); return p ? displayName(p, d.products) : pid }
  const si = wb.addWorksheet('Stock in')
  si.columns = ['Time', 'By', 'Product', 'Qty'].map(h => ({ header: h, width: 16 }))
  d.moves.filter(m => m.kind === 'in').forEach(m => si.addRow([m.at, n(m.by), name(m.productId), m.qty]))
  head(si)

  const so = wb.addWorksheet('Stock out')
  so.columns = ['Time', 'Asked by', 'Product', 'Qty', 'Status', 'Reason', 'Decided by', 'Decided at'].map(h => ({ header: h, width: 15 }))
  d.moves.filter(m => m.kind === 'out').forEach(m => so.addRow([m.at, n(m.by), name(m.productId), m.qty, m.status, m.reason ?? '', n(m.decidedBy), m.decidedAt ?? '']))
  head(so)

  const ex = wb.addWorksheet('Expenses')
  ex.columns = ['Time', 'By', 'Amount (R)', 'Note'].map(h => ({ header: h, width: 18 }))
  d.expenses.forEach(e => ex.addRow([e.at, n(e.by), R(e.cents), e.note]))
  head(ex)

  const fl = wb.addWorksheet('Flags')
  fl.columns = [{ header: 'Level', width: 8 }, { header: 'Flag', width: 90 }]
  shiftFlags(d, names).forEach(f => fl.addRow([f.level, f.text]))
  head(fl)

  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>
}

export async function buildXlsx(d: ShiftData, names: Names = {}): Promise<Blob> {
  return new Blob([await buildXlsxBuffer(d, names)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
