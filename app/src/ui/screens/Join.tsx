import { BrandMark } from '../kit'
import { useEffect, useState } from 'react'
import { db } from '../../app/store'
import { hashPin } from '../../auth/pin'
import type { StaffMember } from '../../data/db'
import { deviceStaffId, supabase, SUPABASE_KEY, SUPABASE_URL } from '../../sync/client'
import { syncNow } from '../../sync/engine'
import { DEMO_ONLY, SHOP } from '../../app/brand'

const hex = (n: number) => [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2, '0')).join('')

/** Opened from the WhatsApp invite link: sets up this phone for one person, who then picks a PIN. */
export function Join({ token, onDone }: { token: string | null; onDone: (m: StaffMember) => void }) {
  const [step, setStep] = useState<'start' | 'pin' | 'busy'>('busy')
  const [err, setErr] = useState<string | null>(null)
  const [who, setWho] = useState<{ id: string; name: string; role: StaffMember['role'] } | null>(null)
  // A phone that already joined but never saved a PIN (setup was interrupted) goes straight to the PIN step.
  useEffect(() => { void (async () => {
    const id = await deviceStaffId()
    if (id) {
      const { data } = await supabase!.from('staff').select('id, name, role').eq('id', id).maybeSingle()
      if (data) { setWho(data as typeof who); setStep('pin'); return }
    }
    setStep('start')
  })() }, [])
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')

  const join = async () => {
    setStep('busy'); setErr(null)
    try {
      const password = hex(32)
      if (!token) throw new Error('Open your invite link again to set up this phone.')
      const res = await fetch(`${SUPABASE_URL}/functions/v1/redeem-invite`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY }, body: JSON.stringify({ token, password }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'This invite link is not valid.')
      const { error } = await supabase!.auth.signInWithPassword({ email: body.email, password })
      if (error) throw new Error('Could not sign in. Try the link again.')
      // A phone that was used for testing starts clean.
      await Promise.all([db.shifts.clear(), db.sales.clear(), db.moves.clear(), db.expenses.clear(), db.outbox.clear(), db.staff.clear(), db.products.clear()])
      setWho(body.staff); setStep('pin')
    } catch (e) { setErr((e as Error).message); setStep('start') }
  }

  const savePin = async () => {
    if (!/^\d{4}$/.test(pin)) return setErr('The PIN must be 4 numbers.')
    if (pin !== pin2) return setErr('The two PINs are not the same.')
    setStep('busy'); setErr(null)
    const { error } = await supabase!.rpc('set_my_pin', { p_pin: pin })
    if (error) { setErr('Could not save the PIN. Check the internet and try again.'); setStep('pin'); return }
    const salt = crypto.randomUUID()
    const me: StaffMember = { id: who!.id, name: who!.name, role: who!.role, salt, pinHash: await hashPin(pin, salt), failed: 0, locked: false }
    await db.staff.put(me)
    history.replaceState(null, '', location.pathname)
    await syncNow()
    await db.staff.update(me.id, { salt, pinHash: me.pinHash })
    onDone(me)
  }

  return (
    <div className="main enter"><div className="pad stack">
      <BrandMark />
      {step !== 'pin' ? <>
        <div className="note">You were invited to the {SHOP.name} shift app. Tap below to set up this phone. It only works once.</div>
        <button className="blk primary" onClick={join} disabled={step === 'busy'}>{step === 'busy' ? 'Please wait…' : 'Set up this phone'}</button>
      </> : <>
        <div className="note">Welcome, <b>{who?.name}</b> ({who?.role}). Choose a 4-number PIN. You type it every time you open the app.</div>
        <label className="lbl" htmlFor="j-pin">New PIN</label>
        <input id="j-pin" type="password" inputMode="numeric" maxLength={4} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} />
        <label className="lbl" htmlFor="j-pin2">Type it again</label>
        <input id="j-pin2" type="password" inputMode="numeric" maxLength={4} value={pin2} onChange={e => setPin2(e.target.value.replace(/\D/g, ''))} />
        <button className="blk primary" onClick={savePin}>Save PIN</button>
      </>}
      {err && <div className="bad" role="alert">{err}</div>}
    </div></div>
  )
}

export function Welcome({ onDemo }: { onDemo: () => void }) {
  return (
    <div className="main enter"><div className="pad stack">
      <BrandMark />
      {DEMO_ONLY ? <div className="note">This is a demo of the shift app: a till, stock count and shift report. Everything stays in this page.</div> : <>
        <div className="note">Open the <b>invite link</b> the manager sent you on WhatsApp. It sets up this phone for you.</div>
        <p className="muted small">No link? Ask the manager or the boss to send you one from the app (Menu → People).</p></>}
      <div className="block">
        <b>Just looking?</b>
        <span className="muted small">The demo has the shop's products and four people to sign in as. Nothing you do reaches the real shop.</span>
        <button className="blk" onClick={onDemo}>Try the demo</button>
      </div>
    </div></div>
  )
}
