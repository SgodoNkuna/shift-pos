import { describe, test, expect } from 'vitest'
import { addToBasket, removeFromBasket, basketQty, basketTotal, paymentsFor } from './basket'
import { SHEET_PRODUCTS } from '../domain/fixtures'

const P = (id: string) => SHEET_PRODUCTS.find(p => p.id === id)!

describe('basket', () => {
  test('Pink Ink tapped once is 0.5 g and R50', () => {
    const b = addToBasket([], P('pinkink'), 1)
    expect(basketQty(b, 'pinkink')).toBe(0.5)
    expect(basketTotal(b, SHEET_PRODUCTS)).toBe(5000)
  })
  test('Outdoor twice plus Pink Ink 0.5 g is R90', () => {
    let b = addToBasket([], P('outdoor'), 59); b = addToBasket(b, P('outdoor'), 59); b = addToBasket(b, P('pinkink'), 1)
    expect(basketTotal(b, SHEET_PRODUCTS)).toBe(9000)
  })
  test('cannot add more than is in stock', () => {
    let b = addToBasket([], P('pinkink'), 0.5)
    b = addToBasket(b, P('pinkink'), 0.5)
    expect(basketQty(b, 'pinkink')).toBe(0.5)
    expect(addToBasket([], P('coke'), 0)).toEqual([])
  })
  test('removing the last step drops the line', () => {
    const b = removeFromBasket(addToBasket([], P('kings'), 3), P('kings'))
    expect(b).toEqual([])
  })
})

describe('paymentsFor', () => {
  test('cash', () => { expect(paymentsFor('cash', 9000)).toEqual([{ method: 'cash', cents: 9000 }]) })
  test('card', () => { expect(paymentsFor('card', 25000)).toEqual([{ method: 'card', cents: 25000 }]) })
  test('split R200 card + R80 cash', () => {
    expect(paymentsFor('split', 28000, 20000)).toEqual([{ method: 'card', cents: 20000 }, { method: 'cash', cents: 8000 }])
  })
  test('split card part is capped at the total', () => {
    expect(paymentsFor('split', 5000, 9000)).toEqual([{ method: 'card', cents: 5000 }, { method: 'cash', cents: 0 }])
  })
})
