import Dexie, { type Table } from 'dexie'
import type { Expense, Product, Role, Sale, Shift, StockMove } from '../domain/types'

export type SyncTable = 'shifts' | 'sales' | 'moves' | 'expenses' | 'products'

/** One change waiting to go to the server. `id` is the row id, so a resend is an upsert, never a duplicate. */
export interface OutboxEntry { seq?: number; id: string; table: SyncTable; op: 'upsert'; row: unknown; tries: number; at: string }
export interface StaffMember {
  id: string
  name: string
  role: Role
  salt: string
  pinHash: string
  failed: number
  locked: boolean
  phone?: string
}
export interface MetaRow { key: string; value: unknown }
export interface AuditEntry { seq?: number; at: string; by: string; action: string; ref: string; detail?: unknown }

export class ShiftDB extends Dexie {
  products!: Table<Product, string>
  shifts!: Table<Shift, string>
  sales!: Table<Sale, string>
  moves!: Table<StockMove, string>
  expenses!: Table<Expense, string>
  outbox!: Table<OutboxEntry, number>
  audit!: Table<AuditEntry, number>
  staff!: Table<StaffMember, string>
  meta!: Table<MetaRow, string>

  constructor(name = 'shiftpos') {
    super(name)
    this.version(1).stores({
      products: 'id, categoryId',
      shifts: 'id, date, lockedAt',
      sales: 'id, shiftId',
      moves: 'id, shiftId, status',
      expenses: 'id, shiftId',
      outbox: '++seq',
      audit: '++seq, ref',
    })
    this.version(2).stores({ staff: 'id, role', meta: 'key' })
  }
}
