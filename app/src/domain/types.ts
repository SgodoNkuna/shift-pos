export type Unit = 'ea' | 'g'
export type Role = 'employee' | 'manager' | 'boss'

export interface Product {
  id: string
  name: string
  categoryId: string
  unit: Unit
  step: number
  lowAt: number
  /** Current selling price in cents */
  priceCents: number
  active: boolean
  /** Position on the till and in reports (paper-sheet order). */
  sort?: number
  /** false = a service like hubbly hire: sold on the till but no stock to count. */
  track?: boolean
  /** Most that may be on display (e.g. the edibles jar holds 50). Extra stock stays in storage. */
  maxQty?: number | null
}

export interface SaleLine { productId: string; qty: number; unitCents: number }
export interface Payment { method: 'cash' | 'card'; cents: number }

export interface Sale {
  id: string
  shiftId: string
  at: string
  by: string
  lines: SaleLine[]
  payments: Payment[]
  void?: { by: string; reason: string; at: string }
}

export type MoveStatus = 'done' | 'pending' | 'approved' | 'rejected'

export interface StockMove {
  id: string
  shiftId: string
  productId: string
  qty: number
  kind: 'in' | 'out'
  status: MoveStatus
  reason?: string
  by: string
  at: string
  decidedBy?: string
  decidedAt?: string
  escalatedAt?: string
}

export interface Expense { id: string; shiftId: string; cents: number; note: string; by: string; at: string }

export interface Shift {
  id: string
  kind: 'day' | 'night'
  date: string
  openedBy: string
  /** Others working the same shift (joined from their own phone). */
  helpers?: string[]
  openedAt: string
  opening: Record<string, number>
  /** Opening counts changed at clock in: what the last shift handed over, what was really there, and who changed it. */
  openingChanges?: Record<string, { from: number; to: number; by: string }>
  floatCents: number
  counts?: Record<string, number>
  cashCountedCents?: number
  cardSlipCents?: number
  pinOutBy?: string
  pinInBy?: string
  lockedAt?: string
  sentAt?: string
}

export interface ShiftData {
  shift: Shift
  products: Product[]
  sales: Sale[]
  moves: StockMove[]
  expenses: Expense[]
}
