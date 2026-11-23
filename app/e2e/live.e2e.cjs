// Live test against the real Supabase project: two phones, invite links, sale, stock out, approval on the manager's phone.
// Run: node e2e/live.e2e.cjs <url> <employeeToken> <managerToken> <shots dir>
const { chromium } = require('playwright')
const [, , URL, TE, TM, SHOTS = '/tmp'] = process.argv
;(async () => {
  const b = await chromium.launch()
  const phone = async () => { const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const p = await c.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); return p }
  const step = async (what, fn) => { try { await fn(); console.log('ok  ', what) } catch (e) { console.log('FAIL', what, '-', e.message.split('\n')[0]); await emp.screenshot({ path: `${SHOTS}/live-fail-emp.png` }); await mgr.screenshot({ path: `${SHOTS}/live-fail-mgr.png` }).catch(() => {}); await b.close(); process.exit(1) } }
  const btn = (p, name) => p.getByRole('button', { name, exact: true })
  const pin = async (p, d) => { for (const k of d) await p.getByRole('button', { name: k, exact: true }).last().click() }
  const join = async (p, token, code) => {
    await p.goto(`${URL}/?join=${token}`); await btn(p, 'Set up this phone').click()
    await p.getByLabel('New PIN').fill(code); await p.getByLabel('Type it again').fill(code); await btn(p, 'Save PIN').click()
  }
  const emp = await phone(); let mgr = emp

  await step('employee joins with invite link and picks a PIN', async () => {
    await join(emp, TE, '1111'); await emp.getByText('Clock in', { exact: true }).waitFor({ timeout: 20000 })
    await emp.getByText('Synced').waitFor({ timeout: 30000 })
  })
  await step('opening stock came from the server (Outdoor 59)', async () => {
    await emp.locator('.row', { hasText: 'Outdoor' }).getByText('59').waitFor({ timeout: 20000 })
  })
  await step('clock in and sell Outdoor for R20 cash', async () => {
    await btn(emp, 'Confirm & start shift').click(); await emp.getByRole('tab', { name: 'Main' }).click()
    await emp.getByRole('button', { name: /^Outdoor,/ }).click(); await btn(emp, 'Pay').click(); await btn(emp, 'Record sale').click()
    await emp.getByText('Sale recorded').waitFor()
  })
  await step('ask for 0.5 g Martian F stock out', async () => {
    await btn(emp, 'Out').click(); await emp.getByLabel('Product').selectOption('martian'); await btn(emp, 'Given to boss').click()
    await btn(emp, 'Send for approval').click(); await emp.locator('.pill.pending').first().waitFor()
    await emp.getByText('Synced').waitFor({ timeout: 30000 })
  })
  mgr = await phone()
  await step('manager joins and sees the open shift live with R20 and 1 waiting', async () => {
    await join(mgr, TM, '2222'); await mgr.getByText('Shop overview').waitFor({ timeout: 20000 })
    await mgr.getByText(/Test Employee since/).waitFor({ timeout: 30000 })
    await mgr.locator('.block', { hasText: 'Sales so far' }).getByText('R20').waitFor({ timeout: 20000 })
    await mgr.screenshot({ path: `${SHOTS}/live-manager-overview.png` })
  })
  await step('manager approves on their own phone', async () => {
    await mgr.getByRole('button', { name: 'Approve' }).click(); await mgr.getByText('Approved').first().waitFor()
  })
  await step('employee phone shows APPROVED without touching it', async () => {
    await emp.locator('.pill.approved').first().waitFor({ timeout: 40000 })
    await emp.screenshot({ path: `${SHOTS}/live-employee-approved.png` })
  })
  await step('a stranger with a used invite link is turned away', async () => {
    const x = await phone(); await x.goto(`${URL}/?join=${TE}`); await btn(x, 'Set up this phone').click()
    await x.getByText(/already used/).waitFor({ timeout: 20000 })
  })
  console.log('page errors:', [...emp.errs, ...mgr.errs].length ? [...emp.errs, ...mgr.errs] : 'none')
  await b.close()
})()
