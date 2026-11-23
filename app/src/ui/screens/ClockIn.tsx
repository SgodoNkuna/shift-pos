import { useLiveQuery } from 'dexie-react-hooks'
import { actions, db, getMeta, nextOpening } from '../../app/store'
import type { StaffMember } from '../../data/db'
import { displayName } from '../../domain/calc'
import { formatQty, formatRand, shiftFor } from '../../domain/num'
import { catLabel, Header, useToast } from '../kit'
import { categoryOrder, sortProducts } from '../../domain/order'

export function ClockIn({ me }: { me: StaffMember }) {
  const toast = useToast()
  const products = useLiveQuery(() => db.products.toArray().then(sortProducts), [], [])
  const next = useLiveQuery(() => nextOpening(), [])
  const floatCents = useLiveQuery(() => getMeta<number>('floatCents', 0), [], 0)
  const { kind, date } = shiftFor(new Date())
  const cats = categoryOrder(products)
  const start = async () => {
    await actions.openShift({ by: me.id, floatCents, opening: next?.opening ?? {} })
    toast(`${kind === 'day' ? 'Day' : 'Night'} shift started`)
  }
  return (
    <div className="main enter">
      <Header title="Clock in" sub={`${kind === 'day' ? 'Day' : 'Night'} shift · ${date} · ${me.name}`} />
      <div className="pad stack">
        <div className="note">Opening stock comes from the <b>{next?.from ?? '…'}</b>. Nobody types it again. If a number looks wrong, tell the manager before you start.</div>
        {!products.length && <div className="banner warnb">No products yet. A manager or the boss adds them first.</div>}
        {cats.map(c => (
          <div className="grp" key={c}><div className="gl">{catLabel(c)}</div>
            {products.filter(p => p.categoryId === c).map(p =>
              <div className="row" key={p.id}><span>{displayName(p, products)}</span><b className="num">{formatQty(p, next?.opening[p.id] ?? 0)}</b></div>)}
          </div>))}
        <div className="row big"><span>Cash float in the drawer</span><b className="num">{formatRand(floatCents)}</b></div>
        <button className="blk primary" onClick={start} disabled={!next}>Confirm &amp; start shift</button>
      </div>
    </div>
  )
}
