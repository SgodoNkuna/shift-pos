import { useState } from 'react'
import { changeDue } from '../domain/calc'
import { formatRand, parseRand } from '../domain/num'
import type { Payment } from '../domain/types'
import { paymentsFor, type PayMode } from './basket'
import { Sheet } from './kit'

const NOTES = [1000, 2000, 5000, 10000, 20000]

export function PaySheet({ total, onPay, onClose }: { total: number; onPay: (p: Payment[]) => Promise<void>; onClose: () => void }) {
  const [mode, setMode] = useState<PayMode>('cash')
  const [given, setGiven] = useState<number | null>(total) // exact is pre-selected: tile → Pay → Record = 3 taps
  const [card, setCard] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const cashChips = [total, ...NOTES.filter(n => n > total)].slice(0, 5)
  const cardChips = [5000, 10000, 20000, 50000].filter(n => n < total)
  const ready = mode === 'card' || (mode === 'cash' && given != null && given >= total) || (mode === 'split' && card != null && card > 0 && card < total)
  const pay = async () => { setBusy(true); try { await onPay(paymentsFor(mode, total, card ?? 0)) } finally { setBusy(false) } }
  return (
    <Sheet title={<>Pay <span className="num">{formatRand(total)}</span></>} onClose={onClose}>
      <div className="seg" role="tablist">{(['cash', 'card', 'split'] as PayMode[]).map(m =>
        <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? 'on' : ''} onClick={() => { setMode(m); setGiven(m === 'cash' ? total : null); setCard(null) }}>{m.toUpperCase()}</button>)}
      </div>
      {mode === 'cash' && <>
        <div className="lbl">Customer hands over</div>
        <div className="chips">{cashChips.map((v, i) =>
          <button key={v} className={`chip ${given === v ? 'on' : ''}`} onClick={() => setGiven(v)}>{i === 0 ? 'Exact' : formatRand(v)}</button>)}
        </div>
        <input aria-label="Other amount" inputMode="decimal" placeholder="Other amount (R)" onChange={e => setGiven(parseRand(e.target.value))} />
        {given != null && <div className="change"><span className="lbl">{given >= total ? 'Give change' : 'Not enough'}</span>
          <b className="num" style={given < total ? { color: 'var(--bad)' } : undefined}>{formatRand(changeDue(total, given))}</b></div>}
      </>}
      {mode === 'card' && <div className="note">Customer taps on the card machine for <b className="num">{formatRand(total)}</b>. Nothing to type here.</div>}
      {mode === 'split' && <>
        <div className="lbl">Card part</div>
        <div className="chips">{cardChips.map(v => <button key={v} className={`chip ${card === v ? 'on' : ''}`} onClick={() => setCard(v)}>{formatRand(v)}</button>)}</div>
        <input aria-label="Card amount" inputMode="decimal" placeholder="Card amount (R)" onChange={e => setCard(parseRand(e.target.value))} />
        {card != null && card > 0 && card < total && <div className="change"><span className="lbl">Card {formatRand(card)} · cash</span><b className="num">{formatRand(total - card)}</b></div>}
      </>}
      <button className="blk primary" disabled={!ready || busy} onClick={pay}>Record sale</button>
    </Sheet>
  )
}
