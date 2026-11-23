import type { ShiftData } from '../domain/types'

export const reportFileName = (d: ShiftData, ext: 'pdf' | 'xlsx') =>
  `${d.shift.kind === 'day' ? 'Day' : 'Night'}-${d.shift.date}.${ext}`
