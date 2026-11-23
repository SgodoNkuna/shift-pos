import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, openShiftNow } from '../app/store'
import type { StaffMember } from '../data/db'
import { PinPad, Sheet, ToastHost, useShiftData, useStaff } from './kit'
import { Setup } from './screens/Setup'
import { ClockIn } from './screens/ClockIn'
import { Sell } from './screens/Sell'
import { StockIn } from './screens/StockIn'
import { StockOut } from './screens/StockOut'
import { Expense } from './screens/Expense'
import { ClockOut } from './screens/ClockOut'
import { Report } from './screens/Report'
import { People } from './screens/People'

type Tab = 'sell' | 'in' | 'out' | 'exp' | 'close'
const TABS: [Tab, string][] = [['sell', 'Sell'], ['in', 'In'], ['out', 'Out'], ['exp', 'Expense'], ['close', 'Close']]

function Clock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(t) }, [])
  return <span className="num">{now.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg' })}</span>
}

function Shell() {
  const staffCount = useLiveQuery(() => db.staff.count())
  const staff = useStaff()
  const [me, setMe] = useState<StaffMember | null>(null)
  const [tab, setTab] = useState<Tab>('sell')
  const [reportId, setReportId] = useState<string | null>(null)
  const [menu, setMenu] = useState<null | 'menu' | 'people'>(null)
  const open = useLiveQuery(() => openShiftNow(), [], undefined)
  const data = useShiftData(reportId ?? open?.id)
  const pending = data?.moves.filter(m => m.kind === 'out' && m.status === 'pending').length ?? 0
  const signOut = () => { setMe(null); setReportId(null); setTab('sell'); setMenu(null) }

  if (staffCount === undefined) return null
  const bar = (
    <div className="sbar">
      <Clock />
      <span>{me ? `${me.name} · ${me.role}` : ''}</span>
      <span className="net off" title="Saved on this phone. Syncing to the boss comes in the next update."><i />On phone</span>
      {me && <button className="linkbtn" onClick={() => setMenu('menu')}>Menu</button>}
    </div>)

  let body
  if (staffCount === 0) body = <Setup onDone={setMe} />
  else if (!me) body = (
    <div className="main enter"><div className="pad stack pinwrap">
      <div className="mark"><span>SHIFT</span>POS</div>
      <PinPad people={staff} onOk={setMe} />
    </div></div>)
  else if (reportId && data) body = <Report data={data} me={me} onDone={signOut} />
  else if (!open) body = <ClockIn me={me} />
  else if (open.openedBy !== me.id && me.role === 'employee') body = (
    <div className="main"><div className="pad stack">
      <div className="banner warnb">{staff.find(s => s.id === open.openedBy)?.name ?? 'Someone'}’s shift is still open. They clock out first, with you there to count and enter your PIN.</div>
      <button className="blk" onClick={signOut}>Sign out</button></div></div>)
  else if (!data) body = null
  else body = <>
    {tab === 'sell' && <Sell data={data} me={me} />}
    {tab === 'in' && <StockIn data={data} me={me} />}
    {tab === 'out' && <StockOut data={data} me={me} />}
    {tab === 'exp' && <Expense data={data} me={me} />}
    {tab === 'close' && <ClockOut data={data} me={me} onLocked={id => setReportId(id)} />}
    <nav className="nav">{TABS.map(([k, l]) =>
      <button key={k} className={tab === k ? 'on' : ''} aria-current={tab === k} onClick={() => setTab(k)}>{l}
        {k === 'out' && pending > 0 && <span className="badge">{pending}</span>}</button>)}</nav>
  </>

  return (
    <div className="shell">
      {bar}
      {body}
      {menu === 'menu' && me && <Sheet title="Menu" onClose={() => setMenu(null)}>
        {me.role !== 'employee' && <button className="blk" onClick={() => setMenu('people')}>People</button>}
        <button className="blk" onClick={signOut}>Sign out</button>
      </Sheet>}
      {menu === 'people' && me && <People me={me} onClose={() => setMenu(null)} />}
    </div>)
}

export default function App() {
  return <ToastHost><Shell /></ToastHost>
}
