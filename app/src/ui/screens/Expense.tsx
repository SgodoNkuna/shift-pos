import { useState } from 'react'
import { actions } from '../../app/store'
import type { StaffMember } from '../../data/db'
import { formatRand, parseRand } from '../../domain/num'
import type { ShiftData } from '../../domain/types'
import { Header, useToast } from '../kit'

export function Expense({ data, me }: { data: ShiftData; me: StaffMember }) {
  const toast = useToast()
  const [cents, setCents] = useState<number | null>(null)
  const [typed, setTyped] = useState('')
  const [note, setNote] = useState('')
  const save = async () => {
    await actions.addExpense(data.shift.id, me.id, cents!, note)
    toast('Expense noted'); setCents(null); setTyped(''); setNote('')
  }
  return (
    <div className="main enter">
      <Header title="Expense" sub="Money taken from the till for the shop. Just write it down." />
      <div className="pad stack">
        <div className="lbl">Amount</div>
        <div className="chips">{[1000, 2000, 5000, 10000].map(v =>
          <button key={v} className={`chip ${cents === v && !typed ? 'on' : ''}`} onClick={() => { setCents(v); setTyped('') }}>{formatRand(v)}</button>)}</div>
        <input aria-label="Other amount" inputMode="decimal" placeholder="Other amount (R)" value={typed} onChange={e => { setTyped(e.target.value); setCents(parseRand(e.target.value)) }} />
        <label className="lbl" htmlFor="ex-note">What was it for?</label>
        <input id="ex-note" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. cleaning supplies" />
        <button className="blk primary" disabled={!cents || cents <= 0} onClick={save}>Save expense</button>
        {data.expenses.length > 0 && <div className="grp"><div className="gl">This shift</div>
          {data.expenses.map(e => <div className="row" key={e.id}><span>{e.note}</span><b className="num">{formatRand(e.cents)}</b></div>)}</div>}
      </div>
    </div>
  )
}
