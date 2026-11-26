import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { displayName, itemLines, shiftFlags, shiftTotals } from '../domain/calc'
import { formatQty, formatRand } from '../domain/num'
import type { ShiftData } from '../domain/types'
import type { Names } from './xlsx'
import { SHOP } from '../app/brand'
import { certNumber, sealCode } from './names'

/** The PDF's built-in font has no "−", "✓" or "·". */
const safe = (s: string) => s.replace(/−/g, '-').replace(/✓/g, 'OK').replace(/ · /g, ', ').replace(/·/g, ',').replace(/’/g, "'")
/** The paper sheet's own section names. */
const SHEET_CAT: Record<string, string> = { main: 'Main products', drinks: 'Beverages', rolling: 'Rolling material', hubbly: 'Hubbly' }

type RGB = [number, number, number]
const INK: RGB = [24, 27, 31], MUTED: RGB = [105, 112, 120], GOLD: RGB = [150, 110, 30], GREEN: RGB = [22, 110, 40], RED: RGB = [179, 38, 30], LINE: RGB = [214, 218, 222]
const ZEBRA: RGB = [246, 247, 248], REDBG: RGB = [253, 236, 234], GREENBG: RGB = [232, 245, 236]

const dateLong = (iso: string) => new Date(`${iso}T12:00:00+02:00`).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Johannesburg' })
const clock = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg' }) : '-')
const lockedLong = (iso?: string) => (iso ? new Date(iso).toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg' }) : 'NOT LOCKED')

/** A4 shift report: summary first in the paper sheet's words, then what to check, the stock tables, the logs, and a certificate stamp. */
export function buildPdf(d: ShiftData, names: Names = {}, logoDataUrl?: string, notes: string[] = [], source: 'app' | 'paper' = 'app'): Blob {
  const n = (id?: string) => (id ? names[id] ?? '' : '')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210, M = 14, R = W - M
  const t = shiftTotals(d)
  const lines = itemLines(d)
  const kind = d.shift.kind === 'day' ? 'Day' : 'Night'
  const cert = certNumber(d.shift), seal = sealCode(d)
  const lastY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  const color = (c: RGB) => doc.setTextColor(c[0], c[1], c[2])
  const heading = (text: string, y: number) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); color(GOLD); doc.text(text.toUpperCase(), M, y)
    doc.setDrawColor(...GOLD); doc.setLineWidth(0.3); doc.line(M, y + 1.5, R, y + 1.5); color(INK)
    return y + 5
  }

  // ---------- Header ----------
  if (logoDataUrl) doc.addImage(logoDataUrl, 'PNG', M, 8, 20, 20)
  const hx = logoDataUrl ? M + 24 : M
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); color(GOLD); doc.text(safe(`${SHOP.name.toUpperCase()}  ·  ${SHOP.address}`), hx, 12)
  doc.setFontSize(20); color(INK); doc.text(`${kind.toUpperCase()} SHIFT REPORT`, hx, 20)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); color(MUTED); doc.text(dateLong(d.shift.date), hx, 26)
  // certificate tag, top right
  doc.setDrawColor(...GREEN); doc.setLineWidth(0.5); doc.roundedRect(R - 52, 9, 52, 13, 1.5, 1.5)
  doc.setFontSize(6.5); color(GREEN); doc.setFont('helvetica', 'bold'); doc.text('CERTIFICATE NO.', R - 49, 13.5)
  doc.setFont('courier', 'bold'); doc.setFontSize(10); doc.text(cert, R - 49, 19)

  const people = [d.shift.openedBy, ...(d.shift.helpers ?? [])].map(n).filter(Boolean).join(', ')
  const self = !!d.shift.pinInBy && d.shift.pinInBy === d.shift.pinOutBy
  autoTable(doc, {
    startY: 31, theme: 'plain', margin: { left: M, right: M }, styles: { fontSize: 9, cellPadding: { top: 0.6, bottom: 0.6, left: 0, right: 2 }, textColor: INK },
    columnStyles: { 0: { cellWidth: 28, textColor: MUTED }, 2: { cellWidth: 28, textColor: MUTED } },
    body: [
      ['On shift', safe(people), 'Opened', clock(d.shift.openedAt)],
      ['Handed over to', safe(self ? `${n(d.shift.pinInBy)} (staying on, counted alone)` : n(d.shift.pinInBy) || '-'), 'Locked', clock(d.shift.lockedAt)],
    ],
  })
  let y = lastY() + 5

  // ---------- Shift summary (paper-sheet words) ----------
  y = heading('Shift summary', y)
  const cashOnHand = t.salesCents - t.cardCents - t.expensesCents
  const diff = (v: number | null) => (v == null ? '-' : v === 0 ? 'Matches' : `${v > 0 ? 'Over' : 'Short'} ${formatRand(Math.abs(v))}`)
  // Short list in the paper sheet's words. Float only when there is one; card machine on one line when it matches.
  const cardOk = t.cardDiffCents === 0
  const rows: [string, string, RGB?, boolean?][] = [
    ['Total sales', formatRand(t.salesCents), undefined, true],
    [cardOk ? 'Card sales  (card machine matches)' : 'Card sales', formatRand(t.cardCents)],
    ...(!cardOk ? [['Card machine slip', d.shift.cardSlipCents != null ? formatRand(d.shift.cardSlipCents) : '-'] as [string, string],
      ['Card difference', diff(t.cardDiffCents), RED] as [string, string, RGB]] : []),
    ['Total expenses', formatRand(t.expensesCents)],
    ['Cash on hand', formatRand(cashOnHand), undefined, true],
    ...(d.shift.floatCents ? [['Plus float at the start', formatRand(d.shift.floatCents)] as [string, string]] : []),
    ['Cash counted', d.shift.cashCountedCents != null ? formatRand(d.shift.cashCountedCents) : '-'],
    ['Cash difference', diff(t.cashDiffCents), t.cashDiffCents ? RED : GREEN, true],
  ]
  autoTable(doc, {
    startY: y, theme: 'plain', margin: { left: M, right: M + 70 }, styles: { fontSize: 10.5, cellPadding: { top: 1.4, bottom: 1.4, left: 2, right: 2 }, textColor: INK },
    body: rows.map(r => [safe(r[0]), safe(r[1])]),
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold', cellWidth: 34 } },
    didParseCell: h => {
      const r = rows[h.row.index]
      if (r[3]) { h.cell.styles.fontStyle = 'bold'; h.cell.styles.fillColor = ZEBRA }
      if (r[2] && h.column.index === 1) h.cell.styles.textColor = r[2]
    },
  })
  // Big total, right of the summary
  const bx = R - 62, by = y
  doc.setFillColor(...ZEBRA); doc.roundedRect(bx, by, 62, 30, 2, 2, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); color(MUTED); doc.text('TOTAL SALES', bx + 5, by + 7)
  doc.setFontSize(22); color(INK); doc.text(safe(formatRand(t.salesCents)), bx + 5, by + 18)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); color(MUTED)
  doc.text(safe(`card ${formatRand(t.cardCents)}  ·  cash ${formatRand(t.cashCents)}`), bx + 5, by + 25)
  y = Math.max(lastY(), by + 30) + 6

  // ---------- Things to check ----------
  const flags = shiftFlags(d, names)
  // Cash and card differences are already in the summary above.
  const issues = flags.filter(f => (f.level === 'bad' || f.level === 'warn') && f.code !== 'cash_diff' && f.code !== 'card_diff')
  y = heading(issues.length ? `Things to check (${issues.length})` : 'Things to check', y)
  autoTable(doc, {
    startY: y, theme: 'plain', margin: { left: M, right: M }, styles: { fontSize: 9, cellPadding: { top: 1.2, bottom: 1.2, left: 3, right: 2 } },
    body: issues.length ? issues.map(f => [safe(f.text)]) : [['Nothing to check. Stock, cash and card all add up.']],
    didParseCell: h => {
      const f = issues[h.row.index]
      h.cell.styles.fillColor = !f ? GREENBG : f.level === 'bad' ? REDBG : ZEBRA
      h.cell.styles.textColor = !f ? GREEN : f.level === 'bad' ? RED : INK
    },
  })
  y = lastY() + 6

  // ---------- Stock, one table per sheet section ----------
  y = heading('Stock', y)
  const head = [['Product', 'Price', 'Open', 'Stock in', 'Out', 'Close', 'Sold', 'Sales (R)', 'Total stock (R)', 'Diff']]
  const body: (string | { content: string; colSpan?: number; styles?: object })[][] = []
  const diffRows = new Set<number>()
  for (const c of [...new Set(d.products.map(p => p.categoryId))]) {
    // Items no longer sold are left out unless they had stock or movement this shift.
    const ps = d.products.filter(x => x.categoryId === c && (x.active || lines.some(l => l.productId === x.id && (l.open || l.sold || l.stockIn || l.out || l.counted))))
    body.push([{ content: SHEET_CAT[c] ?? c, colSpan: 10, styles: { fontStyle: 'bold', fillColor: [226, 230, 234], textColor: INK } }])
    for (const p of ps) {
      const l = lines.find(x => x.productId === p.id)!
      const q = (v: number) => (v ? formatQty(p, v) : '')
      if (p.track === false) { body.push([displayName(p, d.products), formatRand(p.priceCents), '', '', '', '', q(l.sold), l.salesCents ? formatRand(l.salesCents) : '', 'no count', ''].map(safe)); continue }
      if (l.diff) diffRows.add(body.length)
      body.push([displayName(p, d.products), formatRand(p.priceCents), q(l.open), q(l.stockIn), q(l.out), formatQty(p, l.counted ?? l.expected),
        q(l.sold), l.salesCents ? formatRand(l.salesCents) : '', formatRand(l.stockValueCents),
        l.diff ? `${l.diff > 0 ? '+' : '-'}${formatQty(p, Math.abs(l.diff))}` : ''].map(safe))
    }
    const ls = lines.filter(l => ps.some(p => p.id === l.productId))
    body.push([{ content: `${SHEET_CAT[c] ?? c} total`, colSpan: 7, styles: { fontStyle: 'bold', halign: 'right' } },
      { content: safe(formatRand(ls.reduce((a, l) => a + l.salesCents, 0))), styles: { fontStyle: 'bold' } },
      { content: safe(formatRand(ls.reduce((a, l) => a + l.stockValueCents, 0))), styles: { fontStyle: 'bold' } }, ''])
  }
  autoTable(doc, {
    startY: y, head, body, margin: { left: M, right: M, bottom: 18 },
    styles: { fontSize: 8.2, cellPadding: 1.1, lineColor: LINE, lineWidth: 0.1, textColor: INK },
    headStyles: { fillColor: INK, textColor: [255, 255, 255], fontSize: 7.8 },
    columnStyles: { 0: { cellWidth: 36 }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' },
      6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'right' }, 9: { halign: 'right', fontStyle: 'bold' } },
    didParseCell: h => {
      if (h.section !== 'body') return
      if (diffRows.has(h.row.index)) { h.cell.styles.fillColor = REDBG; if (h.column.index === 9) h.cell.styles.textColor = RED }
    },
  })
  y = lastY() + 6

  // ---------- Logs ----------
  const prod = (id: string) => d.products.find(p => p.id === id)!
  const logs: string[][] = [
    ...d.moves.filter(m => m.kind === 'in').map(m => [clock(m.at), 'Stock in', `${formatQty(prod(m.productId), m.qty)} ${prod(m.productId).name}`, n(m.by)]),
    ...d.moves.filter(m => m.kind === 'out').map(m => [clock(m.at), 'Stock out', `${formatQty(prod(m.productId), m.qty)} ${prod(m.productId).name}, ${m.reason ?? ''}: ${m.status}${m.decidedBy ? ` by ${n(m.decidedBy)}` : ''}`, n(m.by)]),
    ...d.expenses.map(e => [clock(e.at), 'Expense', `${formatRand(e.cents)} ${e.note}`, n(e.by)]),
    ...d.sales.filter(s => s.void).map(s => [clock(s.at), 'Voided sale', `${formatRand(Math.round(s.lines.reduce((a, l) => a + l.qty * l.unitCents, 0)))}: ${s.void!.reason}`, n(s.void!.by)]),
  ].sort((a, b) => a[0].localeCompare(b[0])).map(r => (source === 'paper' ? r.slice(1) : r).map(safe))
  if (logs.length) {
    if (y > 250) { doc.addPage(); y = 18 }
    y = heading('Stock in, stock out and expenses', y)
    const timed = source !== 'paper'
    autoTable(doc, { startY: y, head: [timed ? ['Time', 'What', 'Details', 'Who'] : ['What', 'Details', 'Who']], body: logs, margin: { left: M, right: M, bottom: 18 },
      styles: { fontSize: 8.6, cellPadding: 1.2, lineColor: LINE, lineWidth: 0.1, textColor: INK }, headStyles: { fillColor: INK, textColor: [255, 255, 255] },
      columnStyles: timed ? { 0: { cellWidth: 14 }, 1: { cellWidth: 24, fontStyle: 'bold' }, 3: { cellWidth: 34 } } : { 0: { cellWidth: 24, fontStyle: 'bold' }, 2: { cellWidth: 34 } } })
    y = lastY() + 6
  }

  // ---------- Notes (e.g. a report typed from the paper sheet) ----------
  if (notes.length) {
    if (y > 250) { doc.addPage(); y = 18 }
    y = heading('Notes', y)
    autoTable(doc, { startY: y, theme: 'plain', margin: { left: M, right: M, bottom: 18 }, body: notes.map(t => [safe(t)]),
      styles: { fontSize: 9, cellPadding: { top: 1.1, bottom: 1.1, left: 3, right: 2 }, textColor: INK, fillColor: ZEBRA } })
    y = lastY() + 6
  }

  // ---------- Certificate stamp ----------
  if (y > 297 - 18 - 52) { doc.addPage(); y = 18 }
  drawStamp(doc, R - 26, y + 25, cert, seal, d.shift.lockedAt ? lockedLong(d.shift.lockedAt) : 'NOT LOCKED', kind)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); color(INK); doc.text(source === 'paper' ? 'Shift report from the paper sheet' : 'Certified shift report', M, y + 10)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); color(MUTED)
  doc.text(doc.splitTextToSize(safe(source === 'paper'
    ? `This report was typed from the handwritten shift sheet on ${lockedLong(d.shift.lockedAt)}. The certificate number ${cert} links it to this shift in the app. ` +
      `Seal ${seal} belongs to this paper copy only.`
    : `This report was made by the till app and locked at ${lockedLong(d.shift.lockedAt)} with two PINs` +
      `${self ? ' (the same person, staying on)' : ''}. To check a printout, open the app, go to Reports and type the certificate number ${cert}. ` +
      `The seal code ${seal} must match. If any number on this page was changed, the seal will not match.`), 120), M, y + 16)
  doc.setFont('courier', 'bold'); doc.setFontSize(9); color(GREEN); doc.text(`${cert}   SEAL ${seal}`, M, y + 40)

  // ---------- Footer on every page ----------
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.line(M, 285, R, 285)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); color(MUTED)
    doc.text(safe(`${SHOP.name}  ·  ${kind} shift ${d.shift.date}`), M, 289.5)
    doc.text(`Certificate ${cert}  ·  Seal ${seal}  ·  Page ${i} of ${pages}`, R, 289.5, { align: 'right' })
  }
  return doc.output('blob')
}

