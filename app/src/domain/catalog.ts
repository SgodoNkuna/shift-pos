// Generated from the 26 November shift sheets. Coke, Sprite, Stoney R20 (owner, 26 Nov evening; R25 was overcharging). Water R15 (owner, 26 Nov).
import type { Product } from './types'

export const CATALOG: Product[] = [
  { id: 'outdoor', name: 'Outdoor', categoryId: 'main', unit: 'ea', step: 1, lowAt: 3, priceCents: 2000, active: true, sort: 1 },
  { id: 'supercheese', name: 'Super Cheese', categoryId: 'main', unit: 'ea', step: 1, lowAt: 3, priceCents: 3000, active: true, sort: 2 },
  { id: 'castro', name: 'Castro Pop', categoryId: 'main', unit: 'ea', step: 1, lowAt: 3, priceCents: 6000, active: true, sort: 3 },
  { id: 'exodus', name: 'Exodus Cheese', categoryId: 'main', unit: 'ea', step: 1, lowAt: 3, priceCents: 8000, active: true, sort: 4 },
  { id: 'icecream', name: 'Ice Cream C', categoryId: 'main', unit: 'g', step: 0.5, lowAt: 1, priceCents: 5000, active: true, sort: 5 },
  { id: 'pinkink', name: 'Pink Ink', categoryId: 'main', unit: 'g', step: 0.5, lowAt: 1, priceCents: 10000, active: true, sort: 6 },
  { id: 'icecool', name: 'Ice Cold', categoryId: 'main', unit: 'g', step: 0.5, lowAt: 1, priceCents: 12000, active: true, sort: 7 },
  { id: 'cadillac', name: 'Cadillac', categoryId: 'main', unit: 'g', step: 0.5, lowAt: 1, priceCents: 12000, active: true, sort: 8 },
  { id: 'martian', name: 'Martian F', categoryId: 'main', unit: 'g', step: 0.5, lowAt: 1, priceCents: 15000, active: true, sort: 9 },
  { id: 'grapeballs', name: 'Grape Balls', categoryId: 'main', unit: 'g', step: 0.5, lowAt: 1, priceCents: 15000, active: true, sort: 10 },
  { id: 'gummies', name: 'Gummies', categoryId: 'main', unit: 'ea', step: 1, lowAt: 3, priceCents: 3000, active: true, sort: 11 },
  { id: 'kings', name: 'Kings', categoryId: 'main', unit: 'ea', step: 1, lowAt: 3, priceCents: 25000, active: true, sort: 12 },
  { id: 'coke', name: 'Coke', categoryId: 'drinks', unit: 'ea', step: 1, lowAt: 3, priceCents: 2000, active: true, sort: 13 },
  { id: 'sprite', name: 'Sprite', categoryId: 'drinks', unit: 'ea', step: 1, lowAt: 3, priceCents: 2000, active: true, sort: 14 },
  { id: 'stoney', name: 'Stoney', categoryId: 'drinks', unit: 'ea', step: 1, lowAt: 3, priceCents: 2000, active: true, sort: 15 },
  { id: 'monster', name: 'Monster', categoryId: 'drinks', unit: 'ea', step: 1, lowAt: 3, priceCents: 2500, active: true, sort: 16 },
  { id: 'powerade', name: 'Powerade', categoryId: 'drinks', unit: 'ea', step: 1, lowAt: 3, priceCents: 2500, active: true, sort: 17 },
  { id: 'water', name: 'Water', categoryId: 'drinks', unit: 'ea', step: 1, lowAt: 3, priceCents: 1500, active: true, sort: 18 },
  { id: 'lighter', name: 'Lighter', categoryId: 'rolling', unit: 'ea', step: 1, lowAt: 3, priceCents: 2000, active: true, sort: 19 },
  { id: 'bluestar', name: 'Blue Star', categoryId: 'rolling', unit: 'ea', step: 1, lowAt: 3, priceCents: 2000, active: true, sort: 20 },
  { id: 'bobmarley', name: 'Bob Marley', categoryId: 'rolling', unit: 'ea', step: 1, lowAt: 3, priceCents: 3000, active: true, sort: 21 },
  { id: 'limitless', name: 'Limitless', categoryId: 'rolling', unit: 'ea', step: 1, lowAt: 3, priceCents: 3000, active: true, sort: 22 },
  { id: 'rizla30', name: 'Rizla 1', categoryId: 'rolling', unit: 'ea', step: 1, lowAt: 3, priceCents: 3000, active: true, sort: 23 },
  { id: 'rizla20', name: 'Rizla 2', categoryId: 'rolling', unit: 'ea', step: 1, lowAt: 3, priceCents: 3000, active: true, sort: 24 },
  { id: 'bejo', name: 'Bejo', categoryId: 'rolling', unit: 'ea', step: 1, lowAt: 3, priceCents: 3000, active: true, sort: 25 },
  { id: 'raw', name: 'Raw', categoryId: 'rolling', unit: 'ea', step: 1, lowAt: 3, priceCents: 4000, active: true, sort: 26 },
  { id: 'honeyp', name: 'Honey P', categoryId: 'rolling', unit: 'ea', step: 1, lowAt: 3, priceCents: 2000, active: true, sort: 27 },
  { id: 'cones', name: 'Cones', categoryId: 'rolling', unit: 'ea', step: 1, lowAt: 10, priceCents: 200, active: true, sort: 28 },
  { id: 'eucalypto', name: 'Eucalypto', categoryId: 'main', unit: 'g', step: 0.5, lowAt: 1, priceCents: 10000, active: false, sort: 99 },
  { id: 'hubbly', name: 'Hubbly hire', categoryId: 'hubbly', unit: 'ea', step: 1, lowAt: 0, priceCents: 10000, active: true, track: false, sort: 100 },
  { id: 'hubblyrefill', name: 'Hubbly refill', categoryId: 'hubbly', unit: 'ea', step: 1, lowAt: 0, priceCents: 5000, active: true, track: false, sort: 101 },
]

/** Opening stock from the 26 November day shift sheet. */
export const CATALOG_OPENING: Record<string, number> = {'outdoor':  12,  'supercheese':  14,  'castro':  11,  'exodus':  7,  'icecream':  8,  'pinkink':  2,  'icecool':  5,  'cadillac':  3,  'martian':  4,  'grapeballs':  7,  'gummies':  0,  'kings':  3,  'coke':  5,  'sprite':  6,  'stoney':  6,  'monster':  5,  'powerade':  4,  'water':  9,  'lighter':  14,  'bluestar':  14,  'bobmarley':  4,  'limitless':  50,  'rizla30':  50,  'rizla20':  13,  'bejo':  12,  'raw':  12,  'honeyp':  2,  'cones':  40}
