// Plays one full shift in the built app at phone size. Run: node e2e/shift.e2e.cjs <url> <screenshot dir>
const { chromium } = require('playwright')
const [, , URL = 'http://localhost:4173', SHOTS = '/tmp'] = process.argv
;(async () => {
  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true })
  const p = await ctx.newPage()
  const errors = []
  p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  const downloads = []; p.on('download', async d => { downloads.push(d.suggestedFilename()); await d.saveAs(`${SHOTS}/${d.suggestedFilename()}`) })
  const shot = n => p.screenshot({ path: `${SHOTS}/${n}.png` })
  const btn = (name, exact = true) => p.getByRole('button', { name, exact })
  const pin = async digits => { for (const d of digits) await p.getByRole('button', { name: d, exact: true }).last().click() }
  const step = async (what, fn) => { try { await fn(); console.log('ok  ', what) } catch (e) { console.log('FAIL', what, '-', e.message.split('\n')[0]); await shot('fail'); throw e } }

  await p.goto(URL)
  await step('first-run setup as manager Rori', async () => {
    await p.getByLabel('Your name').fill('Rori'); await btn('manager').click()
    await p.getByLabel('New PIN (4 numbers)').fill('2222'); await p.getByLabel('Type the PIN again').fill('2222')
    await shot('01-setup'); await btn('Set up').click()
    await p.getByText('Clock in', { exact: true }).waitFor()
  })
  await step('manager adds Employee A and Employee B', async () => {
    await btn('Menu').click(); await btn('People').click()
    for (const [n, k] of [['Employee A', '1111'], ['Employee B', '3333']]) {
      await p.getByLabel('Name').fill(n); await p.getByLabel('Their PIN').fill(k); await btn('Add person').click()
      await p.getByText(`${n} added`).waitFor()
    }
    await btn('Close').click(); await btn('Menu').click(); await btn('Sign out').click()
  })
  await step('Employee A signs in with PIN', async () => {
    await btn('Employee A').click(); await pin('1111')
    await p.getByText('Clock in', { exact: true }).waitFor(); await shot('02-clock-in')
  })
  await step('clock in with opening stock from the sheet', async () => {
    await p.getByText('Super Cheese').first().waitFor()
    await btn('Confirm & start shift').click(); await p.getByRole('tab', { name: 'Main' }).waitFor()
  })
  await step('cash sale: Outdoor ×2 + Pink Ink 0.5 g = R90, R100 given, R10 change', async () => {
    await p.getByRole('tab', { name: 'Main' }).click(); await p.getByRole('button', { name: /^Outdoor,/ }).click(); await p.getByRole('button', { name: /^Outdoor,/ }).click()
    await p.getByRole('button', { name: /^Pink Ink,/ }).click()
    await p.locator('.btot').getByText('R90').waitFor(); await shot('03-basket')
    await btn('Pay').click(); await btn('R100').click()
    await p.locator('.change').getByText('R10').waitFor(); await shot('04-pay-change')
    await btn('Record sale').click(); await p.getByText('Sale recorded').waitFor()
  })
  await step('three-tap sale: Gummies → Pay → Record', async () => {
    await p.getByRole('button', { name: /^Gummies,/ }).click(); await btn('Pay').click(); await btn('Record sale').click()
    await p.getByText(/Last sale R30/).waitFor()
  })
  await step('undo last sale', async () => { await btn('Undo').click(); await p.getByText('Last sale undone').waitFor() })
  await step('split sale: Kings + Super Cheese = R280, R200 card + R80 cash', async () => {
    await p.getByRole('tab', { name: 'Main' }).click(); await p.getByRole('button', { name: /^Kings,/ }).click(); await p.getByRole('button', { name: /^Super Cheese,/ }).click()
    await btn('Pay').click(); await p.getByRole('tab', { name: 'SPLIT' }).click(); await btn('R200').click()
    await p.locator('.change').getByText('R80').waitFor(); await btn('Record sale').click(); await p.getByText('Sale recorded').waitFor()
  })
  await step('stock in: 24 Coke, then Drinks shows 24 left', async () => {
    await btn('In').click(); await p.getByLabel('Product').selectOption('coke')
    await btn('+12').click(); await btn('+12').click(); await btn('Add to stock').click()
    await btn('Sell').click(); await p.getByRole('tab', { name: 'Drinks' }).click()
    await p.getByRole('button', { name: /^Coke, R20, 24 left/ }).waitFor()
  })
  await step('stock out 0.5 g Martian F → pending, manager approves with PIN', async () => {
    await btn('Out').click(); await p.getByLabel('Product').selectOption('martian'); await btn('Given to boss').click()
    await btn('Send for approval').click(); await p.locator('.pill.pending').first().waitFor()
    await shot('05-stock-out-pending')
    await btn('Manager approves here').click(); await pin('2222')
    await p.locator('.pill.approved').first().waitFor()
  })
  await step('expense R20 cleaning supplies', async () => {
    await btn('Expense').click(); await btn('R20').click(); await p.getByLabel('What was it for?').fill('Cleaning supplies')
    await btn('Save expense').click(); await p.getByText('Expense noted').waitFor()
  })
  await step('clock out: lock is blocked and says why', async () => {
    await btn('Close').click(); await p.getByText('Count every item (24 left)').waitFor()
    if (!(await btn('Lock shift').isDisabled())) throw new Error('lock should be disabled')
  })
  await step('count: Super Cheese 23 (one short), rest match', async () => {
    const sc = p.getByLabel('Counted Super Cheese'); await sc.fill('23'); await sc.blur()
    await p.getByText('−1 · −R30').waitFor()
    for (let i = 0; i < 40; i++) { const m = p.getByRole('button', { name: /matches$/ }); if (!(await m.count())) break; await m.first().click(); await p.waitForTimeout(60) }
    await p.getByText(/24 of 24 counted/).waitFor()
  })
  await step('card slip R200 and cash R150 match', async () => {
    const slip = p.getByLabel('Card machine end-of-day total'); await slip.fill('200'); await slip.blur()
    const cash = p.getByLabel('Cash you counted'); await cash.fill('150'); await cash.blur()
    await p.locator('.money .ok').nth(1).waitFor()
  })
  await step('both PINs, then lock', async () => {
    await p.getByRole('button', { name: /Going home/ }).click(); await pin('1111')
    await p.getByRole('button', { name: /Starting/ }).click(); await btn('Employee B').click(); await pin('3333')
    await p.getByText('Employee B').first().waitFor(); await shot('06-clock-out')
    await btn('Lock shift').click(); await p.getByText('Shift report').waitFor()
  })
  await step('report shows flags and sends (downloads both files headless)', async () => {
    await p.getByText(/Super Cheese: counted 23, expected 24/).waitFor()
    await p.getByText(/Cash counted matches expected \(R150\)/).waitFor()
    await p.getByText(/Card slip matches till card sales \(R200\)/).waitFor()
    await shot('07-report')
    await btn('Send to WhatsApp').click(); await p.getByText(/^Sent ·/).waitFor({ timeout: 20000 })
    if (downloads.length !== 2) throw new Error('expected 2 files, got ' + downloads.join(','))
  })
  await step('next shift opens with the counted close (Super Cheese 23)', async () => {
    await btn('Done · sign out').click(); await btn('Employee B').click(); await pin('3333')
    const row = p.locator('.row', { hasText: 'Super Cheese' }); await row.getByText('23').waitFor()
  })
  console.log('files:', downloads.join(', '))
  console.log('errors:', errors.length ? errors : 'none')
  await b.close()
})().catch(() => process.exit(1))
