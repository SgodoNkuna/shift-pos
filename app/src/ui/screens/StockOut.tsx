import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { actions, DEFAULT_REASONS, getMeta } from '../../app/store'
import type { StaffMember } from '../../data/db'
import { displayName, itemLines } from '../../domain/calc'
import { formatQty, formatRand, roundQty } from '../../domain/num'
import type { ShiftData, StockMove } from '../../domain/types'
import { Header, PinPad, Sheet, useStaff, useToast } from '../kit'
import { deviceStaffId, supabase } from '../../sync/client'
import { syncNow } from '../../sync/engine'
import { ProductSelect } from './ProductSelect'

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg' })

/** One stock out request with its status. Leads decide here; employees can hand the phone to a lead. */
export function OutCard({ m, data, me }: { m: StockMove; data: ShiftData; me: StaffMember }) {
  const toast = useToast()
  const staff = useStaff()
  const [asking, setAsking] = useState<null | boolean>(null)
  const p = data.products.find(x => x.id === m.productId)!
  const name = (id?: string) => staff.find(s => s.id === id)?.name ?? '—'
  const lead = me.role !== 'employee'
  const decide = async (ok: boolean, by: string) => { await actions.decideOut(m.id, ok, by); toast(ok ? 'Approved' : 'Rejected') }
  return (
    <div className="req">
      <div className="top"><b>{formatQty(p, m.qty)} {displayName(p, data.products)}</b><span className={`pill ${m.status}`}>{m.status}</span></div>
      <div className="muted small">{m.reason} · {formatRand(Math.round(m.qty * p.priceCents))} at till price · asked by {name(m.by)} at {time(m.at)}
        {m.decidedBy && <> · {m.status} by {name(m.decidedBy)} at {time(m.decidedAt!)}</>}</div>
      {m.status === 'pending' && (lead
        ? <div className="two"><button className="blk okb sm" onClick={() => decide(true, me.id)}>Approve</button><button className="blk badb sm" onClick={() => decide(false, me.id)}>Reject</button></div>
        : <div className="two"><button className="blk sm" onClick={() => setAsking(true)}>Manager approves here</button><button className="blk sm ghost" onClick={() => setAsking(false)}>Manager rejects</button></div>)}
      {asking != null && <Sheet title={asking ? 'Approve with PIN' : 'Reject with PIN'} onClose={() => setAsking(null)}>
        <PinPad people={staff.filter(s => s.role !== 'employee' && !s.locked)} prompt="Manager or boss" onOk={async (l, pin) => {
          if (await deviceStaffId()) {
            await syncNow()
            const { data: r, error } = await supabase!.rpc('decide_out_with_pin', { p_move: m.id, p_lead: l.id, p_pin: pin, p_approve: asking })
            if (error || r !== 'ok') { toast(r === 'not_pending' ? 'Already decided' : 'Could not save. Check the internet.'); return }
            await syncNow(); toast(asking ? 'Approved' : 'Rejected')
          } else await decide(asking, l.id)
          setAsking(null)
        }} />
      </Sheet>}
    </div>
  )
}

export function StockOut({ data, me }: { data: ShiftData; me: StaffMember }) {
  const toast = useToast()
  const reasons = useLiveQuery(() => getMeta<string[]>('stockOutReasons', DEFAULT_REASONS), [], DEFAULT_REASONS)
  const [pid, setPid] = useState(data.products[0]?.id ?? '')
  const p = data.products.find(x => x.id === pid)
  const [qty, setQty] = useState(p?.step ?? 1)
  const [reason, setReason] = useState(DEFAULT_REASONS[0])
  const [note, setNote] = useState('')
  const left = itemLines(data).find(l => l.productId === pid)?.expected ?? 0
  const outs = data.moves.filter(m => m.kind === 'out').sort((a, b) => b.at.localeCompare(a.at))
  const send = async () => {
    if (qty > left) return toast('Not that much in stock')
    const r = reason === 'Other' ? `Other: ${note.trim() || 'no note'}` : reason
    await actions.requestOut(data.shift.id, me.id, pid, qty, r)
    toast('Sent · waiting for approval')
  }
  return (
    <div className="main enter">
      <Header title="Stock out" sub="Stock leaving without a sale needs a yes from a manager or the boss" />
      <div className="pad stack">
        <ProductSelect id="so-p" products={data.products} value={pid} onChange={v => { setPid(v); setQty(data.products.find(x => x.id === v)?.step ?? 1) }} />
        <div className="lbl">How much</div>
        {p && <div className="stepper" style={{ justifyContent: 'center' }}>
          <button aria-label="Less" onClick={() => setQty(Math.max(p.step, roundQty(qty - p.step)))}>−</button>
          <b className="num" style={{ fontSize: 22, minWidth: 90 }}>{formatQty(p, qty)}</b>
          <button aria-label="More" onClick={() => setQty(roundQty(qty + p.step))}>+</button>
        </div>}
        <div className="lbl">Reason</div>
        <div className="chips">{reasons.map(r => <button key={r} className={`chip ${reason === r ? 'on' : ''}`} onClick={() => setReason(r)}>{r}</button>)}</div>
        {reason === 'Other' && <input aria-label="What happened" placeholder="What happened?" value={note} onChange={e => setNote(e.target.value)} />}
        <button className="blk primary" onClick={send} disabled={!p}>Send for approval</button>
        {outs.map(m => <OutCard key={m.id} m={m} data={data} me={me} />)}
      </div>
    </div>
  )
}
