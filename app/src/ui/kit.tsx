import { createContext, useContext, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, actions } from '../app/store'
import type { StaffMember } from '../data/db'
import { createPinGuard, MAX_TRIES } from '../auth/pin'
import type { ShiftData } from '../domain/types'

/* ---------- Toast ---------- */
const ToastCtx = createContext<(msg: string) => void>(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastHost({ children }: { children: ReactNode }) {
  const [t, setT] = useState<{ msg: string; k: number } | null>(null)
  return (
    <ToastCtx.Provider value={msg => setT({ msg, k: Date.now() })}>
      {children}
      {t && <div className="toast" key={t.k} role="status" onAnimationEnd={() => setT(null)}>{t.msg}</div>}
    </ToastCtx.Provider>
  )
}

/* ---------- Sheet ---------- */
export function Sheet({ title, onClose, children }: { title: ReactNode; onClose: () => void; children: ReactNode }) {
  return (
    <div className="sheet" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sheet-in" role="dialog" aria-modal="true">
        <div className="sh-h"><h3>{title}</h3><button className="x" onClick={onClose} aria-label="Close">✕</button></div>
        {children}
      </div>
    </div>
  )
}

export function Header({ title, sub }: { title: string; sub?: ReactNode }) {
  return <div className="hdr"><div className="eyebrow">Shift POS</div><h2>{title}</h2>{sub && <div className="muted small">{sub}</div>}</div>
}

/* ---------- Data hooks ---------- */
export function useShiftData(shiftId: string | null | undefined): ShiftData | undefined {
  return useLiveQuery(() => (shiftId ? actions.loadShiftData(shiftId) : undefined), [shiftId])
}
export function useStaff(): StaffMember[] {
  return useLiveQuery(() => db.staff.toArray(), [], [])
}

/* ---------- PIN pad ---------- */
const guard = createPinGuard()

/** Checks a PIN for one person and records wrong tries. Five wrong tries lock the account. */
export async function verifyPin(m: StaffMember, pin: string): Promise<{ ok: boolean; msg?: string }> {
  const fresh = (await db.staff.get(m.id)) ?? m
  const r = await guard.check(fresh, pin)
  await db.staff.put({ ...fresh, failed: r.user.failed, locked: r.user.locked })
  if (r.ok) return { ok: true }
  if (r.user.locked) return { ok: false, msg: 'Locked after 5 wrong tries. Ask a manager to reset it.' }
  return { ok: false, msg: `Wrong PIN. ${MAX_TRIES - r.user.failed} tries left.` }
}

export function PinPad({ people, onOk, prompt = 'Who is signing in?' }: { people: StaffMember[]; onOk: (m: StaffMember) => void; prompt?: string }) {
  const [who, setWho] = useState<StaffMember | null>(people.length === 1 ? people[0] : null)
  const [pin, setPin] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const press = async (d: string) => {
    if (!who) return
    const next = (pin + d).slice(0, 4)
    setPin(next)
    if (next.length === 4) {
      const r = await verifyPin(who, next)
      setPin('')
      if (r.ok) { setMsg(null); onOk(who) } else setMsg(r.msg ?? 'Wrong PIN')
    }
  }
  return (
    <div className="stack" style={{ alignItems: 'center', width: '100%' }}>
      {people.length > 1 && <>
        <p className="muted" style={{ margin: 0 }}>{prompt}</p>
        <div className="who">{people.map(p => (
          <button key={p.id} className={`blk ${who?.id === p.id ? 'on' : ''}`} onClick={() => { setWho(p); setPin(''); setMsg(null) }} disabled={p.locked}>
            {p.name}{p.locked ? ' · locked' : ''}
          </button>))}
        </div></>}
      {who && <>
        {people.length === 1 && <p className="muted" style={{ margin: 0 }}>{who.name}, enter your PIN</p>}
        <div className="dots" aria-label={`${pin.length} of 4 digits`}>{[0, 1, 2, 3].map(i => <i key={i} className={i < pin.length ? 'f' : ''} />)}</div>
        {msg && <div className="bad small" role="alert">{msg}</div>}
        <div className="keys">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) => k === '' ? <span key={i} /> :
            <button key={i} className="key" aria-label={k === '⌫' ? 'Delete' : k}
              onClick={() => k === '⌫' ? setPin(pin.slice(0, -1)) : press(k)}>{k}</button>)}
        </div></>}
    </div>
  )
}

export const CATEGORY_LABELS: Record<string, string> = { main: 'Main', drinks: 'Drinks', rolling: 'Rolling' }
export const catLabel = (id: string) => CATEGORY_LABELS[id] ?? id.charAt(0).toUpperCase() + id.slice(1)
