import { describe, test, expect } from 'vitest'
import { hashPin, createPinGuard, MAX_TRIES } from './pin'

describe('hashPin', () => {
  test('never equals the PIN and is stable for the same salt', async () => {
    const a = await hashPin('4815', 'salt-1'); const b = await hashPin('4815', 'salt-1')
    expect(a).not.toBe('4815'); expect(a).toBe(b)
  })
  test('different salt gives a different hash', async () => {
    expect(await hashPin('4815', 'salt-1')).not.toBe(await hashPin('4815', 'salt-2'))
  })
})

describe('pin guard', () => {
  const user = async () => ({ id: 'a', salt: 's', pinHash: await hashPin('4815', 's'), failed: 0, locked: false })
  test('right PIN opens and resets the count', async () => {
    const g = createPinGuard(); const u = { ...(await user()), failed: 2 }
    const r = await g.check(u, '4815')
    expect(r).toEqual({ ok: true, user: { ...u, failed: 0 } })
  })
  test(`${MAX_TRIES} wrong PINs lock the account`, async () => {
    const g = createPinGuard(); let u = await user()
    for (let i = 0; i < MAX_TRIES; i++) { const r = await g.check(u, '0000'); u = r.user }
    expect(u.locked).toBe(true)
    expect((await g.check(u, '4815')).ok).toBe(false)
  })
  test('only 4 digits are accepted', async () => {
    const g = createPinGuard(); const u = await user()
    expect((await g.check(u, '48a5')).ok).toBe(false)
  })
})
