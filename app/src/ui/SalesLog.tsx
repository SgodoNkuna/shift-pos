import { useState } from 'react'
import { actions } from '../app/store'
import type { StaffMember } from '../data/db'
import { displayName } from '../domain/calc'
import { formatQty, formatRand } from '../domain/num'
import type { ShiftData } from '../domain/types'
import { saleCents, Sheet, useStaff, useToast } from './kit'

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg' })

/** Every sale on this shift, newest first: yours by default, undone ones crossed out with who undid them and why. */
export function SalesLog({ data, me, onClose }: { data: ShiftData; me: StaffMember; onClose: () => void }) {
  const toast = useToast()
  const staff = useStaff()
  const [all, setAll] = useState(false)
  const [undo, setUndo] = useState<string | null>(null)
  const [why, setWhy] = useState('Rung up twice')
  const name = (id: string) => (staff.find(s => s.id === id)?.name ?? '?').split(' ')[0]
  const sales = data.sales.filter(s => all || s.by === me.id).sort((a, b) => b.at.localeCompare(a.at))
  const live = sales.filter(s => !s.void)
  const total = live.reduce((a, s) => a + saleCents(s), 0)
  const card = live.reduce((a, s) => a + s.payments.filter(p => p.method === 'card').reduce((b, p) => b + p.cents, 0), 0)
  return (
    <Sheet title={all ? 'All sales this shift' : 'My sales this shift'} onClose={onClose}>
      <div className="seg" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <button className={!all ? 'on' : ''} onClick={() => setAll(false)}>MINE</button>
        <button className={all ? 'on' : ''} onClick={() => setAll(true)}>EVERYONE</button>
      </div>
      <div className="muted small">{live.length} sale{live.length === 1 ? '' : 's'} · <b className="num">{formatRand(total)}</b> · card {formatRand(card)} · cash {formatRand(total - card)}
        {sales.length > live.length && ` · ${sales.length - live.length} undone`}</div>
      <div className="grp" style={{ maxHeight: '48vh', overflow: 'auto' }}>
        {sales.length ? sales.map(s => {
          const items = s.lines.map(l => { const p = data.products.find(x => x.id === l.productId); return p ? `${displayName(p, data.products)}${l.qty !== 1 || p.unit === 'g' ? ` ×${formatQty(p, l.qty)}` : ''}` : l.productId }).join(', ')
          const pay = s.payments.length > 1 ? 'split' : s.payments[0]?.method ?? ''
          return (
            <div className={`sl ${s.void ? 'undone' : ''}`} key={s.id}>
              <span className="num muted">{time(s.at)}</span>
              <span className="sl-what"><span>{items}<span className="muted small"> · {pay}{all ? ` · ${name(s.by)}` : ''}</span></span>
                {s.void && <span className="small bad">Undone {time(s.void.at)} by {name(s.void.by)}: {s.void.reason}</span>}</span>
              <b className="num">{formatRand(saleCents(s))}</b>
              {!s.void && (s.by === me.id || me.role !== 'employee') && !data.shift.lockedAt &&
                <button className="linkbtn" onClick={() => { setUndo(s.id); setWhy('Rung up twice') }}>Undo</button>}
              {undo === s.id && <div className="sl-confirm">
                <label className="lbl" htmlFor="undo-why">Why?</label>
                <div className="chips">{['Rung up twice', 'Wrong item', 'Wrong payment', 'Customer cancelled'].map(r =>
                  <button key={r} className={`chip ${why === r ? 'on' : ''}`} onClick={() => setWhy(r)}>{r}</button>)}</div>
                <input id="undo-why" value={why} onChange={e => setWhy(e.target.value)} />
                <div className="two">
                  <button className="blk badb" onClick={async () => { await actions.voidSale(s.id, me.id, why.trim() || 'Undone'); setUndo(null); toast('Sale undone') }}>Undo {formatRand(saleCents(s))}</button>
                  <button className="blk" onClick={() => setUndo(null)}>Keep it</button>
                </div></div>}
            </div>)
        }) : <span className="muted small">No sales yet.</span>}
      </div>
    </Sheet>)
}
