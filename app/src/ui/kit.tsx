import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, actions } from '../app/store'
import { supabase } from '../sync/client'
import { SHOP } from '../app/brand'
import type { StaffMember } from '../data/db'
import { createPinGuard, MAX_TRIES } from '../auth/pin'
import type { ShiftData } from '../domain/types'
import { formatRand } from '../domain/num'

/* ---------- Toast ---------- */
const ToastCtx = createContext<(msg: string) => void>(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastHost({ children }: { children: ReactNode }) {
  const [t, setT] = useState<{ msg: string; k: number } | null>(null)
  useEffect(() => { if (!t) return; const id = setTimeout(() => setT(null), 2100); return () => clearTimeout(id) }, [t])
  return (
    <ToastCtx.Provider value={msg => setT({ msg, k: Date.now() })}>
      {children}
      {t && <div className="toast" key={t.k} role="status">{t.msg}</div>}
      <AlertDrop />
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
  return <div className="hdr"><div className="eyebrow">{SHOP.name}</div><h2>{title}</h2>{sub && <div className="muted small">{sub}</div>}</div>
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

/**
 * Checks a PIN. Your own PIN is checked on this phone (works offline).
 * Anyone else's is checked by the server, which locks it after 5 wrong tries.
 */
export async function verifyPin(m: StaffMember, pin: string): Promise<{ ok: boolean; msg?: string }> {
  const fresh = (await db.staff.get(m.id)) ?? m
  if (!fresh.pinHash) {
    if (!supabase) return { ok: false, msg: 'This person has no PIN on this phone.' }
    const { data, error } = await supabase.rpc('check_pin', { p_staff: m.id, p_pin: pin })
    if (error) return { ok: false, msg: 'Needs internet to check this PIN.' }
    if (data === 'ok') return { ok: true }
    if (data === 'locked') return { ok: false, msg: 'Locked after 5 wrong tries. Ask a manager to unlock it.' }
    if (data === 'no_pin') return { ok: false, msg: `${m.name} has not set up their phone yet.` }
    return { ok: false, msg: 'Wrong PIN.' }
  }
  const r = await guard.check(fresh, pin)
  await db.staff.put({ ...fresh, failed: r.user.failed, locked: r.user.locked })
  if (r.ok) return { ok: true }
  if (r.user.locked) return { ok: false, msg: 'Locked after 5 wrong tries. Ask a manager to reset it.' }
  return { ok: false, msg: `Wrong PIN. ${MAX_TRIES - r.user.failed} tries left.` }
}

export function PinPad({ people, onOk, prompt = 'Who is signing in?' }: { people: StaffMember[]; onOk: (m: StaffMember, pin: string) => void; prompt?: string }) {
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
      if (r.ok) { setMsg(null); onOk(who, next) } else setMsg(r.msg ?? 'Wrong PIN')
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

/** The shop's logo (or the plain wordmark in the demo build) for sign-in and welcome screens. */
export function BrandMark() {
  return SHOP.logo
    ? <div className="brandmark"><img src={SHOP.logo} alt={SHOP.name} width={104} height={104} /><span>{SHOP.markTop}</span></div>
    : <div className="mark"><span>{SHOP.markTop}</span>{SHOP.markMain}</div>
}

/* ---------- Who is on this shift ---------- */
const SELLER_COLORS = ['var(--accent)', 'var(--ok)', 'var(--wait)', 'var(--warn)']
export const saleCents = (s: { lines: { qty: number; unitCents: number }[] }) => Math.round(s.lines.reduce((a, l) => a + l.qty * l.unitCents, 0))
export const shiftPeople = (shift: { openedBy: string; helpers?: string[] }) => [shift.openedBy, ...(shift.helpers ?? []).filter(h => h !== shift.openedBy)]
export function sellerColor(shift: { openedBy: string; helpers?: string[] }, id: string): string {
  const i = shiftPeople(shift).indexOf(id)
  return SELLER_COLORS[(i < 0 ? 0 : i) % SELLER_COLORS.length]
}

/** One line showing everyone on the shift, what each has sold, and the shift total. Same on every phone. */
export function ShiftStrip({ data, meId, flush }: { data: ShiftData; meId?: string; flush?: boolean }) {
  const staff = useStaff()
  const people = shiftPeople(data.shift)
  const sold = (id: string) => data.sales.filter(s => !s.void && s.by === id).reduce((a, s) => a + saleCents(s), 0)
  const total = data.sales.filter(s => !s.void).reduce((a, s) => a + saleCents(s), 0)
  const full = (id: string) => staff.find(s => s.id === id)?.name ?? '?'
  const firsts = people.map(id => full(id).split(' ')[0])
  const [pops, setPops] = useState<{ id: string; cents: number; k: number }[]>([])
  const prev = useRef<Record<string, number> | null>(null)
  const sums = Object.fromEntries(people.map(id => [id, sold(id)]))
  const key = JSON.stringify(sums)
  useEffect(() => {
    const before = prev.current; prev.current = sums
    if (!before) return
    const fresh = people.filter(id => sums[id] > (before[id] ?? 0)).map(id => ({ id, cents: sums[id] - (before[id] ?? 0), k: Date.now() + Math.random() }))
    if (!fresh.length) return
    setPops(p => [...p, ...fresh])
    const t = setTimeout(() => setPops(p => p.filter(x => !fresh.includes(x))), 1800)
    return () => clearTimeout(t)
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const first = (id: string) => { const f = full(id).split(' ')[0]; return firsts.filter(x => x === f).length > 1 ? full(id) : f }
  return (
    <div className="strip" style={flush ? { margin: 0 } : undefined} aria-label="People on this shift">
      <div className="strip-top">
        <span className="lbl">{data.shift.kind === 'day' ? 'Day' : 'Night'} shift · {people.length > 1 ? `${people.length} people, one shift` : 'one person'}</span>
        <b className="num" key={total}>{formatRand(total)}</b>
      </div>
      <div className="strip-people">{people.map(id =>
        <span key={id} className={`seller${pops.some(p => p.id === id) ? ' hit' : ''}`} style={{ ['--c' as string]: sellerColor(data.shift, id) }}>
          {pops.filter(p => p.id === id).map(p => <em key={p.k} className="plus num" aria-hidden="true">+{formatRand(p.cents)}</em>)}
          <i />{first(id)}{id === meId ? ' (you)' : ''}{id === data.shift.openedBy && people.length > 1 ? ' · opened' : ''}
          <b className="num">{formatRand(sold(id))}</b>
        </span>)}
      </div>
    </div>)
}

/** Counts smoothly up or down to a rand amount (instant for people who turn off motion). */
export function CountUp({ cents }: { cents: number }) {
  const [shown, setShown] = useState(cents)
  const from = useRef(cents)
  useEffect(() => {
    const start = from.current, end = cents
    if (start === end || matchMedia('(prefers-reduced-motion: reduce)').matches) { from.current = end; setShown(end); return }
    let raf = 0; const t0 = performance.now()
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / 700), e = 1 - Math.pow(1 - k, 3)
      const v = Math.round(start + (end - start) * e); from.current = v; setShown(v)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [cents])
  return <>{formatRand(shown)}</>
}

/** An alert that arrives while the app is open slides down from the top with the logo. */
function AlertDrop() {
  const [a, setA] = useState<{ title: string; body: string; k: number } | null>(null)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const on = (e: MessageEvent) => { if (e.data?.type === 'alert') setA({ title: e.data.title, body: e.data.body, k: Date.now() }) }
    navigator.serviceWorker.addEventListener('message', on)
    return () => navigator.serviceWorker.removeEventListener('message', on)
  }, [])
  useEffect(() => { if (!a) return; const id = setTimeout(() => setA(null), 5000); return () => clearTimeout(id) }, [a])
  if (!a) return null
  return (
    <button className="drop" key={a.k} role="status" onClick={() => setA(null)}>
      <img src="/alert-192.png" alt="" width={36} height={36} />
      <span><b>{a.title}</b>{a.body && <span>{a.body}</span>}</span>
    </button>)
}
