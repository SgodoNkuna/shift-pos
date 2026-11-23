import { canLock, itemLines, type LockReason } from '../domain/calc'
import { roundQty, shiftFor } from '../domain/num'
import { sortProducts } from '../domain/order'
import type { Expense, Payment, Sale, Shift, ShiftData, StockMove } from '../domain/types'
import type { ShiftDB, SyncTable } from './db'

export class LockError extends Error {
  reasons: LockReason[]
  constructor(reasons: LockReason[]) { super(`Cannot lock: ${reasons.join(', ')}`); this.reasons = reasons }
}
export class ShiftLockedError extends Error { constructor() { super('This shift is locked') } }
export class PaymentError extends Error { constructor(msg: string) { super(msg) } }
export class NotFoundError extends Error { constructor(what: string) { super(`${what} not found`) } }

export interface ActionDeps { now?: () => Date; uuid?: () => string }

export function createActions(db: ShiftDB, deps: ActionDeps = {}) {
  const now = deps.now ?? (() => new Date())
  const uuid = deps.uuid ?? (() => crypto.randomUUID())
  const iso = () => now().toISOString()
  const all = [db.shifts, db.sales, db.moves, db.expenses, db.outbox, db.audit, db.products]

  /** Writes a row, its outbox entry and an audit line in one transaction. */
  async function save<T extends { id: string }>(table: SyncTable, row: T, by: string, action: string, detail?: unknown): Promise<T> {
    await db.transaction('rw', all, async () => {
      await (db[table] as unknown as { put: (r: T) => Promise<unknown> }).put(row)
      await db.outbox.add({ id: row.id, table, op: 'upsert', row, tries: 0, at: iso() })
      await db.audit.add({ at: iso(), by, action, ref: row.id, detail })
    })
    return row
  }

  async function getShift(id: string): Promise<Shift> {
    const s = await db.shifts.get(id)
    if (!s) throw new NotFoundError('Shift')
    return s
  }
  async function openShiftOnly(id: string): Promise<Shift> {
    const s = await getShift(id)
    if (s.lockedAt) throw new ShiftLockedError()
    return s
  }

  async function loadShiftData(shiftId: string): Promise<ShiftData> {
    const [shift, products, sales, moves, expenses] = await Promise.all([
      getShift(shiftId), db.products.toArray().then(sortProducts),
      db.sales.where('shiftId').equals(shiftId).toArray(),
      db.moves.where('shiftId').equals(shiftId).toArray(),
      db.expenses.where('shiftId').equals(shiftId).toArray(),
    ])
    return { shift, products, sales, moves, expenses }
  }

  async function lastLockedShift(): Promise<Shift | undefined> {
    const locked = (await db.shifts.toArray()).filter(s => s.lockedAt)
    return locked.sort((a, b) => a.lockedAt!.localeCompare(b.lockedAt!)).at(-1)
  }

  return {
    loadShiftData,

    /** Opening stock = last locked shift's counted close (or expected where not counted), else `opening`. */
    async openShift(o: { by: string; floatCents: number; opening?: Record<string, number>; corrections?: Record<string, number> }): Promise<Shift> {
      const prev = await lastLockedShift()
      let opening = o.opening ?? {}
      if (prev) {
        opening = {}
        for (const l of itemLines(await loadShiftData(prev.id))) opening[l.productId] = l.counted ?? l.expected
      }
      const openingChanges: NonNullable<Shift['openingChanges']> = {}
      for (const [id, to] of Object.entries(o.corrections ?? {})) {
        const from = opening[id] ?? 0
        if (roundQty(to) !== roundQty(from)) { openingChanges[id] = { from, to: roundQty(to), by: o.by }; opening = { ...opening, [id]: roundQty(to) } }
      }
      const { kind, date } = shiftFor(now())
      const s: Shift = { id: uuid(), kind, date, openedBy: o.by, openedAt: iso(), opening, floatCents: o.floatCents,
        ...(Object.keys(openingChanges).length ? { openingChanges } : {}) }
      return save('shifts', s, o.by, 'open_shift')
    },

    async recordSale(shiftId: string, by: string, lines: { productId: string; qty: number }[], payments: Payment[]): Promise<Sale> {
      await openShiftOnly(shiftId)
      if (!lines.length) throw new PaymentError('A sale needs at least one item')
      const priced = await Promise.all(lines.map(async l => {
        const p = await db.products.get(l.productId)
        if (!p) throw new NotFoundError(`Product ${l.productId}`)
        return { productId: l.productId, qty: roundQty(l.qty), unitCents: p.priceCents }
      }))
      const total = Math.round(priced.reduce((a, l) => a + l.qty * l.unitCents, 0))
      const paid = payments.reduce((a, p) => a + p.cents, 0)
      if (paid !== total) throw new PaymentError(`Payments R${paid / 100} do not match total R${total / 100}`)
      const sale: Sale = { id: uuid(), shiftId, at: iso(), by, lines: priced, payments: payments.filter(p => p.cents > 0) }
      return save('sales', sale, by, 'sale', { total })
    },

    async voidSale(saleId: string, by: string, reason: string): Promise<Sale> {
      const sale = await db.sales.get(saleId)
      if (!sale) throw new NotFoundError('Sale')
      await openShiftOnly(sale.shiftId)
      return save('sales', { ...sale, void: { by, reason, at: iso() } }, by, 'void_sale', { reason })
    },

    async addStockIn(shiftId: string, by: string, productId: string, qty: number): Promise<StockMove> {
      await openShiftOnly(shiftId)
      return save('moves', { id: uuid(), shiftId, productId, qty: roundQty(qty), kind: 'in', status: 'done', by, at: iso() } as StockMove, by, 'stock_in')
    },

    async requestOut(shiftId: string, by: string, productId: string, qty: number, reason: string): Promise<StockMove> {
      await openShiftOnly(shiftId)
      return save('moves', { id: uuid(), shiftId, productId, qty: roundQty(qty), kind: 'out', status: 'pending', reason, by, at: iso() } as StockMove, by, 'stock_out_request')
    },

    async decideOut(moveId: string, approve: boolean, by: string): Promise<StockMove> {
      const m = await db.moves.get(moveId)
      if (!m) throw new NotFoundError('Stock out')
      if (m.status !== 'pending') return m
      return save('moves', { ...m, status: approve ? 'approved' : 'rejected', decidedBy: by, decidedAt: iso() }, by, approve ? 'stock_out_approve' : 'stock_out_reject')
    },

    async addExpense(shiftId: string, by: string, cents: number, note: string): Promise<Expense> {
      await openShiftOnly(shiftId)
      return save('expenses', { id: uuid(), shiftId, cents, note: note.trim() || 'No note', by, at: iso() }, by, 'expense')
    },

    async setCount(shiftId: string, productId: string, qty: number | null, by = 'unknown'): Promise<Shift> {
      const s = await openShiftOnly(shiftId)
      const counts = { ...(s.counts ?? {}) }
      if (qty == null) delete counts[productId]; else counts[productId] = roundQty(qty)
      return save('shifts', { ...s, counts }, by, 'count', { productId, qty })
    },

    async setCash(shiftId: string, cents: number | null, by = 'unknown'): Promise<Shift> {
      const s = await openShiftOnly(shiftId)
      return save('shifts', { ...s, cashCountedCents: cents ?? undefined }, by, 'cash_count', { cents })
    },

    async setCardSlip(shiftId: string, cents: number | null, by = 'unknown'): Promise<Shift> {
      const s = await openShiftOnly(shiftId)
      return save('shifts', { ...s, cardSlipCents: cents ?? undefined }, by, 'card_slip', { cents })
    },

    async confirmPin(shiftId: string, side: 'out' | 'in', userId: string): Promise<Shift> {
      const s = await openShiftOnly(shiftId)
      return save('shifts', { ...s, [side === 'out' ? 'pinOutBy' : 'pinInBy']: userId }, userId, `pin_${side}`)
    },

    async lockShift(shiftId: string, by = 'unknown'): Promise<Shift> {
      const d = await loadShiftData(shiftId)
      if (d.shift.lockedAt) throw new ShiftLockedError()
      const r = canLock(d)
      if (!r.ok) throw new LockError(r.reasons)
      return save('shifts', { ...d.shift, lockedAt: iso() }, by, 'lock')
    },

    async markSent(shiftId: string, by = 'unknown'): Promise<Shift> {
      const s = await getShift(shiftId)
      return save('shifts', { ...s, sentAt: iso() }, by, 'sent')
    },
  }
}

export type Actions = ReturnType<typeof createActions>
