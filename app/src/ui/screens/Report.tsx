import { useEffect, useRef, useState } from 'react'
import { actions } from '../../app/store'
import type { StaffMember } from '../../data/db'
import { displayName, itemLines, profit, shiftFlags, shiftTotals } from '../../domain/calc'
import { useLiveQuery } from 'dexie-react-hooks'
import { getMeta } from '../../app/store'
import { formatQty, formatRand } from '../../domain/num'
import type { ShiftData } from '../../domain/types'
import { downloadFiles, shareFiles } from '../../report/share'
import { shareText } from '../../report/summary'
import { reportFileName } from '../../report/names'
import { catLabel, Header, useStaff, useToast } from '../kit'
import { SHOP } from '../../app/brand'
import { supabase } from '../../sync/client'

export function Report({ data, me, onDone, autoSend = false }: { data: ShiftData; me: StaffMember; onDone: () => void; autoSend?: boolean }) {
  const toast = useToast()
  const staff = useStaff()
  const [busy, setBusy] = useState(false)
  const names = Object.fromEntries(staff.map(s => [s.id, s.name]))
  const t = shiftTotals(data)
  const lines = itemLines(data)
  const flags = shiftFlags(data, names)
  const s = data.shift
  // Make the files as soon as the report opens: a phone only opens the share sheet right after a tap,
  // so the tap must not wait for the PDF to be built.
  const [files, setFiles] = useState<File[] | null>(null)
  const [fallback, setFallback] = useState(false)
  // Links to the files kept online: work on every phone, even where saving or sharing files is blocked.
  const [links, setLinks] = useState<null | 'busy' | 'failed' | { pdf: string; xlsx: string }>(null)
  const makeLinks = async () => {
    if (!files || !supabase) return setLinks('failed')
    setLinks('busy')
    try {
      const urls: string[] = []
      for (const f of files) {
        const path = `${s.id}/${f.name}`
        const up = await supabase.storage.from('reports').upload(path, f, { upsert: true, contentType: f.type })
        if (up.error) throw up.error
        const sig = await supabase.storage.from('reports').createSignedUrl(path, 60 * 60 * 24 * 30, { download: f.name })
        if (sig.error || !sig.data) throw sig.error
        urls.push(sig.data.signedUrl)
      }
      setLinks({ pdf: urls[0], xlsx: urls[1] })
    } catch { setLinks('failed'); toast('Could not make the links. Check the internet.') }
  }
  const made = useRef<string | null>(null)
  useEffect(() => {
    const key = `${s.id}:${s.lockedAt}:${staff.length}`
    if (!s.lockedAt || !staff.length || made.current === key) return
    made.current = key
    void (async () => {
      try {
        const [{ buildPdf }, { buildXlsx }] = await Promise.all([import('../../report/pdf'), import('../../report/xlsx')])
        const logo = SHOP.logo ? await fetch(SHOP.logo).then(r => r.blob()).then(b => new Promise<string>(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result as string); fr.readAsDataURL(b) })).catch(() => undefined) : undefined
        const pdf = new File([buildPdf(data, names, logo)], reportFileName(data, 'pdf'), { type: 'application/pdf' })
        const xlsx = new File([await buildXlsx(data, names)], reportFileName(data, 'xlsx'), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        setFiles([pdf, xlsx])
      } catch { made.current = null; toast('Could not make the report files. Close the report and open it again.') }
    })()
  })
  const text = shareText(data, me.name, names)
  const share = async () => {
    if (!files) return toast('Still making the files. Tap again in a second.')
    setBusy(true)
    try {
      const r = await shareFiles(files, text)
      if (r === 'shared') { await actions.markSent(s.id, me.id); toast('Sent') }
      else if (r === 'saved') { setFallback(true); toast('Files saved to Downloads'); await actions.markSent(s.id, me.id) }
      else if (r === 'blocked') { setFallback(true); toast('The phone blocked sharing. Use the steps below.') }
    } catch { setFallback(true); toast('Could not share. Use the steps below.') } finally { setBusy(false) }
  }
  const saveFiles = async () => { if (files) { downloadFiles(files); toast('Files saved to Downloads'); await actions.markSent(s.id, me.id) } }
  const cats = [...new Set(data.products.map(p => p.categoryId))]
  const costs: Record<string, number> = useLiveQuery(() => getMeta<Record<string, number>>('costs', {}), [], {})
  const pr = me.role === 'boss' ? profit(data, costs) : null
  const pname = (id: string) => { const p = data.products.find(x => x.id === id); return p ? displayName(p, data.products) : id }
  return (
    <div className="main enter">
      <Header title="Shift report" sub={s.lockedAt ? 'Locked. Nobody can change these numbers now.' : 'Not locked yet'} />
      <div className="pad stack">
        {s.sentAt ? <div className="banner okb2">Sent · {reportFileName(data, 'pdf')} + {reportFileName(data, 'xlsx')}</div>
          : <div className="banner warnb">Not sent yet. Send it to the Boss + Manager WhatsApp group now.</div>}
        <div className="paper">
          <div className="small" style={{ marginBottom: 4 }}>{SHOP.name} · {SHOP.address}</div>
          <div className="ph"><div><h4>{s.kind === 'day' ? 'Day' : 'Night'} shift · {s.date}</h4>
            <div>{[s.openedBy, ...(s.helpers ?? [])].map(id => names[id] ?? '?').join(' + ')} → {names[s.pinInBy ?? ''] ?? '—'}</div></div>
            <div style={{ textAlign: 'right' }}>{s.lockedAt ? 'LOCKED' : 'OPEN'}<br />{s.sentAt ? 'SENT' : 'NOT SENT'}</div></div>
          <div className="scrollx"><table className="ptable">
            <thead><tr>{['Product', 'Price', 'Open', 'In', 'Out', 'Close', 'Sold', 'Sales R', 'Stock R', 'Diff'].map(h => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{cats.map(c => [
              <tr className="pc" key={c}><td colSpan={10}>{catLabel(c)}</td></tr>,
              ...data.products.filter(p => p.categoryId === c).map(p => { const l = lines.find(x => x.productId === p.id)!
                const q = (v: number) => (v ? formatQty(p, v) : '')
                return <tr key={p.id}><td>{displayName(p, data.products)}</td><td>{p.priceCents / 100}</td><td>{q(l.open)}</td><td>{q(l.stockIn)}</td>
                  <td>{q(l.out)}</td><td>{formatQty(p, l.counted ?? l.expected)}</td><td>{q(l.sold)}</td><td>{l.salesCents ? l.salesCents / 100 : ''}</td>
                  <td>{l.stockValueCents / 100}</td><td className={l.diff ? 'flagc' : ''}>{l.diff || ''}</td></tr> })])}</tbody>
          </table></div>
          <div className="pblock">
            <span>Total sales</span><b>{formatRand(t.salesCents)}</b>
            <span>Card sales (slip {s.cardSlipCents != null ? formatRand(s.cardSlipCents) : '—'})</span><b>{formatRand(t.cardCents)}</b>
            <span>Cash sales</span><b>{formatRand(t.cashCents)}</b>
            <span>Expenses</span><b>{formatRand(t.expensesCents)}</b>
            <span>Float</span><b>{formatRand(s.floatCents)}</b>
            <span>Expected / counted cash</span><b>{formatRand(t.expectedCashCents)} / {s.cashCountedCents != null ? formatRand(s.cashCountedCents) : '—'}</b>
          </div>
          <div className="pflags"><b>FLAGS</b><ul>{flags.map((f, i) => <li key={i} className={f.level === 'bad' ? 'fbad' : f.level === 'ok' ? 'fok' : ''}>{f.text}</li>)}</ul></div>
        </div>
        {pr && <div className="block">
          <div className="lbl">Profit · only you see this · not sent to WhatsApp</div>
          {pr.lines.length ? <table className="ctable"><thead><tr><th>Item</th><th className="r">Sales</th><th className="r">Cost</th><th className="r">Profit</th></tr></thead>
            <tbody>{pr.lines.map(l => <tr key={l.productId}><td>{pname(l.productId)}</td><td className="num">{formatRand(l.salesCents)}</td>
              <td className="num">{l.costCents == null ? '—' : formatRand(l.costCents)}</td><td className="num ok">{l.profitCents == null ? '—' : formatRand(l.profitCents)}</td></tr>)}
              <tr><td><b>Total</b></td><td className="num"><b>{formatRand(pr.salesCents)}</b></td><td className="num">{formatRand(pr.costCents)}</td><td className="num ok"><b>{formatRand(pr.profitCents)}</b></td></tr>
            </tbody></table> : <span className="muted small">Nothing sold yet.</span>}
          {pr.missing.length > 0 && <span className="warn small">No cost price yet for {pr.missing.map(pname).join(', ')}. Add it in Menu → Products &amp; prices.</span>}
        </div>}
        {autoSend && !s.sentAt && files && <div className="note">Report ready. Tap <b>Send to WhatsApp</b>.</div>}
        <button className="blk primary" disabled={busy || !s.lockedAt} onClick={share}>{!files && s.lockedAt ? 'Making files…' : busy ? 'Opening…' : s.sentAt ? 'Send again' : 'Send to WhatsApp'}</button>
        {!fallback && s.lockedAt && <button className="linkbtn" style={{ alignSelf: 'center' }} onClick={() => setFallback(true)}>Problems sending? Send a link instead</button>}
        {fallback && <div className="banner warnb"><b>Send it another way</b>
          <span>Send links to the report instead of the files. The links work for 30 days.</span>
          {links && typeof links === 'object'
            ? <a className="blk sm primary" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }} target="_blank" rel="noreferrer"
                onClick={() => void actions.markSent(s.id, me.id)}
                href={`https://wa.me/?text=${encodeURIComponent(`${text}\nReport (PDF): ${links.pdf}\nSpreadsheet: ${links.xlsx}`)}`}>Open WhatsApp with the links</a>
            : <button className="blk sm primary" disabled={!files || links === 'busy'} onClick={makeLinks}>{links === 'busy' ? 'Making links…' : 'Make links to the report'}</button>}
          <span className="muted small">Or save the files to this phone and attach them in WhatsApp:</span>
          <button className="blk sm" disabled={!files} onClick={saveFiles}>Save PDF + spreadsheet</button></div>}
        <button className="blk ghost" onClick={onDone}>{me.role === 'employee' ? 'Done · sign out' : 'Done'}</button>
      </div>
    </div>
  )
}
