/** Built as a demo only (e.g. to try inside Claude): no server, no alerts, demo logins, neutral name. */
export const DEMO_ONLY = import.meta.env.VITE_DEMO_ONLY === '1'
/** The live app has no demo. Test builds turn it on with VITE_ALLOW_DEMO=1. */
export const DEMO_ALLOWED = DEMO_ONLY || import.meta.env.VITE_ALLOW_DEMO === '1'

/** The shop this copy of the app is for. Shown in headers, reports, invites and alerts. */
export const SHOP = DEMO_ONLY
  ? { name: 'Shift POS Demo', short: 'Shift POS', city: 'Demo', address: 'Demo shop', markTop: 'DEMO', markMain: 'SHIFT', logo: null as string | null }
  : { name: 'Hash Cannabis Lounge', short: 'Hash Lounge', city: 'Bloemfontein', address: '73A Park Road, Willows, Bloemfontein', markTop: 'CANNABIS LOUNGE', markMain: 'HASH', logo: '/logo.png' as string | null }
