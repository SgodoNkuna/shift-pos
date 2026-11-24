// Boss features on one phone (test mode): settings, products and prices, opening correction, profit.
// Run: node e2e/boss.e2e.cjs <url> <screenshot dir>
const { chromium } = require('playwright')
const [, , BASE = 'http://localhost:4173', SHOTS = '/tmp'] = process.argv
;(async () => {
  const b = await chromium.launch()
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage()
  const errors = []; p.on('pageerror', e => errors.push(e.message))
  const btn = (n, exact = true) => p.getByRole('button', { name: n, exact })
  const pin = async d => { for (const k of d) await p.getByRole('button', { name: k, exact: true }).last().click() }
  const menu = async item => { await btn('Menu').click(); await btn(item).click() }
  const close = () => p.getByRole('button', { name: 'Close' }).last().click()
  const step = async (what, fn) => { try { await fn(); console.log('ok  ', what) } catch (e) { console.log('FAIL', what, '-', e.message.split('\n')[0]); await p.screenshot({ path: `${SHOTS}/boss-fail.png` }); await b.close(); process.exit(1) } }

  await p.goto(BASE)
  await step('start the demo and sign in as Demo Boss; alerts explain they need an invite', async () => {
    await btn('Try the demo').click(); await btn('Demo Boss').click(); await pin('1111')
    await p.getByText('Shop overview').waitFor()
    await btn('Menu').click(); await p.getByText('Alerts only work on a phone that joined').waitFor()
    await p.getByRole('button', { name: /Leave the demo/ }).waitFor(); await close()
  })
  await step('settings: float R200 and a new reason "Broken"', async () => {
    await menu('Settings'); await p.getByLabel('Change left in the drawer at every handover').fill('200'); await p.getByLabel('Change left in the drawer at every handover').blur()
    await p.getByLabel('New reason').fill('Broken'); await btn('Add').click(); await p.getByRole('button', { name: 'Remove Broken' }).waitFor()
    await p.screenshot({ path: `${SHOTS}/boss-settings.png` })
    await btn('Save settings').click(); await p.getByText('Settings saved').waitFor()
  })
  await step('products: Outdoor cost R9; Raw R40 → R45 with the "old sales keep" warning; add Lighter R15', async () => {
    await menu('Products & prices')
    await p.getByRole('button', { name: /^Outdoor/ }).click(); await p.getByLabel('Cost price (R) · only you see this').fill('9'); await btn('Save').click(); await p.getByText('Saved').first().waitFor()
    await p.getByRole('button', { name: /^Raw/ }).click(); await p.getByLabel('Price (R)', { exact: true }).fill('45')
    await p.getByText('Sales already made keep R40').waitFor(); await btn('Save').click(); await p.getByText('Saved').first().waitFor()
    await btn('Add a product').click(); await p.getByLabel('Name').fill('Lighter'); await btn('Drinks').click(); await p.getByLabel('Price (R)', { exact: true }).fill('15')
    await btn('Add product').click(); await p.getByText('Lighter added').waitFor()
    await p.getByRole('button', { name: /^Raw R45/ }).waitFor(); await p.screenshot({ path: `${SHOTS}/boss-products.png` }); await close()
  })
  await step('clock in: correct Super Cheese 25 → 24; float shows R200', async () => {
    await btn('Start a shift myself').click(); await btn('Correct a count').click()
    const sc = p.getByLabel('Real count Super Cheese'); await sc.fill('24'); await sc.blur()
    await p.getByText('1 count changed').waitFor(); await p.locator('.row', { hasText: 'Cash float' }).getByText('R200').waitFor()
    await p.screenshot({ path: `${SHOTS}/boss-clockin-correct.png` })
    await btn('Confirm & start shift').click(); await p.getByRole('tab', { name: 'Main' }).waitFor()
  })
  await step('sell Outdoor R20 cash; new Lighter tile is on the Drinks tab; Raw is now R45', async () => {
    await p.getByRole('tab', { name: 'Main' }).click(); await p.getByRole('button', { name: /^Outdoor,/ }).click(); await btn('Cash').click(); await btn('Record sale').click()
    await p.getByText('Sale recorded').waitFor()
    await p.getByRole('tab', { name: 'Drinks' }).click(); await p.getByRole('button', { name: /^Lighter, R15/ }).waitFor()
    await p.getByRole('tab', { name: 'Rolling' }).click(); await p.getByRole('button', { name: /^Raw, R45/ }).waitFor()
  })
  await step('stock out reasons include "Broken"', async () => { await btn('Out').click(); await btn('Broken').waitFor() })
  await step('clock out and lock (cash R220 = float R200 + R20)', async () => {
    await btn('Close').click()
    for (let i = 0; i < 6; i++) { const m = p.getByRole('button', { name: /^All the rest in .* match$/ }); if (!(await m.count())) break; await m.first().click(); await p.waitForTimeout(300) }
    const slip = p.getByLabel('Card machine end-of-day total'); await slip.fill('0'); await slip.blur()
    const cash = p.getByLabel('Cash you counted'); await cash.fill('220'); await cash.blur()
    await p.getByRole('button', { name: /Going home/ }).click(); await pin('1111')
    await p.getByRole('button', { name: /Starting/ }).click(); await btn('Demo Employee').click(); await pin('3333')
    await btn('Lock & send report').click(); await p.getByText('Shift report').waitFor()
  })
  await step('report: correction flagged with the boss\'s name; boss sees profit R11 on Outdoor', async () => {
    await p.getByText('Opening count changed at clock in: Super Cheese 25 → 24 (by Demo Boss)').waitFor()
    await p.getByText('Cash counted matches expected (R220)').waitFor()
    const prof = p.locator('.block', { hasText: 'Profit · only you see this' })
    await prof.locator('tr', { hasText: 'Outdoor' }).getByText('R11').waitFor()
    await prof.scrollIntoViewIfNeeded(); await p.screenshot({ path: `${SHOTS}/boss-report-profit.png` })
  })
  await step('reports: last 7 days shows the shift, R20 sales, R11 profit, Outdoor best seller', async () => {
    await btn('Done').click(); await btn('Reports · 7 and 30 days').click()
    await p.getByText('1 locked shift').waitFor()
    await p.locator('.block', { hasText: 'Profit · only you' }).getByText('R11').waitFor()
    await p.getByText('1. Outdoor').waitFor()
    await p.locator('.req', { hasText: 'R20' }).getByText('all adds up').waitFor()
    await p.screenshot({ path: `${SHOTS}/boss-reports.png` })
  })
  console.log('errors:', errors.length ? errors : 'none')
  await b.close()
})()
