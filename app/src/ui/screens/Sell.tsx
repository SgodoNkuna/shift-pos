import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../app/store'
import { actions } from '../../app/store'
import type { StaffMember } from '../../data/db'
import { itemLines } from '../../domain/calc'
import { formatQty, formatRand } from '../../domain/num'
import type { ShiftData } from '../../domain/types'
import { addToBasket, basketQty, basketTotal, findDoubles, removeFromBasket, type Basket, type Double, type PayMode } from '../basket'
import { catLabel, Sheet, ShiftStrip, useStaff, useToast } from '../kit'
import { PaySheet } from '../PaySheet'
import { SalesLog } from '../SalesLog'
import { displayName } from '../../domain/calc'

export function Sell({ data, me }: { data: ShiftData; me: StaffMember }) {
  const toast = useToast()
  const products = data.products.filter(p => p.active)
  const expected = useMemo(() => Object.fromEntries(itemLines(data).map(l => [l.productId, l.expected])), [data])
  // Favourites: the 6 best sellers over the last few shifts on this phone (paper-sheet order until there are sales).
  const recent = useLiveQuery(async () => {
    const ids = (await db.shifts.orderBy('date').reverse().limit(6).toArray()).map(s => s.id)
    return db.sales.where('shiftId').anyOf(ids).toArray()
  }, [], [])
  const top = useMemo(() => {
    const n: Record<string, number> = {}
    for (const s of recent) if (!s.void) for (const l of s.lines) n[l.productId] = (n[l.productId] ?? 0) + 1
    const ranked = [...products].sort((a, b) => (n[b.id] ?? 0) - (n[a.id] ?? 0) || (a.sort ?? 0) - (b.sort ?? 0))
    return ranked.filter(p => (expected[p.id] ?? 0) > 0).slice(0, 6).map(p => p.id)
  }, [recent, products, expected])
  const cats = ['top', ...new Set(products.map(p => p.categoryId))]
  const [cat, setCat] = useState('top')
  const [basket, setBasket] = useState<Basket>([])
  const [paying, setPaying] = useState<null | PayMode>(null)
  const [log, setLog] = useState(false)
  const [check, setCheck] = useState<null | { mode: PayMode; doubles: Double[] }>(null)
  const staff = useStaff()
  // Before taking payment: was this maybe rung up already (on the other phone, or twice here)?
  const pay = (mode: PayMode) => {
    const doubles = findDoubles(basket, data.sales, me.id)
    if (doubles.length) setCheck({ mode, doubles }); else setPaying(mode)
  }
  const ago = (s: number) => (s < 60 ? `${s} sec ago` : `${Math.round(s / 60)} min ago`)
  const who = (id: string) => (staff.find(x => x.id === id)?.name ?? 'Someone').split(' ')[0]
  const pname = (id: string) => products.find(x => x.id === id)?.name ?? id
  const total = basketTotal(basket, products)
  const last = [...data.sales].filter(s => !s.void && s.by === me.id).sort((a, b) => b.at.localeCompare(a.at))[0]
  const lastTotal = last ? Math.round(last.lines.reduce((a, l) => a + l.qty * l.unitCents, 0)) : 0

  return (
    <div className="main flex enter">
      <ShiftStrip data={data} meId={me.id} />
      <div className="tabs" role="tablist">{cats.map(c =>
        <button key={c} role="tab" aria-selected={cat === c} className={`tab ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c === 'top' ? '★ Top' : catLabel(c)}</button>)}
      </div>
      <div className="tiles">{(cat === 'top' ? top.map(id => products.find(p => p.id === id)!) : products.filter(p => p.categoryId === cat)).map(p => {
        const service = p.track === false
        const left = service ? Infinity : Math.round(((expected[p.id] ?? 0) - basketQty(basket, p.id)) * 10) / 10
        const st = service ? '' : left <= 0 ? 'out' : left <= p.lowAt ? 'low' : ''
        return (
          <button key={p.id} className={`tile ${st}`} aria-label={`${displayName(p, products)}, ${formatRand(p.priceCents)}, ${service ? 'no stock count' : `${formatQty(p, Math.max(0, left))} left`}`}
            onClick={() => { const b = addToBasket(basket, p, p.track === false ? Infinity : expected[p.id] ?? 0); if (b === basket) toast(`${p.name}: none left`); setBasket(b) }}>
            <span className="tn">{p.name}</span>
            <span className="tp num">{formatRand(p.priceCents)}{p.unit === 'g' ? '/g' : ''}</span>
            <span className="tl">{service ? 'Service' : left <= 0 ? 'Out of stock' : `${formatQty(p, left)} left`}</span>
          </button>)
      })}</div>
      <div className="basket">
        {basket.length ? basket.map(l => { const p = products.find(x => x.id === l.productId)!
          return (
            <div className="bl" key={l.productId}>
              <span>{displayName(p, products)}</span>
              <span className="stepper">
                <button aria-label={`Less ${p.name}`} onClick={() => setBasket(removeFromBasket(basket, p))}>−</button>
                <b className="num">{formatQty(p, l.qty)}</b>
                <button aria-label={`More ${p.name}`} onClick={() => { const b = addToBasket(basket, p, p.track === false ? Infinity : expected[p.id] ?? 0); if (b === basket) toast('No more in stock'); setBasket(b) }}>+</button>
              </span>
              <span className="num">{formatRand(Math.round(l.qty * p.priceCents))}</span>
            </div>)
        }) : <div className="muted small">
          Tap a product to start a sale. Gram items go in 0.5 g steps.
          {last && <> · Last sale {formatRand(lastTotal)} <button className="linkbtn" onClick={async () => { await actions.voidSale(last.id, me.id, 'Undone at till'); toast('Last sale undone') }}>Undo</button></>}
          {' · '}<button className="linkbtn" onClick={() => setLog(true)}>My sales ({data.sales.filter(s => s.by === me.id && !s.void).length})</button>
        </div>}
        <div className="btot"><span className="lbl">Total</span><b className="num">{formatRand(total)}</b></div>
        <div className="two">
          <button className="blk primary" disabled={!basket.length} onClick={() => pay('cash')}>Cash</button>
          <button className="blk primary" disabled={!basket.length} onClick={() => pay('card')}>Card</button>
        </div>
        {basket.length > 0 && <button className="linkbtn" style={{ alignSelf: 'center' }} onClick={() => pay('split')}>Part cash, part card</button>}
      </div>
      {check && <Sheet title="Rung up already?" onClose={() => setCheck(null)}>
        <div className="banner warnb">
          {check.doubles.map((d, i) => <span key={i}>{d.mine
            ? <>You sold <b>exactly this</b> {ago(d.secondsAgo)}.</>
            : <><b>{who(d.by)}</b> sold <b>{pname(d.productId)}</b> {ago(d.secondsAgo)} on their phone.</>}</span>)}
          <span>Only one of you should ring up each sale.</span>
        </div>
        <button className="blk primary" onClick={() => { const m = check.mode; setCheck(null); setPaying(m) }}>Yes, it’s a different customer</button>
        <button className="blk badb" onClick={() => { setCheck(null); setBasket([]); toast('Not rung up again') }}>No, it’s the same sale. Cancel</button>
      </Sheet>}
      {log && <SalesLog data={data} me={me} onClose={() => setLog(false)} />}
      {paying && <PaySheet total={total} mode0={paying} onClose={() => setPaying(null)} onPay={async payments => {
        await actions.recordSale(data.shift.id, me.id, basket, payments)
        setBasket([]); setPaying(null); toast('Sale recorded'); navigator.vibrate?.(35)
      }} />}
    </div>
  )
}
