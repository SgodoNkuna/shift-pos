import { shiftFlags, shiftTotals } from '../domain/calc'
import { formatRand } from '../domain/num'
import type { ShiftData } from '../domain/types'
import { SHOP } from '../app/brand'

/** The short message that goes with the files on WhatsApp. */
export function shareText(d: ShiftData, by: string, names: Record<string, string> = {}): string {
  const t = shiftTotals(d)
  const bad = shiftFlags(d, names).filter(f => f.level === 'bad')
  return [
    `${SHOP.name} · ${d.shift.kind === 'day' ? 'Day' : 'Night'} shift ${d.shift.date} · sent by ${by}`,
    `Sales ${formatRand(t.salesCents)} (card ${formatRand(t.cardCents)}, cash ${formatRand(t.cashCents)})`,
    bad.length ? `⚠ ${bad.length} to check: ${bad.map(f => f.text).join('; ')}` : 'Everything adds up ✓',
  ].join('\n')
}
