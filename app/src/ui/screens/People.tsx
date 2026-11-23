import { useState } from 'react'
import { addStaff, db } from '../../app/store'
import type { StaffMember } from '../../data/db'
import type { Role } from '../../domain/types'
import { Sheet, useStaff, useToast } from '../kit'

/** Managers and the boss add people and reset locked PINs. Managers cannot add a boss. */
export function People({ me, onClose }: { me: StaffMember; onClose: () => void }) {
  const staff = useStaff()
  const toast = useToast()
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('employee')
  const [pin, setPin] = useState('')
  const roles: Role[] = me.role === 'boss' ? ['employee', 'manager', 'boss'] : ['employee', 'manager']
  const add = async () => {
    if (!name.trim() || !/^\d{4}$/.test(pin)) return toast('Name and a 4-number PIN')
    await addStaff(name, role, pin); setName(''); setPin(''); toast(`${name.trim()} added`)
  }
  const unlock = async (m: StaffMember) => { await db.staff.put({ ...m, failed: 0, locked: false }); toast(`${m.name} unlocked`) }
  return (
    <Sheet title="People" onClose={onClose}>
      <div className="grp">{staff.map(m => (
        <div className="row" key={m.id} style={{ alignItems: 'center' }}>
          <span>{m.name} <span className="muted small">· {m.role}</span></span>
          {m.locked ? <button className="chip" onClick={() => unlock(m)}>Unlock</button> : <span className="muted small">active</span>}
        </div>))}
      </div>
      <div className="lbl">Add a person</div>
      <input aria-label="Name" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
      <div className="chips">{roles.map(r => <button key={r} className={`chip ${role === r ? 'on' : ''}`} onClick={() => setRole(r)}>{r}</button>)}</div>
      <input aria-label="Their PIN" placeholder="Their 4-number PIN" type="password" inputMode="numeric" maxLength={4} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} />
      <button className="blk primary" onClick={add}>Add person</button>
    </Sheet>
  )
}
