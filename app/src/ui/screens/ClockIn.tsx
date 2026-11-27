import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { actions, db, getMeta, nextOpening } from '../../app/store'
import type { StaffMember } from '../../data/db'
import { displayName } from '../../domain/calc'
import { formatQty, formatRand, parseQty, parseRand, shiftFor } from '../../domain/num'
import { catLabel, Header, useToast } from '../kit'
import { AlertsCard } from '../Alerts'
import { deviceStaffId, supabase } from '../../sync/client'
import { syncNow } from '../../sync/engine'
import { categoryOrder, sortProducts } from '../../domain/order'

export function ClockIn({ me }: { me: StaffMember }) {
  const toast = useToast()
  const products = useLiveQuery(() => db.products.toArray().then(ps => sortProducts(ps.filter(p => p.track !== false))), [], [])
  const next = useLiveQuery(() => nextOpening(), [])
  const settingFloat = useLiveQuery(() => getMeta<number>('floatCents', 0), [], 0)
  // The float is the cash the last shift left in the drawer (what it counted at close), unless someone types another amount.
  const leftCents = useLiveQuery(async () => (await db.shifts.toArray()).filter(s => s.lockedAt).sort((a, b) => b.lockedAt!.localeCompare(a.lockedAt!))[0]?.cashCountedCents ?? null, [], null)
  const [typedFloat, setTypedFloat] = useState<number | null>(null)
  const floatCents = typedFloat ?? leftCents ?? settingFloat
  const { kind, date } = shiftFor(new Date())
  const cats = categoryOrder(products)
  const [otherOpen, setOtherOpen] = useState<string | null>(null)
  // Only one shift at a time: say whose shift is still open instead of starting a second one.
  useEffect(() => { void (async () => {
    if (!supabase || !(await deviceStaffId())) return
    const { data } = await supabase.rpc('open_shift_owner')
    setOtherOpen((data as string | null) ?? null)
  })() }, [])
  const [joining, setJoining] = useState(false)
  const join = async () => {
    setJoining(true)
    try {
      const { error } = await supabase!.rpc('join_open_shift')
      if (error) { toast('Could not join. Check the internet.'); return }
      await syncNow(); toast(`Joined ${otherOpen}’s shift`)
    } finally { setJoining(false) }
  }
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
        <label className="lbl" htmlFor="ci-float">Cash in the drawer now (your float)</label>
        <input id="ci-float" inputMode="decimal" placeholder="R" key={`f:${leftCents}`} defaultValue={floatCents ? floatCents / 100 : ''}
          onBlur={e => { const v = e.target.value.trim(); setTypedFloat(v === '' ? null : parseRand(v)) }} />
        <span className="muted small">{leftCents != null ? `The last shift left ${formatRand(leftCents)}. ` : ''}If cash was taken out at handover, count the drawer and type what is really there.</span>
        {changed.length > 0 && <div className="banner warnb">{changed.length} count{changed.length > 1 ? 's' : ''} changed. This goes on the shift report with your name.</div>}
        {otherOpen && <div className="banner warnb"><b>{otherOpen}’s shift is still open.</b>
          Working together now? Join it and you both sell into the same shift. Taking over? Count together, {otherOpen} locks it with your PIN, then clock in.
          <button className="blk sm primary" disabled={joining} onClick={join}>Join {otherOpen}’s shift</button></div>}
        <button className="blk primary" onClick={start} disabled={!next || !!otherOpen}>Confirm &amp; start shift</button>
        <button className="blk ghost" onClick={() => setFixing(!fixing)}>{fixing ? 'Done correcting' : 'Correct a count'}</button>
      </div>
    </div>
  )
}
