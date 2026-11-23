import type { Product } from './types'

/** Quantities are kept to one decimal place (0.5 g steps). */
export const roundQty = (n: number): number => {
  const r = Math.round(n * 10) / 10
  return Object.is(r, -0) ? 0 : r
}

/** Parse a typed count. Accepts "1,5" and spaces. Empty, junk or negative gives null. */
export function parseQty(s: string): number | null {
  const t = s.trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(t)) return null
  return roundQty(Number(t))
}

/** Parse a typed rand amount like "R2,905", "2 905" or "12.50" into cents. */
export function parseRand(s: string): number | null {
  const t = s.replace(/[Rr\s,]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null
  return Math.round(Number(t) * 100)
}

export function formatRand(cents: number): string {
  const abs = Math.abs(cents)
  const whole = abs % 100 === 0
  const n = (abs / 100).toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })
  return `${cents < 0 ? '−' : ''}R${n}`
}

export function formatQty(p: Product, q: number): string {
  const v = roundQty(q)
  const s = Number.isInteger(v) ? String(v) : v.toFixed(1)
  return p.unit === 'g' ? `${s} g` : s
}

const TZ = 'Africa/Johannesburg'

function localParts(at: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(at)
  const get = (t: string) => parts.find(p => p.type === t)!.value
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) }
}

/** Day shift 08:00–20:00, night 20:00–08:00. A shift is dated by the day it starts. */
export function shiftFor(at: Date): { kind: 'day' | 'night'; date: string } {
  const { date, hour } = localParts(at)
  if (hour >= 8 && hour < 20) return { kind: 'day', date }
  if (hour >= 20) return { kind: 'night', date }
  return { kind: 'night', date: localParts(new Date(at.getTime() - 12 * 3600 * 1000)).date }
}
