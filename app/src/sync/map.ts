import type { OutboxEntry, SyncTable } from '../data/db'

type Row = Record<string, unknown>
/** [phone field, server column] per table. */
const FIELDS: Record<SyncTable, [string, string][]> = {
  shifts: [['id', 'id'], ['kind', 'kind'], ['date', 'date'], ['openedBy', 'opened_by'], ['openedAt', 'opened_at'], ['opening', 'opening'], ['openingChanges', 'opening_changes'],
    ['floatCents', 'float_cents'], ['counts', 'counts'], ['cashCountedCents', 'cash_counted_cents'], ['cardSlipCents', 'card_slip_cents'],
    ['pinOutBy', 'pin_out_by'], ['pinInBy', 'pin_in_by'], ['lockedAt', 'locked_at'], ['sentAt', 'sent_at'], ['helpers', 'helpers']],
  sales: [['id', 'id'], ['shiftId', 'shift_id'], ['at', 'at'], ['by', 'by_staff'], ['lines', 'lines'], ['payments', 'payments'], ['void', 'void']],
  moves: [['id', 'id'], ['shiftId', 'shift_id'], ['productId', 'product_id'], ['qty', 'qty'], ['kind', 'kind'], ['status', 'status'], ['reason', 'reason'],
    ['by', 'by_staff'], ['at', 'at'], ['decidedBy', 'decided_by'], ['decidedAt', 'decided_at'], ['escalatedAt', 'escalated_at']],
  expenses: [['id', 'id'], ['shiftId', 'shift_id'], ['cents', 'cents'], ['note', 'note'], ['by', 'by_staff'], ['at', 'at']],
  products: [['id', 'id'], ['name', 'name'], ['categoryId', 'category_id'], ['unit', 'unit'], ['step', 'step'], ['lowAt', 'low_at'],
    ['priceCents', 'price_cents'], ['active', 'active'], ['sort', 'sort']],
}
const NUMERIC = new Set(['qty', 'step', 'low_at'])

export function toRow(table: SyncTable, obj: unknown): Row {
  const o = obj as Row
  const r: Row = {}
  for (const [f, c] of FIELDS[table]) r[c] = o[f] === undefined ? null : o[f]
  // Helpers are only changed on the server (join_open_shift), never sent from a phone.
  if (table === 'shifts') { r.counts ??= {}; r.opening ??= {}; delete r.helpers }
  return r
}

export function fromRow<T = Row>(table: SyncTable, row: Row): T {
  const o: Row = {}
  for (const [f, c] of FIELDS[table]) {
    const v = row[c]
    if (v === null || v === undefined) continue
    o[f] = NUMERIC.has(c) ? Number(v) : v
  }
  return o as T
}

export type SendPlan =
  | { how: 'insert_ignore'; table: SyncTable; row: Row }
  | { how: 'update'; table: SyncTable; id: string; patch: Row }
  | { how: 'update_or_insert'; table: SyncTable; id: string; row: Row }
  | { how: 'upsert'; table: SyncTable; row: Row }

/** How each change goes to the server so that resends are harmless and each role's rules are respected. */
export function planSend(e: OutboxEntry): SendPlan {
  const row = toRow(e.table, e.row)
  const id = row.id as string
  switch (e.table) {
    case 'sales': return row.void ? { how: 'update', table: 'sales', id, patch: { void: row.void } } : { how: 'insert_ignore', table: 'sales', row }
    case 'moves': return row.status === 'approved' || row.status === 'rejected'
      ? { how: 'update', table: 'moves', id, patch: { status: row.status, decided_by: row.decided_by, decided_at: row.decided_at } }
      : { how: 'insert_ignore', table: 'moves', row }
    case 'expenses': return { how: 'insert_ignore', table: 'expenses', row }
    case 'shifts': return { how: 'update_or_insert', table: 'shifts', id, row }
    case 'products': return { how: 'upsert', table: 'products', row }
  }
}

/** A refusal from the database will never succeed on retry; network trouble might. */
export const isPermanent = (err: { code?: string; message?: string }) => /^(42|P0|23|22)/.test(err.code ?? '')
