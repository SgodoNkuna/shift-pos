import { describe, expect, it } from 'vitest'
import { certMatches, certNumber, sealCode } from './names'
import { shiftFlags } from '../domain/calc'
import type { ShiftData } from '../domain/types'

const d = (over: Partial<ShiftData['shift']> = {}): ShiftData => ({
  shift: { id: '7f3a9c12-0000-4000-8000-000000000000', kind: 'night', date: '2026-11-26', openedBy: 'a', openedAt: '2026-11-26T18:00:00Z', opening: {}, floatCents: 0,
    lockedAt: '2026-11-27T06:00:00Z', cashCountedCents: 500, cardSlipCents: 0, pinOutBy: 'a', pinInBy: 'b', counts: { x: 1 }, ...over },
  products: [], sales: [], moves: [], expenses: [],
})

describe('certificate', () => {
  it('reads as shop, date, Day/Night and the shift id', () => expect(certNumber(d().shift)).toBe('HCL-261126-N-7F3A9C'))
  it('is found whether typed with or without dashes', () => {
    expect(certMatches('hcl 261126 n 7f3a9c', d().shift)).toBe(true)
    expect(certMatches('7F3A9C', d().shift)).toBe(true)
    expect(certMatches('7F3A9D', d().shift)).toBe(false)
  })
  it('seal changes when a locked number changes', () => {
    expect(sealCode(d())).toMatch(/^[0-9A-F]{4}$/)
    expect(sealCode(d())).toBe(sealCode(d()))
    expect(sealCode(d({ cashCountedCents: 600 }))).not.toBe(sealCode(d()))
    expect(sealCode(d({ counts: { x: 2 } }))).not.toBe(sealCode(d()))
  })
})

describe('double shift', () => {
  it('is flagged when the same person closes and stays on', () => {
    expect(shiftFlags(d({ pinInBy: 'a' }), { a: 'Wisani' }).find(f => f.code === 'self_handover')?.text).toMatch(/Counted alone: Wisani/)
    expect(shiftFlags(d(), {}).some(f => f.code === 'self_handover')).toBe(false)
  })
})
