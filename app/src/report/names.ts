import type { ShiftData } from '../domain/types'

export const reportFileName = (d: ShiftData, ext: 'pdf' | 'xlsx') =>
  `${d.shift.kind === 'day' ? 'Day' : 'Night'}-${d.shift.date}.${ext}`

/** Certificate number printed on every locked report: shop, date, Day/Night and the start of the shift's id. */
export function certNumber(s: { id: string; date: string; kind: 'day' | 'night' }): string {
  return `HCL-${s.date.replace(/-/g, '').slice(2)}-${s.kind === 'day' ? 'D' : 'N'}-${s.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`
}

/** A short seal made from the locked numbers. A printout whose numbers were changed will not match the app. */
export function sealCode(d: ShiftData): string {
  const s = d.shift
  const sales = d.sales.filter(x => !x.void).reduce((a, x) => a + x.lines.reduce((b, l) => b + Math.round(l.qty * l.unitCents), 0), 0)
  const text = [s.id, s.lockedAt ?? '', sales, s.cashCountedCents ?? '', s.cardSlipCents ?? '', JSON.stringify(s.counts ?? {})].join('|')
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(16).toUpperCase().padStart(8, '0').slice(0, 4)
}

/** Matches a typed certificate number (any case, with or without dashes) to a shift. */
export const certMatches = (typed: string, s: { id: string; date: string; kind: 'day' | 'night' }) => {
  const t = typed.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return t.length >= 6 && certNumber(s).replace(/-/g, '').includes(t)
}
