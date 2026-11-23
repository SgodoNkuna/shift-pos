// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, test, expect, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ClockOut } from './ClockOut'
import { ToastHost } from '../kit'
import { actions, addStaff, db } from '../../app/store'
import { SHEET_OPENING, SHEET_PRODUCTS } from '../../domain/fixtures'
import type { StaffMember } from '../../data/db'

let me: StaffMember
let shiftId: string

beforeAll(async () => {
  await db.products.bulkPut(SHEET_PRODUCTS)
  me = await addStaff('Employee A', 'employee', '4815')
  const s = await actions.openShift({ by: me.id, floatCents: 20000, opening: SHEET_OPENING })
  shiftId = s.id
  await actions.recordSale(shiftId, me.id, [{ productId: 'supercheese', qty: 1 }], [{ method: 'cash', cents: 3000 }])
  await actions.setCount(shiftId, 'supercheese', 23, me.id)
  await actions.requestOut(shiftId, me.id, 'martian', 0.5, 'Given to boss')
})

const show = async () => {
  const data = await actions.loadShiftData(shiftId)
  render(<ToastHost><ClockOut data={data} me={me} onLocked={() => {}} /></ToastHost>)
}

describe('ClockOut', () => {
  test('Super Cheese counted 23 vs expected 24 shows −1 · −R30', async () => {
    await show()
    expect(await screen.findByText('−1 · −R30')).toBeTruthy()
  })
  test('lock is off and every missing step is listed in plain words', async () => {
    await show()
    const list = await screen.findAllByLabelText('Before you can lock')
    const text = list.at(-1)!.textContent!
    expect(text).toContain('A stock out is still waiting for approval')
    expect(text).toContain('Count every item (23 left)')
    expect(text).toContain('Count the cash in the drawer')
    expect(text).toContain('The next person needs to enter their PIN')
    const lock = screen.getAllByRole('button', { name: 'Lock shift' }).at(-1) as HTMLButtonElement
    expect(lock.disabled).toBe(true)
  })
  test('the pending stock out is shown with its status', async () => {
    await show()
    await waitFor(() => expect(screen.getAllByText('pending').length).toBeGreaterThan(0))
  })
})
