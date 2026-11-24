import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, DEMO_LOGINS, getMeta, openShiftNow, resetPhone, startDemo } from '../app/store'
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
import { Settings } from './screens/Settings'
import { Products } from './screens/Products'
import { Reports } from './screens/Reports'
import { Join, Welcome } from './screens/Join'
import { Overview } from './screens/Overview'
import { deviceStaffId, supabase } from '../sync/client'
import { onSync, startSync, syncState, type SyncState } from '../sync/engine'

import { AlertsCard } from './Alerts'

type Tab = 'sell' | 'in' | 'out' | 'exp' | 'close'
const TABS: [Tab, string][] = [['sell', 'Sell'], ['in', 'In'], ['out', 'Out'], ['exp', 'Expense'], ['close', 'Close']]

function Clock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(t) }, [])
  return <span className="num">{now.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg' })}</span>
}

function SyncLabel() {
  const [s, setS] = useState<SyncState>(syncState())
  useEffect(() => onSync(setS), [])
  const demo = useLiveQuery(() => getMeta<boolean>('demo', false), [], false)
  if (demo) return <span className="net off" title="Demo: saved on this phone only, never sent to the shop."><i />Demo</span>
  const text = s.mode === 'phone' ? 'On phone' : s.mode === 'online' ? (s.waiting ? `Sending ${s.waiting}` : 'Synced')
    : s.mode === 'offline' ? `Offline${s.waiting ? ` · ${s.waiting} waiting` : ''}` : 'Sync problem'
  const tip = s.mode === 'phone' ? 'Saved on this phone only.' : s.mode === 'online' ? 'Saved and shared with the boss.' : 'Saved on this phone. It sends when the internet is back.'
  if (s.refused) return <span className="net off bad" title="The server refused a change. Tell the manager; it is listed in the change log on this phone."><i style={{ background: 'var(--bad)' }} />{s.refused} not saved</span>
  return <span className={`net ${s.mode === 'online' ? '' : 'off'}`} title={tip}><i />{text}</span>
}

const joinToken = new URLSearchParams(location.search).get('join')

function Shell() {
  const staffCount = useLiveQuery(() => db.staff.count())
  const [deviceId, setDeviceId] = useState<string | null | undefined>(supabase ? undefined : null)
  const [leadTill, setLeadTill] = useState(false)
  const [reports, setReports] = useState(false)
  useEffect(() => { if (supabase) { void deviceStaffId().then(setDeviceId); startSync() } }, [])
  const staff = useStaff()
  const [me, setMe] = useState<StaffMember | null>(null)
  const [tab, setTab] = useState<Tab>('sell')
  const [reportId, setReportId] = useState<string | null>(null)
  const [autoSend, setAutoSend] = useState(false)
  const [menu, setMenu] = useState<null | 'menu' | 'people' | 'settings' | 'products'>(null)
  const open = useLiveQuery(() => openShiftNow(), [], undefined)
  const data = useShiftData(reportId ?? open?.id)
  const pending = data?.moves.filter(m => m.kind === 'out' && m.status === 'pending').length ?? 0
  const signOut = () => { setMe(null); setReportId(null); setTab('sell'); setMenu(null); setLeadTill(false); setReports(false) }
  const lead = me != null && me.role !== 'employee'
  const demo = useLiveQuery(() => getMeta<boolean>('demo', false), [], false)

  if (staffCount === undefined || deviceId === undefined) return null
  const bar = (
    <div className="sbar">
      <Clock />
      <span>{me ? `${me.name} · ${me.role}` : ''}</span>
      <SyncLabel />
      {me && <button className="linkbtn" onClick={() => setMenu('menu')}>Menu</button>}
    </div>)

  let body
  if (joinToken && !me) body = <Join token={joinToken} onDone={m => { setDeviceId(m.id); setMe(m) }} />
  else if (staffCount === 0) body = supabase ? <Welcome onDemo={() => void startDemo()} /> : <Setup onDone={setMe} />
  else if (!me) body = (
    <div className="main enter"><div className="pad stack pinwrap">
      <div className="mark"><span>CANNABIS LOUNGE</span>HASH</div>
      <PinPad people={deviceId ? staff.filter(s => s.id === deviceId) : staff} onOk={m => setMe(m)} />
      {demo && <div className="note small" style={{ textAlign: 'left', width: '100%' }}><b>Demo logins</b><br />
        {DEMO_LOGINS.map(d => <span key={d.name}>{d.name} ({d.role}): PIN <b className="num">{d.pin}</b><br /></span>)}</div>}
    </div></div>)
  else if (reportId && data) body = <Report data={data} me={me} autoSend={autoSend} onDone={() => { setAutoSend(false); if (lead) { setReportId(null); setLeadTill(false) } else signOut() }} />
  else if (lead && reports) body = <Reports me={me} onOpenReport={id => { setReports(false); setReportId(id) }} />
  else if (lead && !leadTill && !(open && open.openedBy === me.id))
    body = <Overview me={me} onStartShift={() => setLeadTill(true)} onOpenReport={id => setReportId(id)} onReports={() => setReports(true)} />
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
    {tab === 'close' && <ClockOut data={data} me={me} onLocked={(id, send) => { setAutoSend(!!send); setReportId(id) }} />}
    <nav className="nav">{TABS.map(([k, l]) =>
      <button key={k} className={tab === k ? 'on' : ''} aria-current={tab === k} onClick={() => setTab(k)}>{l}
        {k === 'out' && pending > 0 && <span className="badge">{pending}</span>}</button>)}</nav>
  </>

  return (
    <div className="shell">
      {bar}
      {body}
      {menu === 'menu' && me && <Sheet title="Menu" onClose={() => setMenu(null)}>
        {lead && <button className="blk" onClick={() => { setLeadTill(false); setReportId(null); setReports(false); setMenu(null) }}>Overview</button>}
        {lead && <button className="blk" onClick={() => { setReports(true); setReportId(null); setMenu(null) }}>Reports</button>}
        {lead && <button className="blk" onClick={() => setMenu('people')}>People</button>}
        {lead && <button className="blk" onClick={() => setMenu('products')}>Products &amp; prices</button>}
        {me.role === 'boss' && <button className="blk" onClick={() => setMenu('settings')}>Settings</button>}
        <AlertsCard me={me} />
        {!deviceId && supabase && <button className="blk badb" onClick={() => void resetPhone()}>{demo ? 'Leave the demo' : 'Leave test mode'} (wipes this phone)</button>}
        <button className="blk" onClick={signOut}>Sign out</button>
      </Sheet>}
      {menu === 'people' && me && <People me={me} onClose={() => setMenu(null)} />}
      {menu === 'settings' && me?.role === 'boss' && <Settings onClose={() => setMenu(null)} />}
      {menu === 'products' && me && me.role !== 'employee' && <Products me={me} onClose={() => setMenu(null)} />}
    </div>)
}

export default function App() {
  return <ToastHost><Shell /></ToastHost>
}
