import { useState } from 'react'
import { actions } from '../../app/store'
import type { StaffMember } from '../../data/db'
import { displayName, itemLines, shiftFlags, shiftTotals } from '../../domain/calc'
import { formatQty, formatRand } from '../../domain/num'
import type { ShiftData } from '../../domain/types'
import { shareFiles } from '../../report/share'
import { shareText } from '../../report/summary'
import { reportFileName } from '../../report/names'
import { catLabel, Header, useStaff, useToast } from '../kit'

export function Report({ data, me, onDone }: { data: ShiftData; me: StaffMember; onDone: () => void }) {
  const toast = useToast()
  const staff = useStaff()
  const [busy, setBusy] = useState(false)
  const names = Object.fromEntries(staff.map(s => [s.id, s.name]))
  const t = shiftTotals(data)
  const lines = itemLines(data)
  const flags = shiftFlags(data, names)
  const s = data.shift
  const share = async () => {
    setBusy(true)
    try {
      const [{ buildPdf }, { buildXlsx }] = await Promise.all([import('../../report/pdf'), import('../../report/xlsx')])
      const pdf = new File([buildPdf(data, names)], reportFileName(data, 'pdf'), { type: 'application/pdf' })
      const xlsx = new File([await buildXlsx(data, names)], reportFileName(data, 'xlsx'), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const r = await shareFiles([pdf, xlsx], shareText(data, me.name, names))
      if (r === 'shared') { await actions.markSent(s.id, me.id); toast('Sent') }
      if (r === 'saved') { toast('Saved. Send both files in the WhatsApp group.'); await actions.markSent(s.id, me.id) }
    } catch { toast('Could not share. Try again.') } finally { setBusy(false) }
  }
  const cats = [...new Set(data.products.map(p => p.categoryId))]
  return (
    <div className="main enter">
      <Header title="Shift report" sub={s.lockedAt ? 'Locked. Nobody can change these numbers now.' : 'Not locked yet'} />
      <div className="pad stack">
        {s.sentAt ? <div className="banner okb2">Sent · {reportFileName(data, 'pdf')} + {reportFileName(data, 'xlsx')}</div>
          : <div className="banner warnb">Not sent yet. Send it to the Boss + Manager WhatsApp group now.</div>}
        <div className="paper">
          <div className="ph"><div><h4>{s.kind === 'day' ? 'Day' : 'Night'} shift · {s.date}</h4>
            <div>{names[s.openedBy]} → {names[s.pinInBy ?? ''] ?? '—'}</div></div>
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
        <button className="blk primary" disabled={busy || !s.lockedAt} onClick={share}>{busy ? 'Making files…' : s.sentAt ? 'Send again' : 'Send to WhatsApp'}</button>
        <button className="blk ghost" onClick={onDone}>{me.role === 'employee' ? 'Done · sign out' : 'Done'}</button>
      </div>
    </div>
  )
}
