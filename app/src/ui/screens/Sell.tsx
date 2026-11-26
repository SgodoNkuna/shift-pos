import { useMemo, useState } from 'react'
import { actions } from '../../app/store'
import type { StaffMember } from '../../data/db'
import { itemLines } from '../../domain/calc'
import { formatQty, formatRand } from '../../domain/num'
import type { ShiftData } from '../../domain/types'
import { addToBasket, basketQty, basketTotal, removeFromBasket, type Basket, type PayMode } from '../basket'
import { catLabel, ShiftStrip, useToast } from '../kit'
import { PaySheet } from '../PaySheet'
import { displayName } from '../../domain/calc'

export function Sell({ data, me }: { data: ShiftData; me: StaffMember }) {
  const toast = useToast()
  const products = data.products.filter(p => p.active)
  const cats = [...new Set(products.map(p => p.categoryId))]
  const [cat, setCat] = useState(cats[0] ?? 'main')
  const [basket, setBasket] = useState<Basket>([])
  const [paying, setPaying] = useState<null | PayMode>(null)
  const expected = useMemo(() => Object.fromEntries(itemLines(data).map(l => [l.productId, l.expected])), [data])
  const total = basketTotal(basket, products)
  const last = [...data.sales].filter(s => !s.void && s.by === me.id).sort((a, b) => b.at.localeCompare(a.at))[0]
  const lastTotal = last ? Math.round(last.lines.reduce((a, l) => a + l.qty * l.unitCents, 0)) : 0

  return (
    <div className="main flex enter">
      <ShiftStrip data={data} meId={me.id} />
      <div className="tabs" role="tablist">{cats.map(c =>
        <button key={c} role="tab" aria-selected={cat === c} className={`tab ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{catLabel(c)}</button>)}
      </div>
      <div className="tiles">{products.filter(p => p.categoryId === cat).map(p => {
        const left = Math.round(((expected[p.id] ?? 0) - basketQty(basket, p.id)) * 10) / 10
        const st = left <= 0 ? 'out' : left <= p.lowAt ? 'low' : ''
        return (
          <button key={p.id} className={`tile ${st}`} aria-label={`${displayName(p, products)}, ${formatRand(p.priceCents)}, ${formatQty(p, Math.max(0, left))} left`}
            onClick={() => { const b = addToBasket(basket, p, expected[p.id] ?? 0); if (b === basket) toast(`${p.name}: none left`); setBasket(b) }}>
            <span className="tn">{p.name}</span>
            <span className="tp num">{formatRand(p.priceCents)}{p.unit === 'g' ? '/g' : ''}</span>
            <span className="tl">{left <= 0 ? 'Out of stock' : `${formatQty(p, left)} left`}</span>
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
                <button aria-label={`More ${p.name}`} onClick={() => { const b = addToBasket(basket, p, expected[p.id] ?? 0); if (b === basket) toast('No more in stock'); setBasket(b) }}>+</button>
              </span>
              <span className="num">{formatRand(Math.round(l.qty * p.priceCents))}</span>
            </div>)
        }) : <div className="muted small">
          Tap a product to start a sale. Gram items go in 0.5 g steps.
          {last && <> · Last sale {formatRand(lastTotal)} <button className="linkbtn" onClick={async () => { await actions.voidSale(last.id, me.id, 'Undone at till'); toast('Last sale undone') }}>Undo</button></>}
        </div>}
        <div className="btot"><span className="lbl">Total</span><b className="num">{formatRand(total)}</b></div>
        <div className="two">
          <button className="blk primary" disabled={!basket.length} onClick={() => setPaying('cash')}>Cash</button>
          <button className="blk primary" disabled={!basket.length} onClick={() => setPaying('card')}>Card</button>
        </div>
        {basket.length > 0 && <button className="linkbtn" style={{ alignSelf: 'center' }} onClick={() => setPaying('split')}>Part cash, part card</button>}
      </div>
      {paying && <PaySheet total={total} mode0={paying} onClose={() => setPaying(null)} onPay={async payments => {
        await actions.recordSale(data.shift.id, me.id, basket, payments)
        setBasket([]); setPaying(null); toast('Sale recorded')
      }} />}
    </div>
  )
}
