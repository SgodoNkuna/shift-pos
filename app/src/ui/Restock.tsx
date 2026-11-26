import { displayName, itemLines } from '../domain/calc'
import { formatQty } from '../domain/num'
import type { ShiftData } from '../domain/types'
import { SHOP } from '../app/brand'
import { catLabel, Sheet } from './kit'

/** Low and sold-out items, for one WhatsApp message to the boss. */
export function restockItems(d: ShiftData) {
  return itemLines(d).map(l => ({ l, p: d.products.find(p => p.id === l.productId)! }))
    .filter(({ l, p }) => p?.active && p.track !== false && (l.counted ?? l.expected) <= p.lowAt)
    .map(({ l, p }) => ({ p, left: l.counted ?? l.expected, name: displayName(p, d.products) }))
}

export function restockText(d: ShiftData, by: string): string {
  const items = restockItems(d)
  const cats = [...new Set(items.map(i => i.p.categoryId))]
  return [`*Restock list* · ${SHOP.short} · ${d.shift.kind === 'day' ? 'Day' : 'Night'} ${d.shift.date}`,
    ...cats.flatMap(c => [`\n_${catLabel(c)}_`, ...items.filter(i => i.p.categoryId === c)
      .map(i => `• ${i.name}: ${i.left <= 0 ? 'OUT' : `${formatQty(i.p, i.left)} left`}`)]),
    `\nFrom ${by}`].join('\n')
}

export function Restock({ data, by, onClose }: { data: ShiftData; by: string; onClose: () => void }) {
  const items = restockItems(data)
  const send = () => window.open(`https://wa.me/?text=${encodeURIComponent(restockText(data, by))}`, '_blank')
  return (
    <Sheet title="Restock list" onClose={onClose}>
      {items.length ? <div className="grp">{items.map(i =>
        <div className="row" key={i.p.id}><span style={{ flex: 1 }}>{i.name}</span>
          <b className={`num ${i.left <= 0 ? 'bad' : 'warn'}`}>{i.left <= 0 ? 'Out' : `${formatQty(i.p, i.left)} left`}</b></div>)}</div>
        : <div className="note">Nothing is low right now.</div>}
      <div className="muted small">Items at or below their low level, from {data.shift.lockedAt ? 'the last count' : 'what the till expects now'}.</div>
      {items.length > 0 && <button className="blk primary" onClick={send}>Send on WhatsApp</button>}
    </Sheet>)
}
