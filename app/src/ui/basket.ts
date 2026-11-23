import { roundQty } from '../domain/num'
import type { Payment, Product } from '../domain/types'

export interface BasketLine { productId: string; qty: number }
export type Basket = BasketLine[]
export type PayMode = 'cash' | 'card' | 'split'

export const basketQty = (b: Basket, id: string) => b.find(l => l.productId === id)?.qty ?? 0

/** Adds one step (1 or 0.5 g). `available` is the stock left before this basket; refuses to go past it. */
export function addToBasket(b: Basket, p: Product, available: number): Basket {
  const next = roundQty(basketQty(b, p.id) + p.step)
  if (next > available) return b
  return b.some(l => l.productId === p.id) ? b.map(l => l.productId === p.id ? { ...l, qty: next } : l) : [...b, { productId: p.id, qty: next }]
}

export function removeFromBasket(b: Basket, p: Product): Basket {
  const next = roundQty(basketQty(b, p.id) - p.step)
  return next <= 0 ? b.filter(l => l.productId !== p.id) : b.map(l => l.productId === p.id ? { ...l, qty: next } : l)
}

export const basketTotal = (b: Basket, products: Product[]) =>
  Math.round(b.reduce((a, l) => a + l.qty * (products.find(p => p.id === l.productId)?.priceCents ?? 0), 0))

export function paymentsFor(mode: PayMode, totalCents: number, cardCents = 0): Payment[] {
  if (mode === 'cash') return [{ method: 'cash', cents: totalCents }]
  if (mode === 'card') return [{ method: 'card', cents: totalCents }]
  const card = Math.min(cardCents, totalCents)
  return [{ method: 'card', cents: card }, { method: 'cash', cents: totalCents - card }]
}
