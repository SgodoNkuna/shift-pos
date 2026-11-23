import { useEffect, useState } from 'react'
import { DEFAULT_REASONS, getMeta, setMeta } from '../../app/store'
import { formatRand, parseRand } from '../../domain/num'
import { supabase, deviceStaffId } from '../../sync/client'
import { syncNow } from '../../sync/engine'
import { Sheet, useToast } from '../kit'

/** Where each setting lives on the phone and on the server. */
export const SETTINGS = {
  floatCents: { key: 'float_cents', fallback: 0 },
  stockOutReasons: { key: 'stock_out_reasons', fallback: DEFAULT_REASONS },
  escalateMin: { key: 'escalate_after_min', fallback: 5 },
  remindMin: { key: 'remind_sender_after_min', fallback: 15 },
  alertMin: { key: 'alert_leads_after_min', fallback: 30 },
  multiSeller: { key: 'multi_seller', fallback: false },
} as const

type Values = { floatCents: number; stockOutReasons: string[]; escalateMin: number; remindMin: number; alertMin: number }

/** Boss only. Changes apply to every phone at the next sync. */
export function Settings({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const [v, setV] = useState<Values | null>(null)
  const [newReason, setNewReason] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { void (async () => setV({
    floatCents: await getMeta('floatCents', 0), stockOutReasons: await getMeta('stockOutReasons', DEFAULT_REASONS),
    escalateMin: await getMeta('escalateMin', 5), remindMin: await getMeta('remindMin', 15), alertMin: await getMeta('alertMin', 30),
  }))() }, [])
  if (!v) return null
  const minutes = (k: 'escalateMin' | 'remindMin' | 'alertMin', label: string) => (
    <div className="row" style={{ alignItems: 'center' }}>
      <label htmlFor={`set-${k}`}>{label}</label>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input id={`set-${k}`} className="cin" inputMode="numeric" value={v[k]} onChange={e => setV({ ...v, [k]: Math.max(1, Math.min(240, Number(e.target.value.replace(/\D/g, '')) || 1)) })} />min
      </span>
    </div>)
  const save = async () => {
    if (v.remindMin >= v.alertMin) return toast('The boss alert must come after the reminder')
    setBusy(true)
    try {
      const rows = (Object.keys(v) as (keyof Values)[]).map(k => ({ key: SETTINGS[k].key, value: v[k] }))
      if (supabase && await deviceStaffId()) {
        const { error } = await supabase.from('settings').upsert(rows)
        if (error) { toast('Could not save. Check the internet.'); return }
      }
      for (const k of Object.keys(v) as (keyof Values)[]) await setMeta(k, v[k])
      void syncNow(); toast('Settings saved'); onClose()
    } finally { setBusy(false) }
  }
  return (
    <Sheet title="Settings" onClose={onClose}>
      <div className="lbl">Cash float</div>
      <div className="row" style={{ alignItems: 'center' }}>
        <label htmlFor="set-float">Change left in the drawer at every handover</label>
        <input id="set-float" className="cin" style={{ width: 96 }} inputMode="decimal" defaultValue={v.floatCents / 100}
          onBlur={e => setV({ ...v, floatCents: parseRand(e.target.value) ?? 0 })} />
      </div>
      <div className="muted small">Now {formatRand(v.floatCents)}. A new float applies from the next shift.</div>

      <div className="lbl">Stock out reasons</div>
      <div className="chips">{v.stockOutReasons.map(r => (
        <button key={r} className="chip" aria-label={`Remove ${r}`} disabled={r === 'Other'}
          onClick={() => setV({ ...v, stockOutReasons: v.stockOutReasons.filter(x => x !== r) })}>{r}{r !== 'Other' && ' ✕'}</button>))}
      </div>
      <div className="two">
        <input aria-label="New reason" placeholder="Add a reason" value={newReason} onChange={e => setNewReason(e.target.value)} />
        <button className="blk sm" onClick={() => { const r = newReason.trim(); if (r && !v.stockOutReasons.includes(r)) setV({ ...v, stockOutReasons: [...v.stockOutReasons.filter(x => x !== 'Other'), r, 'Other'] }); setNewReason('') }}>Add</button>
      </div>

      <div className="lbl">Alerts</div>
      {minutes('escalateMin', 'Buzz the manager if stock out waits')}
      {minutes('remindMin', 'Remind the sender if the report is not sent')}
      {minutes('alertMin', 'Buzz manager and boss if still not sent')}

      <div className="lbl">Coming later</div>
      <div className="row" style={{ alignItems: 'center', opacity: .6 }}>
        <span>Several sellers in one shift</span><span className="pill">locked</span>
      </div>

      <button className="blk primary" disabled={busy} onClick={save}>Save settings</button>
    </Sheet>
  )
}
