import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getMeta, setMeta } from '../../app/store'
import type { StaffMember } from '../../data/db'
import { displayName } from '../../domain/calc'
import { formatRand, parseQty, parseRand } from '../../domain/num'
import { categoryOrder, sortProducts } from '../../domain/order'
import type { Product, Unit } from '../../domain/types'
import { supabase, deviceStaffId } from '../../sync/client'
import { toRow } from '../../sync/map'
import { syncNow } from '../../sync/engine'
import { catLabel, Sheet, useToast } from '../kit'

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 20) || 'item'

/** Managers and the boss add and change products and prices. Only the boss sees cost prices. */
export function Products({ me, onClose }: { me: StaffMember; onClose: () => void }) {
  const products = useLiveQuery(() => db.products.toArray().then(sortProducts), [], [])
  const costs: Record<string, number> = useLiveQuery(() => getMeta<Record<string, number>>('costs', {}), [], {})
  const [edit, setEdit] = useState<Product | 'new' | null>(null)
  const cats = categoryOrder(products)
  return (
    <Sheet title="Products & prices" onClose={onClose}>
      <button className="blk primary" onClick={() => setEdit('new')}>Add a product</button>
      {cats.map(c => (
        <div className="grp" key={c}><div className="gl">{catLabel(c)}</div>
          {products.filter(p => p.categoryId === c).map(p => (
            <button key={p.id} className="row" style={{ background: 'none', border: 0, borderBottom: '1px solid var(--steel-2)', textAlign: 'left', opacity: p.active ? 1 : .5 }} onClick={() => setEdit(p)}>
              <span>{displayName(p, products)}{!p.active && ' · hidden'}</span>
              <span className="num">{formatRand(p.priceCents)}{p.unit === 'g' ? '/g' : ''}{me.role === 'boss' && costs[p.id] != null && <span className="muted"> · cost {formatRand(costs[p.id])}</span>}</span>
            </button>))}
        </div>))}
      {edit && <ProductForm me={me} product={edit === 'new' ? null : edit} cats={cats} costCents={edit !== 'new' ? costs[edit.id] : undefined}
        nextSort={Math.max(0, ...products.map(p => p.sort ?? 0)) + 1} onClose={() => setEdit(null)} />}
    </Sheet>
  )
}

function ProductForm({ me, product, cats, costCents, nextSort, onClose }:
  { me: StaffMember; product: Product | null; cats: string[]; costCents?: number; nextSort: number; onClose: () => void }) {
  const toast = useToast()
  const [name, setName] = useState(product?.name ?? '')
  const [cat, setCat] = useState(product?.categoryId ?? cats[0] ?? 'main')
  const [unit, setUnit] = useState<Unit>(product?.unit ?? 'ea')
  const [price, setPrice] = useState(product ? String(product.priceCents / 100) : '')
  const [low, setLow] = useState(String(product?.lowAt ?? 3))
  const [active, setActive] = useState(product?.active ?? true)
  const [cost, setCost] = useState(costCents != null ? String(costCents / 100) : '')
  const [busy, setBusy] = useState(false)
  const boss = me.role === 'boss'

  const save = async () => {
    const priceCents = parseRand(price)
    const lowAt = parseQty(low)
    const costC = cost.trim() === '' ? null : parseRand(cost)
    if (!name.trim()) return toast('Type a name')
    if (priceCents == null) return toast('Type a price, like 30 or 12.50')
    if (lowAt == null) return toast('Type a low-stock level')
    if (boss && cost.trim() !== '' && costC == null) return toast('Type a cost, like 15')
    const p: Product = {
      id: product?.id ?? `${slug(name)}-${crypto.randomUUID().slice(0, 4)}`, name: name.trim(), categoryId: cat, unit,
      step: unit === 'g' ? 0.5 : 1, lowAt, priceCents, active, sort: product?.sort ?? nextSort,
    }
    setBusy(true)
    try {
      if (supabase && await deviceStaffId()) {
        const { error } = await supabase.from('products').upsert(toRow('products', p))
        if (error) { toast('Could not save. Check the internet.'); return }
        if (!product || product.priceCents !== priceCents) await supabase.from('prices').insert({ product_id: p.id, cents: priceCents, set_by: me.id })
        if (boss && costC != null && costC !== costCents) await supabase.from('product_costs').upsert({ product_id: p.id, cents: costC, updated_at: new Date().toISOString() })
      }
      await db.products.put(p)
      if (boss && costC != null) await setMeta('costs', { ...(await getMeta<Record<string, number>>('costs', {})), [p.id]: costC })
      await db.audit.add({ at: new Date().toISOString(), by: me.id, action: product ? 'edit_product' : 'add_product', ref: p.id,
        detail: product && product.priceCents !== priceCents ? { priceFrom: product.priceCents, priceTo: priceCents } : undefined })
      void syncNow(); toast(product ? 'Saved' : `${p.name} added`); onClose()
    } finally { setBusy(false) }
  }

  return (
    <Sheet title={product ? `Edit ${product.name}` : 'New product'} onClose={onClose}>
      <label className="lbl" htmlFor="pf-name">Name</label>
      <input id="pf-name" value={name} onChange={e => setName(e.target.value)} />
      <div className="lbl">Group</div>
      <div className="chips">{[...new Set([...cats, 'main', 'drinks', 'rolling'])].map(c =>
        <button key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{catLabel(c)}</button>)}</div>
      <div className="lbl">Sold by</div>
      <div className="chips">
        <button className={`chip ${unit === 'ea' ? 'on' : ''}`} onClick={() => setUnit('ea')}>Each</button>
        <button className={`chip ${unit === 'g' ? 'on' : ''}`} onClick={() => setUnit('g')}>Gram (0.5 g steps)</button>
      </div>
      <label className="lbl" htmlFor="pf-price">Price (R{unit === 'g' ? ' per gram' : ''})</label>
      <input id="pf-price" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} />
      {product && parseRand(price) != null && parseRand(price) !== product.priceCents &&
        <div className="banner warnb">New price from now on. Sales already made keep {formatRand(product.priceCents)}.</div>}
      <label className="lbl" htmlFor="pf-low">Warn when stock is at or below</label>
      <input id="pf-low" inputMode="decimal" value={low} onChange={e => setLow(e.target.value)} />
      {boss && <>
        <label className="lbl" htmlFor="pf-cost">Cost price (R) · only you see this</label>
        <input id="pf-cost" inputMode="decimal" value={cost} placeholder="What you pay for it" onChange={e => setCost(e.target.value)} />
      </>}
      <label className="row" style={{ alignItems: 'center', cursor: 'pointer' }}>
        <span>Show on the till</span>
        <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} style={{ width: 24, minHeight: 24 }} />
      </label>
      <button className="blk primary" disabled={busy} onClick={save}>{product ? 'Save' : 'Add product'}</button>
    </Sheet>
  )
}
