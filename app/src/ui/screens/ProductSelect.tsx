import { displayName } from '../../domain/calc'
import { formatRand } from '../../domain/num'
import type { Product } from '../../domain/types'
import { catLabel } from '../kit'

export function ProductSelect({ id, products, value, onChange }: { id: string; products: Product[]; value: string; onChange: (v: string) => void }) {
  const cats = [...new Set(products.map(p => p.categoryId))]
  return <>
    <label className="lbl" htmlFor={id}>Product</label>
    <select id={id} value={value} onChange={e => onChange(e.target.value)}>
      {cats.map(c => <optgroup key={c} label={catLabel(c)}>
        {products.filter(p => p.categoryId === c && p.active).map(p =>
          <option key={p.id} value={p.id}>{displayName(p, products)} · {formatRand(p.priceCents)}{p.unit === 'g' ? '/g' : ''}</option>)}
      </optgroup>)}
    </select>
  </>
}
