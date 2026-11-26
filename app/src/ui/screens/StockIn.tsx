import { useState } from 'react'
import { actions } from '../../app/store'
import type { StaffMember } from '../../data/db'
import { displayName, itemLines } from '../../domain/calc'
import { formatQty, roundQty } from '../../domain/num'
import type { ShiftData } from '../../domain/types'
import { Header, useToast } from '../kit'
import { ProductSelect } from './ProductSelect'

export function StockIn({ data, me }: { data: ShiftData; me: StaffMember }) {
  const toast = useToast()
  const [pid, setPid] = useState(data.products[0]?.id ?? '')
  const [qty, setQty] = useState(0)
  const p = data.products.find(x => x.id === pid)
  const ins = data.moves.filter(m => m.kind === 'in')
  const steps = p?.unit === 'g' ? [0.5, 1, 5] : [1, 6, 12]
  const have = itemLines(data).find(l => l.productId === pid)?.expected ?? 0
  const after = roundQty(have + qty)
  const over = p?.maxQty != null && after > p.maxQty
  const save = async () => { await actions.addStockIn(data.shift.id, me.id, pid, qty); toast(`+${formatQty(p!, qty)} ${p!.name}`); setQty(0) }
  return (
    <div className="main enter">
      <Header title="Stock in" sub="A delivery arrived" />
      <div className="pad stack">
        <ProductSelect id="si-p" products={data.products} value={pid} onChange={v => { setPid(v); setQty(0) }} />
        <div className="lbl">How many came in</div>
        <div className="num" style={{ fontSize: 30, textAlign: 'center', padding: 6, border: '1px solid var(--line)', borderRadius: 6 }} aria-live="polite">{p ? formatQty(p, qty) : '—'}</div>
        <div className="chips">{steps.map(s => <button key={s} className="chip" onClick={() => setQty(roundQty(qty + s))}>+{s}</button>)}
          <button className="chip" onClick={() => setQty(0)}>Clear</button></div>
        {over && p && <div className="banner warnb" role="alert"><b>Don’t put more than {formatQty(p, p.maxQty!)} in the jar.</b>
          <span>There will be {formatQty(p, after)} {p.name} in total. Put {formatQty(p, p.maxQty!)} in the jar and keep the other {formatQty(p, roundQty(after - p.maxQty!))} in storage.</span></div>}
        <button className="blk primary" disabled={!p || qty <= 0} onClick={save}>Add to stock</button>
        {ins.length > 0 && <div className="grp"><div className="gl">This shift</div>
          {ins.map(m => { const q = data.products.find(x => x.id === m.productId)!
            return <div className="row" key={m.id}><span>{displayName(q, data.products)}</span><b className="num">+{formatQty(q, m.qty)}</b></div> })}</div>}
      </div>
    </div>
  )
}
