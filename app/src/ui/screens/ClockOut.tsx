import { useState } from 'react'
import { actions } from '../../app/store'
import type { StaffMember } from '../../data/db'
import { canLock, displayName, itemLines, shiftTotals, type LockReason } from '../../domain/calc'
import { formatQty, formatRand, parseQty, parseRand } from '../../domain/num'
import type { ShiftData } from '../../domain/types'
import { LockError } from '../../data/actions'
import { catLabel, Header, PinPad, Sheet, useStaff, useToast } from '../kit'
import { OutCard } from './StockOut'
import { CashCount } from '../CashCount'

export const LOCK_TEXT: Record<LockReason | 'not_counted', string> = {
  pending_out: 'A stock out is still waiting for approval',
  no_cash_count: 'Count the cash in the drawer',
  no_card_slip: 'Type the card machine end-of-day total',
  missing_pin_out: 'You need to enter your PIN',
  missing_pin_in: 'The next person needs to enter their PIN',
  not_counted: 'Count every item',
}

const diffText = (d: number | null, cents: number | null, unit: string) =>
  d == null ? '' : d === 0 ? '✓' : `${d > 0 ? '+' : '−'}${Math.abs(d)}${unit === 'g' ? ' g' : ''} · ${formatRand(cents!)}`

export function ClockOut({ data, me, onLocked }: { data: ShiftData; me: StaffMember; onLocked: (shiftId: string, send?: boolean) => void }) {
  const toast = useToast()
  const staff = useStaff()
  const [pinFor, setPinFor] = useState<null | 'out' | 'in'>(null)
  const [counting, setCounting] = useState(false)
  const lines = itemLines(data)
  const t = shiftTotals(data)
  const s = data.shift
  const id = s.id
  const products = data.products
  const pending = data.moves.filter(m => m.kind === 'out' && m.status === 'pending')
  const active = products.filter(p => p.active || (data.shift.opening[p.id] ?? 0) > 0)
  const uncounted = active.filter(p => s.counts?.[p.id] == null)
  const reasons: (LockReason | 'not_counted')[] = [...canLock(data).reasons]
  if (uncounted.length) reasons.unshift('not_counted')
  const name = (sid?: string) => staff.find(x => x.id === sid)?.name
  const lock = async () => {
    try { await actions.lockShift(id, me.id); toast('Shift locked'); onLocked(id, true) }
    catch (e) { toast(e instanceof LockError ? LOCK_TEXT[e.reasons[0]] : 'Could not lock') }
  }
  const cats = [...new Set(active.map(p => p.categoryId))]
  return (
    <div className="main enter">
      <Header title="Clock out" sub="Count together with the next person" />
      <div className="pad stack">
        {pending.length > 0 && <div className="banner"><b>{pending.length} stock out waiting for approval.</b> You can’t lock until it is answered.
          {pending.map(m => <OutCard key={m.id} m={m} data={data} me={me} />)}</div>}

        <div className="lbl">Stock count · {active.length - uncounted.length} of {active.length} counted</div>
        <div className="scrollx"><table className="ctable">
          <thead><tr><th>Item</th><th className="r">Expect</th><th className="r">Counted</th><th className="r">Diff</th></tr></thead>
          <tbody>{cats.map(c => [
            <tr className="cat" key={c}><td colSpan={3}>{catLabel(c)}</td><td className="num">
              {active.some(p => p.categoryId === c && s.counts?.[p.id] == null) &&
                <button className="linkbtn" aria-label={`All the rest in ${catLabel(c)} match`} onClick={async () => {
                  for (const p of active.filter(p => p.categoryId === c && s.counts?.[p.id] == null))
                    await actions.setCount(id, p.id, lines.find(l => l.productId === p.id)!.expected, me.id)
                }}>All the rest match</button>}
            </td></tr>,
            ...active.filter(p => p.categoryId === c).map(p => { const l = lines.find(x => x.productId === p.id)!
              return (
                <tr key={p.id} className={l.diff ? 'diff' : ''}>
                  <td>{displayName(p, products)}</td>
                  <td className="num">{formatQty(p, l.expected)}</td>
                  <td className="num" style={{ whiteSpace: 'nowrap' }}>
                    <input className="cin" inputMode="decimal" aria-label={`Counted ${displayName(p, products)}`} key={`${p.id}:${l.counted}`}
                      defaultValue={l.counted ?? ''} placeholder="—"
                      onBlur={e => { const v = e.target.value.trim(); actions.setCount(id, p.id, v === '' ? null : parseQty(v), me.id) }} />
                    {l.counted == null && <button className="linkbtn" aria-label={`${p.name} matches`} onClick={() => actions.setCount(id, p.id, l.expected, me.id)}>✓</button>}
                  </td>
                  <td className="num small">{diffText(l.diff, l.diffCents, p.unit)}</td>
                </tr>)
            })])}</tbody>
        </table></div>

        <div className="block"><div className="lbl">Card</div><div className="money">
          <span>Card sales on the till</span><b className="num v">{formatRand(t.cardCents)}</b>
          <label htmlFor="co-slip">Card machine end-of-day total</label>
          <input id="co-slip" inputMode="decimal" placeholder="R" key={`slip:${s.cardSlipCents}`} defaultValue={s.cardSlipCents != null ? s.cardSlipCents / 100 : ''}
            onBlur={e => actions.setCardSlip(id, e.target.value.trim() === '' ? null : parseRand(e.target.value), me.id)} />
          <span className="muted">Difference</span>
          <span className="v">{t.cardDiffCents == null ? '—' : t.cardDiffCents === 0 ? <span className="ok">✓</span> : <span className="bad num">{formatRand(t.cardDiffCents)}</span>}</span>
        </div></div>

        <div className="block"><div className="lbl">Cash</div><div className="money">
          <span>Float</span><b className="num v">{formatRand(s.floatCents)}</b>
          <span>+ Cash sales</span><b className="num v">{formatRand(t.cashCents)}</b>
          <span>− Expenses</span><b className="num v">{formatRand(t.expensesCents)}</b>
          <span><b>Should be in the drawer</b></span><b className="num v">{formatRand(t.expectedCashCents)}</b>
          <label htmlFor="co-cash">Cash you counted</label>
          <input id="co-cash" inputMode="decimal" placeholder="R" key={`cash:${s.cashCountedCents}`} defaultValue={s.cashCountedCents != null ? s.cashCountedCents / 100 : ''}
            onBlur={e => actions.setCash(id, e.target.value.trim() === '' ? null : parseRand(e.target.value), me.id)} />
          <span /><button className="linkbtn" style={{ justifySelf: 'end' }} onClick={() => setCounting(true)}>Count notes &amp; coins</button>
          <span className="muted">Difference</span>
          <span className="v">{t.cashDiffCents == null ? '—' : t.cashDiffCents === 0 ? <span className="ok">✓</span> : <span className="bad num">{formatRand(t.cashDiffCents)}</span>}</span>
        </div></div>

        <div className="lbl">Handover PINs</div>
        <div className="pins">
          <button className={`blk ${s.pinOutBy ? 'on' : ''}`} onClick={() => setPinFor('out')}><span>{name(s.pinOutBy) ?? me.name}</span><span className="small">{s.pinOutBy ? 'PIN ✓' : 'Going home · PIN'}</span></button>
          <button className={`blk ${s.pinInBy ? 'on' : ''}`} onClick={() => setPinFor('in')}><span>{name(s.pinInBy) ?? 'Next person'}</span><span className="small">{s.pinInBy ? 'PIN ✓' : 'Starting · PIN'}</span></button>
        </div>

        {reasons.length > 0 && <ul className="small warn" style={{ margin: 0, paddingLeft: 18 }} aria-label="Before you can lock">
          {reasons.map(r => <li key={r}>{LOCK_TEXT[r]}{r === 'not_counted' ? ` (${uncounted.length} left)` : ''}</li>)}</ul>}
        <button className="blk primary" disabled={reasons.length > 0} onClick={lock}>Lock &amp; send report</button>
      </div>

      {counting && <CashCount expectedCents={t.expectedCashCents} onClose={() => setCounting(false)}
        onUse={async c => { await actions.setCash(id, c, me.id); setCounting(false); toast(`Cash ${formatRand(c)} entered`) }} />}
      {pinFor && <Sheet title={pinFor === 'out' ? 'Your PIN' : 'Next person’s PIN'} onClose={() => setPinFor(null)}>
        <PinPad people={pinFor === 'out' ? [me] : staff.filter(x => x.id !== me.id && !x.locked)} prompt="Who is starting the next shift?"
          onOk={async m => { await actions.confirmPin(id, pinFor, m.id); setPinFor(null); toast('PIN ✓') }} />
      </Sheet>}
    </div>
  )
}
