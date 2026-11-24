import { useEffect, useState } from 'react'
import { addStaff, db } from '../../app/store'
import type { StaffMember } from '../../data/db'
import type { Role } from '../../domain/types'
import { supabase, deviceStaffId } from '../../sync/client'
import { syncNow } from '../../sync/engine'
import { Sheet, useStaff, useToast } from '../kit'
import { SHOP } from '../../app/brand'

const token = () => [...crypto.getRandomValues(new Uint8Array(24))].map(b => b.toString(16).padStart(2, '0')).join('')
const digits = (phone?: string) => (phone ?? '').replace(/\D/g, '').replace(/^0/, '27')

/** Makes a one-time invite and opens WhatsApp to that person with the link. */
async function invite(me: StaffMember, m: StaffMember): Promise<string> {
  const t = token()
  const { error } = await supabase!.from('invites').insert({ token: t, staff_id: m.id, created_by: me.id })
  if (error) throw error
  const link = `${location.origin}/?join=${t}`
  const text = `Hi ${m.name}, this is your invite to the ${SHOP.name} shift app. Open it on your phone (works once, for 7 days): ${link}`
  const wa = digits(m.phone) ? `https://wa.me/${digits(m.phone)}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`
  window.open(wa, '_blank', 'noopener')
  return link
}

/** Managers and the boss add people, send invite links and unlock PINs. Managers cannot add a boss. */
export function People({ me, onClose }: { me: StaffMember; onClose: () => void }) {
  const staff = useStaff()
  const toast = useToast()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<Role>('employee')
  const [pin, setPin] = useState('')
  const [lastLink, setLastLink] = useState<string | null>(null)
  const [online, setOnline] = useState(false)
  useEffect(() => { void deviceStaffId().then(id => setOnline(!!id)) }, [])
  const roles: Role[] = me.role === 'boss' ? ['employee', 'manager', 'boss'] : ['employee', 'manager']

  const add = async () => {
    if (!name.trim()) return toast('Type a name')
    if (online) {
      const { data, error } = await supabase!.from('staff').insert({ name: name.trim(), phone: phone.trim() || null, role }).select('id, name, role, phone').single()
      if (error) return toast('Could not add. Check the internet.')
      const m: StaffMember = { ...(data as StaffMember), salt: '', pinHash: '', failed: 0, locked: false }
      await db.staff.put(m)
      setLastLink(await invite(me, m)); toast(`${m.name} added · invite opened in WhatsApp`)
    } else {
      if (!/^\d{4}$/.test(pin)) return toast('Name and a 4-number PIN')
      await addStaff(name, role, pin); toast(`${name.trim()} added`)
    }
    setName(''); setPhone(''); setPin(''); void syncNow()
  }
  const unlock = async (m: StaffMember) => {
    if (online) await supabase!.rpc('reset_pin_lock', { p_staff: m.id })
    await db.staff.put({ ...m, failed: 0, locked: false }); toast(`${m.name} unlocked`)
  }
  return (
    <Sheet title="People" onClose={onClose}>
      <div className="grp">{staff.map(m => (
        <div className="row" key={m.id} style={{ alignItems: 'center', gap: 8 }}>
          <span>{m.name} <span className="muted small">· {m.role}</span></span>
          <span style={{ display: 'flex', gap: 6 }}>
            {online && m.id !== me.id && <button className="chip" onClick={async () => { try { setLastLink(await invite(me, m)) } catch { toast('Could not make an invite') } }}>Invite</button>}
            <button className="chip" onClick={() => unlock(m)}>Unlock PIN</button>
          </span>
        </div>))}
      </div>
      {lastLink && <div className="note small" style={{ wordBreak: 'break-all' }}>If WhatsApp did not open, copy this link and send it yourself:<br /><b>{lastLink}</b></div>}
      <div className="lbl">Add a person</div>
      <input aria-label="Name" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
      {online && <input aria-label="WhatsApp number" placeholder="WhatsApp number, e.g. 071 234 5678" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} />}
      <div className="chips">{roles.map(r => <button key={r} className={`chip ${role === r ? 'on' : ''}`} onClick={() => setRole(r)}>{r}</button>)}</div>
      {!online && <input aria-label="Their PIN" placeholder="Their 4-number PIN" type="password" inputMode="numeric" maxLength={4} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} />}
      <button className="blk primary" onClick={add}>{online ? 'Add and send invite' : 'Add person'}</button>
    </Sheet>
  )
}
