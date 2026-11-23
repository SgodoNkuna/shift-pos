import { test, expect } from 'vitest'
import { buildPdf } from './pdf'
import { shareText } from './summary'
import { prototypeNight } from '../domain/fixtures'

test('pdf builds and is a real PDF', async () => {
  const blob = buildPdf(prototypeNight(), { a: 'Employee A', b: 'Employee B' })
  const head = new TextDecoder().decode((await blob.arrayBuffer()).slice(0, 5))
  expect(head).toBe('%PDF-')
  expect(blob.size).toBeGreaterThan(3000)
})

test('WhatsApp text names the problem', () => {
  const t = shareText(prototypeNight(), 'Employee A')
  expect(t).toContain('Sales R370 (card R200, cash R170)')
  expect(t).toContain('Super Cheese')
})
