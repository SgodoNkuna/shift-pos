import { useState } from 'react'
import { formatRand } from '../domain/num'
import { Sheet } from './kit'

/** South African notes and coins, in cents. */
export const DENOMS = [20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50]
export const cashTotal = (n: Record<number, number>) => DENOMS.reduce((a, d) => a + d * (n[d] ?? 0), 0)

/** Count the drawer note by note; the app adds it up. */
export function CashCount({ expectedCents, onUse, onClose }: { expectedCents: number; onUse: (cents: number) => void; onClose: () => void }) {
  const [n, setN] = useState<Record<number, number>>({})
  const total = cashTotal(n)
  const set = (d: number, v: number) => setN({ ...n, [d]: Math.max(0, v) })
  const diff = total - expectedCents
  return (
    <Sheet title="Count notes and coins" onClose={onClose}>
      <div className="cc">
        {DENOMS.map(d => (
          <div className="cc-row" key={d}>
            <span className={`cc-d ${d >= 1000 ? 'note' : 'coin'}`}>{d >= 100 ? `R${d / 100}` : `${d}c`}</span>
            <span className="stepper">
              <button aria-label={`One less ${formatRand(d)}`} onClick={() => set(d, (n[d] ?? 0) - 1)}>−</button>
              <input id={`cc-${d}`} aria-label={`How many ${formatRand(d)}`} inputMode="numeric" value={n[d] ?? ''} placeholder="0"
                onChange={e => set(d, parseInt(e.target.value.replace(/\D/g, '') || '0', 10))} />
              <button aria-label={`One more ${formatRand(d)}`} onClick={() => set(d, (n[d] ?? 0) + 1)}>+</button>
            </span>
            <b className="num">{formatRand(d * (n[d] ?? 0))}</b>
          </div>))}
      </div>
      <div className="btot"><span className="lbl">Counted</span><b className="num">{formatRand(total)}</b></div>
      <div className="muted small">Should be {formatRand(expectedCents)} · {diff === 0 ? 'matches' : `${diff > 0 ? 'over' : 'short'} by ${formatRand(Math.abs(diff))}`}</div>
      <button className="blk primary" onClick={() => onUse(total)}>Use {formatRand(total)}</button>
    </Sheet>)
}
