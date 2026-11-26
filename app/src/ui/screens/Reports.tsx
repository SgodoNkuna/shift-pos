import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { actions, db, getMeta } from '../../app/store'
import type { StaffMember } from '../../data/db'
import { displayName, periodSummary, shiftFlags, shiftTotals } from '../../domain/calc'
import { formatQty, formatRand } from '../../domain/num'
import { Header, useStaff } from '../kit'
import { certMatches, certNumber, sealCode } from '../../report/names'

/** Manager and boss: totals for the last 7 or 30 days, every shift with its problems, best sellers. Boss also sees profit. */
export function Reports({ me, onOpenReport }: { me: StaffMember; onOpenReport: (id: string) => void }) {
  const [days, setDays] = useState<7 | 30>(7)
  const [cert, setCert] = useState('')
  const found = useLiveQuery(async () => {
    if (cert.replace(/[^a-z0-9]/gi, '').length < 6) return null
    const s = (await db.shifts.toArray()).find(x => x.lockedAt && certMatches(cert, x))
    return s ? actions.loadShiftData(s.id) : undefined
  }, [cert])
  const staff = useStaff()
  const costs: Record<string, number> = useLiveQuery(() => getMeta<Record<string, number>>('costs', {}), [], {})
  const datas = useLiveQuery(async () => {
    const from = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10)
    const shifts = (await db.shifts.toArray()).filter(s => s.lockedAt && s.date >= from).sort((a, b) => b.lockedAt!.localeCompare(a.lockedAt!))
    return Promise.all(shifts.map(s => actions.loadShiftData(s.id)))
  }, [days])
  if (!datas) return null
  const names = Object.fromEntries(staff.map(s => [s.id, s.name]))
  const r = periodSummary(datas, costs)
  const products = datas[0]?.products ?? []
  const pname = (id: string) => { const p = products.find(x => x.id === id); return p ? displayName(p, products) : id }
  const money = (c: number, bad = false) => <b className={`num ${bad && c ? 'bad' : ''}`}>{formatRand(c)}</b>
  return (
    <div className="main enter">
      <Header title="Reports" sub={`${r.shifts} locked shift${r.shifts === 1 ? '' : 's'}`} />
      <div className="pad stack">
        <label htmlFor="cert-find" className="lbl">Check a printed report</label>
        <input id="cert-find" placeholder="Certificate number, e.g. HCL-261126-D-7F3A9C" value={cert} onChange={e => setCert(e.target.value)} autoCapitalize="characters" />
        {found === undefined && cert && <div className="banner warnb">No locked report with that certificate number on this phone (the app keeps the last 31 days).</div>}
        {found && (() => { const t = shiftTotals(found); return (
          <button className="banner okb2" style={{ textAlign: 'left' }} onClick={() => onOpenReport(found.shift.id)}>
            <b>Found: {found.shift.kind === 'day' ? 'Day' : 'Night'} shift {found.shift.date}</b>
            <span className="num">{certNumber(found.shift)} · seal <b>{sealCode(found)}</b></span>
            <span>Total sales {formatRand(t.salesCents)} · cash counted {found.shift.cashCountedCents != null ? formatRand(found.shift.cashCountedCents) : '—'}</span>
            <span className="small">The seal on the paper must say <b>{sealCode(found)}</b>. If it doesn’t, the printout was changed. Tap to open the report.</span>
          </button>) })()}
        <div className="seg" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {([7, 30] as const).map(d => <button key={d} className={days === d ? 'on' : ''} onClick={() => setDays(d)}>LAST {d} DAYS</button>)}
        </div>
        <div className="two">
          <div className="block"><div className="lbl">Sales</div><b className="num" style={{ fontSize: 24, color: 'var(--accent)' }}>{formatRand(r.salesCents)}</b></div>
          {me.role === 'boss'
            ? <div className="block"><div className="lbl">Profit · only you</div><b className="num ok" style={{ fontSize: 24 }}>{formatRand(r.profitCents)}</b></div>
            : <div className="block"><div className="lbl">Shifts</div><b className="num" style={{ fontSize: 24 }}>{r.shifts}</b></div>}
        </div>
        <div className="grp">
          <div className="row"><span>Card</span>{money(r.cardCents)}</div>
          <div className="row"><span>Cash</span>{money(r.cashCents)}</div>
          <div className="row"><span>Expenses</span>{money(r.expensesCents)}</div>
          <div className="row"><span>Cash short (−) or over (+)</span>{money(r.cashDiffCents, true)}</div>
          <div className="row"><span>Stock missing (−) or extra (+)</span>{money(r.stockDiffCents, true)}</div>
        </div>
        {r.top.length > 0 && <><div className="lbl">Best sellers</div>
          <div className="grp">{r.top.map((t, i) => { const p = products.find(x => x.id === t.productId)
            return <div className="row" key={t.productId}><span>{i + 1}. {pname(t.productId)} <span className="muted small">· {p ? formatQty(p, t.qty) : t.qty}</span></span>{money(t.salesCents)}</div> })}</div></>}
        <div className="lbl">Shifts</div>
        {datas.length ? datas.map(d => { const t = shiftTotals(d); const bad = shiftFlags(d, names).filter(f => f.level === 'bad').length
          return (
            <button key={d.shift.id} className="req" style={{ textAlign: 'left', width: '100%' }} onClick={() => onOpenReport(d.shift.id)}>
              <div className="top"><b>{d.shift.kind === 'day' ? 'Day' : 'Night'} · {d.shift.date}</b><b className="num">{formatRand(t.salesCents)}</b></div>
              <div className="small">
                <span className="muted">{names[d.shift.pinOutBy ?? d.shift.openedBy] ?? '—'}</span>
                {bad ? <span className="bad"> · {bad} to check</span> : <span className="ok"> · all adds up</span>}
                {!d.shift.sentAt && <span className="warn"> · not sent</span>}
                <span className="muted num"> · {certNumber(d.shift)}</span>
              </div>
            </button>)
        }) : <p className="muted">No locked shifts in this period yet.</p>}
      </div>
    </div>
  )
}
