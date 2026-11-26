// Interrupted setup: tap "Set up", leave before the PIN, come back (same phone, or another browser) and finish.
const { chromium } = require('playwright')
const [, , BASE, T] = process.argv
;(async () => {
  const b = await chromium.launch()
  const step = async (what, fn) => { try { await fn(); console.log('ok  ', what) } catch (e) { console.log('FAIL', what, '-', e.message.split('\n')[0]); await b.close(); process.exit(1) } }
  const a = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
  const btn = (p, n) => p.getByRole('button', { name: n, exact: true })
  await step('phone A taps Set up, then leaves before choosing a PIN', async () => {
    await a.goto(`${BASE}/?join=${T}`); await btn(a, 'Set up this phone').click(); await a.getByLabel('New PIN').waitFor({ timeout: 20000 })
  })
  await step('phone A comes back (same link): goes straight to the PIN step', async () => {
    await a.reload(); await a.getByLabel('New PIN').waitFor({ timeout: 20000 })
  })
  await step('phone A opens the app without the link: still asks to finish with a PIN', async () => {
    await a.goto(BASE); await a.getByLabel('New PIN').waitFor({ timeout: 20000 })
  })
  const c = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
  await step('another browser can still use the link (no PIN saved yet) and finish', async () => {
    await c.goto(`${BASE}/?join=${T}`); await btn(c, 'Set up this phone').click()
    await c.getByLabel('New PIN').fill('5678'); await c.getByLabel('Type it again').fill('5678'); await btn(c, 'Save PIN').click()
    await c.getByText('Clock in', { exact: true }).waitFor({ timeout: 30000 })
  })
  const d = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
  await step('after the PIN is saved, the link is used up', async () => {
    await d.goto(`${BASE}/?join=${T}`); await btn(d, 'Set up this phone').click(); await d.getByText(/already used/).waitFor({ timeout: 20000 })
  })
  await b.close()
})()
