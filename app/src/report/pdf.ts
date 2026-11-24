import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { displayName, itemLines, shiftFlags, shiftTotals } from '../domain/calc'
import { formatQty, formatRand } from '../domain/num'
import type { ShiftData } from '../domain/types'
import type { Names } from './xlsx'
import { SHOP } from '../app/brand'

/** The PDF's built-in font has no "−" or "✓". */
const safe = (s: string) => s.replace(/−/g, '-').replace(/✓/g, 'OK').replace(/ · /g, ', ').replace(/·/g, ',')
const catName: Record<string, string> = { main: 'Main', drinks: 'Drinks', rolling: 'Rolling' }

/** A4 report laid out like the paper sheet: header, one table per category, totals, logs and flags. */
export function buildPdf(d: ShiftData, names: Names = {}): Blob {
  const n = (id?: string) => (id ? names[id] ?? '' : '')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const t = shiftTotals(d)
  const lines = itemLines(d)
  const kind = d.shift.kind === 'day' ? 'Day' : 'Night'
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(150, 110, 30)
  doc.text(SHOP.name.toUpperCase() + '  -  ' + SHOP.address, 14, 10)
  doc.setTextColor(0, 0, 0); doc.setFontSize(16)
  doc.text(`${kind.toUpperCase()} SHIFT  ${d.shift.date}`, 14, 16)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text(safe(`${n(d.shift.openedBy)} -> ${n(d.shift.pinInBy)}   Locked ${d.shift.lockedAt ? new Date(d.shift.lockedAt).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' }) : 'NO'}`), 14, 22)
  doc.setLineWidth(0.6); doc.line(14, 24, 196, 24)

  let y = 28
  const body: (string | { content: string; colSpan: number; styles: object })[][] = []
  for (const c of [...new Set(d.products.map(p => p.categoryId))]) {
    body.push([{ content: catName[c] ?? c, colSpan: 10, styles: { fontStyle: 'bold', fillColor: [228, 231, 235] } }])
    for (const p of d.products.filter(x => x.categoryId === c)) {
      const l = lines.find(x => x.productId === p.id)!
      const q = (v: number) => (v ? formatQty(p, v) : '')
      body.push([displayName(p, d.products), formatRand(p.priceCents), q(l.open), q(l.stockIn), q(l.out), formatQty(p, l.counted ?? l.expected),
        q(l.sold), l.salesCents ? formatRand(l.salesCents) : '', formatRand(l.stockValueCents), l.diff ? safe(`${l.diff > 0 ? '+' : ''}${l.diff}`) : ''].map(x => typeof x === 'string' ? safe(x) : x))
    }
  }
  autoTable(doc, {
    startY: y, head: [['Product', 'Price', 'Open', 'In', 'Out', 'Close', 'Sold', 'Sales', 'Stock R', 'Diff']], body,
    styles: { fontSize: 8, cellPadding: 1 }, headStyles: { fillColor: [28, 31, 35] }, columnStyles: { 0: { cellWidth: 34 } },
    didParseCell: h => { if (h.section === 'body' && h.column.index === 9 && h.cell.raw) h.cell.styles.textColor = [179, 38, 30] },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6

  autoTable(doc, {
    startY: y, theme: 'plain', styles: { fontSize: 9, cellPadding: 0.8 }, tableWidth: 100,
    body: [
      ['Total sales', formatRand(t.salesCents)], ['Card sales (till)', formatRand(t.cardCents)],
      ['Card machine slip', d.shift.cardSlipCents != null ? formatRand(d.shift.cardSlipCents) : '-'], ['Cash sales', formatRand(t.cashCents)],
      ['Expenses', formatRand(t.expensesCents)], ['Float', formatRand(d.shift.floatCents)],
      ['Expected cash', formatRand(t.expectedCashCents)], ['Counted cash', d.shift.cashCountedCents != null ? formatRand(d.shift.cashCountedCents) : '-'],
    ].map(r => r.map(safe)),
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6

  const flags = shiftFlags(d, names)
  autoTable(doc, {
    startY: y, head: [['FLAGS']], body: flags.map(f => [safe(f.text)]), styles: { fontSize: 8.5, cellPadding: 1.2 },
    headStyles: { fillColor: [28, 31, 35] },
    didParseCell: h => { if (h.section === 'body') { const f = flags[h.row.index]; h.cell.styles.textColor = f.level === 'bad' ? [179, 38, 30] : f.level === 'ok' ? [30, 122, 79] : [28, 31, 35] } },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6

  const logs: string[][] = [
    ...d.moves.filter(m => m.kind === 'in').map(m => ['Stock in', safe(`${formatQty(d.products.find(p => p.id === m.productId)!, m.qty)} ${d.products.find(p => p.id === m.productId)!.name}`), n(m.by)]),
    ...d.moves.filter(m => m.kind === 'out').map(m => ['Stock out', safe(`${formatQty(d.products.find(p => p.id === m.productId)!, m.qty)} ${d.products.find(p => p.id === m.productId)!.name} - ${m.reason ?? ''} - ${m.status}`), n(m.decidedBy)]),
    ...d.expenses.map(e => ['Expense', safe(`${formatRand(e.cents)} ${e.note}`), n(e.by)]),
  ]
  if (logs.length) autoTable(doc, { startY: y, head: [['Log', 'What', 'Who']], body: logs, styles: { fontSize: 8, cellPadding: 1 }, headStyles: { fillColor: [28, 31, 35] } })
  return doc.output('blob')
}
