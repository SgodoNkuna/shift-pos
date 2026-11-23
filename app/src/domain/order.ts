import type { Product } from './types'

/** Paper-sheet order: by `sort`, then name. Categories follow their first product. */
export const sortProducts = (ps: Product[]): Product[] =>
  [...ps].sort((a, b) => (a.sort ?? 1e9) - (b.sort ?? 1e9) || a.name.localeCompare(b.name) || a.priceCents - b.priceCents)

export const categoryOrder = (ps: Product[]): string[] => [...new Set(sortProducts(ps).map(p => p.categoryId))]
