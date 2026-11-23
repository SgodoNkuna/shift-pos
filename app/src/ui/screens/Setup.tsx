import { useState } from 'react'
import { firstRun } from '../../app/store'
import type { StaffMember } from '../../data/db'
import type { Role } from '../../domain/types'

/** First run on a phone: add yourself (and optionally load the paper-sheet products). */
export function Setup({ onDone }: { onDone: (m: StaffMember) => void }) {
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('employee')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [demo, setDemo] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const submit = async () => {
    if (!name.trim()) return setErr('Type your name.')
    if (!/^\d{4}$/.test(pin)) return setErr('The PIN must be 4 numbers.')
    if (pin !== pin2) return setErr('The two PINs are not the same.')
    onDone(await firstRun({ name, pin, demo, role }))
  }
  return (
    <div className="pad stack enter">
      <div className="mark" style={{ alignItems: 'center', padding: '18px 0 6px' }}><span>SHIFT</span>POS</div>
      <div className="note">Set up this phone. You only do this once. Each person signs in with their own 4-number PIN.</div>
      <label className="lbl" htmlFor="su-name">Your name</label>
      <input id="su-name" value={name} onChange={e => setName(e.target.value)} autoComplete="name" />
      <div className="lbl">Your role</div>
      <div className="chips">{(['employee', 'manager', 'boss'] as Role[]).map(r =>
        <button key={r} className={`chip ${role === r ? 'on' : ''}`} onClick={() => setRole(r)}>{r}</button>)}</div>
      <label className="lbl" htmlFor="su-pin">New PIN (4 numbers)</label>
      <input id="su-pin" type="password" inputMode="numeric" maxLength={4} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} />
      <label className="lbl" htmlFor="su-pin2">Type the PIN again</label>
      <input id="su-pin2" type="password" inputMode="numeric" maxLength={4} value={pin2} onChange={e => setPin2(e.target.value.replace(/\D/g, ''))} />
      <label className="row" style={{ alignItems: 'center', cursor: 'pointer' }}>
        <span>Load the products from our paper sheet</span>
        <input type="checkbox" checked={demo} onChange={e => setDemo(e.target.checked)} style={{ width: 24, minHeight: 24 }} />
      </label>
      {err && <div className="bad" role="alert">{err}</div>}
      <button className="blk primary" onClick={submit}>Set up</button>
    </div>
  )
}
