import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../app/store'
import type { StaffMember } from '../../data/db'
import { shiftTotals } from '../../domain/calc'
import { formatRand } from '../../domain/num'
import { CountUp, Header, saleCents, sellerColor, ShiftStrip, useShiftData, useStaff } from '../kit'
import { OutCard } from './StockOut'
import { AlertsCard } from '../Alerts'
import { supabase } from '../../sync/client'

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg' })

/** What the boss and manager see: the shift that is open now, approvals, and the last report. */
export function Overview({ me, onStartShift, onOpenReport, onReports }: { me: StaffMember; onStartShift: () => void; onOpenReport: (id: string) => void; onReports?: () => void }) {
  const staff = useStaff()
  const shifts = useLiveQuery(() => db.shifts.toArray(), [], [])
  const open = shifts.find(s => !s.lockedAt)
  const last = shifts.filter(s => s.lockedAt).sort((a, b) => b.lockedAt!.localeCompare(a.lockedAt!))[0]
  const data = useShiftData(open?.id)
  const lastData = useShiftData(last?.id)
  const name = (id?: string) => staff.find(s => s.id === id)?.name ?? '—'
  const t = data && shiftTotals(data)
  const pending = data?.moves.filter(m => m.kind === 'out' && m.status === 'pending') ?? []
  const feed = data ? [
    ...data.sales.map(s => ({ at: s.at, by: s.by, text: `${s.void ? 'Voided sale' : 'Sale'} ${formatRand(saleCents(s))} · ${name(s.by).split(' ')[0]}` })),
    ...data.moves.map(m => ({ at: m.decidedAt ?? m.at, by: m.by, text: `Stock ${m.kind} ${m.qty} ${data.products.find(p => p.id === m.productId)?.name ?? ''} · ${m.status}` })),
    ...data.expenses.map(e => ({ at: e.at, by: e.by, text: `Expense ${formatRand(e.cents)} · ${e.note}` })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10) : []
  return (
    <div className="main enter">
      <Header title="Shop overview" sub={`${me.name} · ${me.role}`} />
      <div className="pad stack">
        {supabase && <AlertsCard me={me} compact />}
        {last && !last.sentAt && <div className="banner warnb">The {last.kind} shift report for {last.date} has not been sent yet. {name(last.pinOutBy ?? last.openedBy)} should send it.
          <button className="blk sm" onClick={() => onOpenReport(last.id)}>Open that report</button></div>}
        {open && data && t ? <>
          <div className="req"><div className="top"><b>{open.kind === 'day' ? 'Day' : 'Night'} shift · {open.date}</b><span className="pill done">open</span></div>
            <div className="muted small">{[open.openedBy, ...(open.helpers ?? [])].map(name).join(' + ')} since {time(open.openedAt)}</div></div>
          <ShiftStrip data={data} flush />
          <div className="two">
            <div className="block"><div className="lbl">Sales so far</div><b className="num" style={{ fontSize: 26, color: 'var(--accent)' }}><CountUp cents={t.salesCents} /></b></div>
            <div className="block"><div className="lbl">Waiting on you</div><b className="num" style={{ fontSize: 26, color: pending.length ? 'var(--wait)' : 'var(--muted)' }}>{pending.length}</b></div>
            <div className="block"><div className="lbl">Card</div><b className="num"><CountUp cents={t.cardCents} /></b></div>
            <div className="block"><div className="lbl">Cash</div><b className="num"><CountUp cents={t.cashCents} /></b></div>
          </div>
          {pending.map(m => <OutCard key={m.id} m={m} data={data} me={me} />)}
          <div className="lbl">Activity</div>
          <div className="grp">{feed.length ? feed.map((f, i) => <div className="row" key={i}><span className="num muted">{time(f.at)}</span><span style={{ flex: 1 }}><span className="by" style={{ ['--c' as string]: sellerColor(open, f.by) }} />{f.text}</span></div>)
            : <span className="muted small">Nothing yet</span>}</div>
        </> : <>
          <div className="note">No shift is open right now.</div>
          <button className="blk primary" onClick={onStartShift}>Start a shift myself</button>
        </>}
        {last && lastData && <button className="blk ghost" onClick={() => onOpenReport(last.id)}>Last report: {last.kind} {last.date} · {formatRand(shiftTotals(lastData).salesCents)}</button>}
        {onReports && <button className="blk ghost" onClick={onReports}>Reports · 7 and 30 days</button>}
      </div>
    </div>
  )
}
