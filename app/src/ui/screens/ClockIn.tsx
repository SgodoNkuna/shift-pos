import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { actions, db, getMeta, nextOpening } from '../../app/store'
import type { StaffMember } from '../../data/db'
import { displayName } from '../../domain/calc'
import { formatQty, formatRand, parseQty, shiftFor } from '../../domain/num'
import { catLabel, Header, useToast } from '../kit'
import { AlertsCard } from '../Alerts'
import { supabase } from '../../sync/client'
import { categoryOrder, sortProducts } from '../../domain/order'

export function ClockIn({ me }: { me: StaffMember }) {
  const toast = useToast()
  const products = useLiveQuery(() => db.products.toArray().then(sortProducts), [], [])
  const next = useLiveQuery(() => nextOpening(), [])
  const floatCents = useLiveQuery(() => getMeta<number>('floatCents', 0), [], 0)
  const { kind, date } = shiftFor(new Date())
  const cats = categoryOrder(products)
  const [fixing, setFixing] = useState(false)
  const [fix, setFix] = useState<Record<string, number>>({})
  const changed = Object.entries(fix).filter(([id, v]) => v !== (next?.opening[id] ?? 0))
  const start = async () => {
    await actions.openShift({ by: me.id, floatCents, opening: next?.opening ?? {}, corrections: Object.fromEntries(changed) })
    toast(`${kind === 'day' ? 'Day' : 'Night'} shift started`)
  }
  return (
    <div className="main enter">
      <Header title="Clock in" sub={`${kind === 'day' ? 'Day' : 'Night'} shift · ${date} · ${me.name}`} />
      <div className="pad stack">
        {supabase && <AlertsCard me={me} compact />}
        <div className="note">Opening stock comes from the <b>{next?.from ?? '…'}</b>. Count what is really there. If a number is wrong, tap <b>Correct a count</b> at the bottom.</div>
        {!products.length && <div className="banner warnb">No products yet. A manager or the boss adds them first.</div>}
        {cats.map(c => (
          <div className="grp" key={c}><div className="gl">{catLabel(c)}</div>
            {products.filter(p => p.categoryId === c).map(p => {
              const was = next?.opening[p.id] ?? 0
              const now = fix[p.id] ?? was
              return (
                <div className="row" key={p.id} style={{ alignItems: 'center', ...(now !== was ? { color: 'var(--warn)' } : {}) }}>
                  <span>{displayName(p, products)}{now !== was && <span className="small"> · was {formatQty(p, was)}</span>}</span>
                  {fixing
                    ? <input className="cin" inputMode="decimal" aria-label={`Real count ${displayName(p, products)}`} defaultValue={now}
                        onBlur={e => { const v = parseQty(e.target.value); setFix(f => { const n = { ...f }; if (v == null || v === was) delete n[p.id]; else n[p.id] = v; return n }) }} />
                    : <b className="num">{formatQty(p, now)}</b>}
                </div>)
            })}
          </div>))}
        <div className="row big"><span>Cash float in the drawer</span><b className="num">{formatRand(floatCents)}</b></div>
        {changed.length > 0 && <div className="banner warnb">{changed.length} count{changed.length > 1 ? 's' : ''} changed. This goes on the shift report with your name.</div>}
        <button className="blk primary" onClick={start} disabled={!next}>Confirm &amp; start shift</button>
        <button className="blk ghost" onClick={() => setFixing(!fixing)}>{fixing ? 'Done correcting' : 'Correct a count'}</button>
      </div>
    </div>
  )
}