/** A round rubber-stamp seal: text around the ring, the certificate number across the middle. */
function drawStamp(doc: jsPDF, cx: number, cy: number, cert: string, seal: string, locked: string, kind: string) {
  const [r, g, b] = GREEN
  doc.setDrawColor(r, g, b); doc.setTextColor(r, g, b)
  doc.setLineWidth(1.1); doc.circle(cx, cy, 24, 'S')
  doc.setLineWidth(0.35); doc.circle(cx, cy, 21.6, 'S'); doc.circle(cx, cy, 13.2, 'S')
  /** Letters spaced by their width along an arc centred on the top (270°) or bottom (90°) of the ring. */
  const ring = (text: string, radius: number, top: boolean) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.8)
    const gap = 0.55, ws = [...text].map(ch => doc.getTextWidth(ch))
    const total = ws.reduce((x, w) => x + w + gap, -gap)
    let pos = -total / 2
    ;[...text].forEach((ch, i) => {
      const mid = pos + ws[i] / 2; pos += ws[i] + gap
      const deg = top ? 270 + (mid / radius) * 180 / Math.PI : 90 - (mid / radius) * 180 / Math.PI
      const rad = (deg * Math.PI) / 180
      // reading direction along the ring
      const tx = top ? -Math.sin(rad) : Math.sin(rad), ty = top ? Math.cos(rad) : -Math.cos(rad)
      // baseline point: on the ring, moved back half a letter so the letter is centred on its spot
      const x = cx + radius * Math.cos(rad) - (ws[i] / 2) * tx, y = cy + radius * Math.sin(rad) - (ws[i] / 2) * ty
      doc.text(ch, x, y, { angle: top ? -(deg + 90) : -(deg - 90) })
    })
  }
  ring(SHOP.name.toUpperCase(), 17.6, true)
  ring(`CERTIFIED ${kind.toUpperCase()} SHIFT`, 19.8, false)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(5.6); doc.text('*', cx - 22.8, cy + 0.8); doc.text('*', cx + 22.2, cy + 0.8)
  doc.setFont('courier', 'bold'); doc.setFontSize(6.4)
  doc.text(cert.split('-').slice(0, 2).join('-'), cx, cy - 2.6, { align: 'center' })
  doc.text(cert.split('-').slice(2).join('-'), cx, cy + 0.6, { align: 'center' })
  doc.setFont('helvetica', 'bold'); doc.setFontSize(5.4); doc.text(`SEAL ${seal}`, cx, cy + 4.6, { align: 'center' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(4.6); doc.text(locked.toUpperCase(), cx, cy + 8.4, { align: 'center' })
}
