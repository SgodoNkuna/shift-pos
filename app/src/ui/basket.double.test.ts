import { expect, it } from 'vitest'
import { findDoubles } from './basket'

const now = Date.parse('2026-11-26T20:00:00Z')
const at = (s: number) => new Date(now - s * 1000).toISOString()

it('warns when someone else sold the same item in the last 3 minutes', () => {
  const d = findDoubles([{ productId: 'sprite', qty: 1 }], [{ by: 'lerato', at: at(60), lines: [{ productId: 'sprite', qty: 2 }] }], 'wisani', now)
  expect(d).toEqual([{ productId: 'sprite', by: 'lerato', secondsAgo: 60, mine: false }])
})
it('stays quiet after 3 minutes, for other items, and for undone sales', () => {
  const b = [{ productId: 'sprite', qty: 1 }]
  expect(findDoubles(b, [{ by: 'lerato', at: at(200), lines: [{ productId: 'sprite', qty: 1 }] }], 'wisani', now)).toEqual([])
  expect(findDoubles(b, [{ by: 'lerato', at: at(30), lines: [{ productId: 'coke', qty: 1 }] }], 'wisani', now)).toEqual([])
  expect(findDoubles(b, [{ by: 'lerato', at: at(30), void: { reason: 'x' }, lines: [{ productId: 'sprite', qty: 1 }] }], 'wisani', now)).toEqual([])
})
it('warns when I ring up exactly the same basket again within 90 seconds', () => {
  const b = [{ productId: 'coke', qty: 1 }, { productId: 'outdoor', qty: 2 }]
  const mine = { by: 'wisani', lines: [{ productId: 'outdoor', qty: 2 }, { productId: 'coke', qty: 1 }] }
  expect(findDoubles(b, [{ ...mine, at: at(40) }], 'wisani', now)[0]).toMatchObject({ mine: true, secondsAgo: 40 })
  expect(findDoubles(b, [{ ...mine, at: at(120) }], 'wisani', now)).toEqual([])
  expect(findDoubles([{ productId: 'coke', qty: 1 }], [{ ...mine, at: at(40) }], 'wisani', now)).toEqual([])
})
