import { useEffect, useState } from 'react'
import type { StaffMember } from '../data/db'
import { alertState, isIos, sendTestAlert, turnOnAlerts, type AlertState } from '../push/push'
import { useToast } from './kit'

const WHY: Record<StaffMember['role'], string> = {
  boss: 'Your phone buzzes when stock out needs your OK, and when a shift report is not sent.',
  manager: 'Your phone buzzes when stock out waits more than 5 minutes, and when a shift report is not sent.',
  employee: 'Your phone buzzes when your stock out is approved or rejected, and if you forget to send the report.',
}

/** Turn alerts on, test them, or explain what to do on iPhone. `compact` hides it once alerts are on. */
export function AlertsCard({ me, compact = false }: { me: StaffMember; compact?: boolean }) {
  const toast = useToast()
  const [st, setSt] = useState<AlertState | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { void alertState().then(setSt) }, [])
  if (st === null || (compact && (st === 'on' || st === 'unsupported'))) return null
  const on = async () => {
    setBusy(true)
    try { const s = await turnOnAlerts(me.id); setSt(s); if (s === 'on') toast('Alerts are on') }
    catch { toast('Could not turn on alerts. Check the internet.') } finally { setBusy(false) }
  }
  const test = async () => {
    setBusy(true)
    try { const r = await sendTestAlert(); toast(r.sent ? 'Test alert sent' : 'No phone found. Turn alerts on again.') }
    catch { toast('Could not send a test. Check the internet.') } finally { setBusy(false) }
  }
  return (
    <div className={`banner ${st === 'on' ? 'okb2' : 'warnb'}`}>
      <b>{st === 'on' ? 'Alerts are on' : 'Turn on alerts'}</b>
      <span>{WHY[me.role]}</span>
      {st === 'off' && <button className="blk sm primary" disabled={busy} onClick={on}>Turn on alerts</button>}
      {st === 'on' && <button className="blk sm" disabled={busy} onClick={test}>Send me a test alert</button>}
      {st === 'blocked' && <span>Alerts are blocked for this app. Open your phone’s <b>Settings → Notifications</b> (or the browser’s site settings), allow Shift POS, then come back.</span>}
      {st === 'install-first' && <span>On iPhone, alerts only work from the Home Screen: tap the <b>Share</b> button, then <b>Add to Home Screen</b>. Open Shift POS from there and turn alerts on.</span>}
      {st === 'unsupported' && <span>{isIos() ? 'Update your iPhone to iOS 16.4 or newer to get alerts.' : 'This browser cannot show alerts. Use Chrome.'}</span>}
    </div>
  )
}
