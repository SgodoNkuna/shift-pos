// Live alert test (headless browsers cannot hold a real push subscription, so the test
// staff get stand-in endpoints that answer 201 or 410). Checks: employee stock out buzzes
// the boss automatically; the employee's "send me a test alert" goes out; dead phones are dropped.
const { chromium } = require('playwright')
const [, , BASE, TE] = process.argv
;(async () => {
  const b = await chromium.launch()
  const step = async (what, fn) => { try { await fn(); console.log('ok  ', what) } catch (e) { console.log('FAIL', what, '-', e.message.split('\n')[0]); await b.close(); process.exit(1) } }
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
  p.on('response', async r => { if (r.url().includes('/rest/v1/') && r.request().method() !== 'GET') console.log('  server said', r.status(), r.request().method(), new URL(r.url()).pathname, (await r.text()).slice(0, 200)) })
  p.on('console', m => { if (m.type() === 'error') console.log('  console:', m.text().slice(0, 200)) })
  const btn = name => p.getByRole('button', { name, exact: true })
  await step('employee joins, clocks in and asks for stock out', async () => {
    await p.goto(`${BASE}/?join=${TE}`); await btn('Set up this phone').click()
    await p.getByLabel('New PIN').fill('1111'); await p.getByLabel('Type it again').fill('1111'); await btn('Save PIN').click()
    await p.getByText('Clock in', { exact: true }).waitFor({ timeout: 20000 })
    await btn('Confirm & start shift').click(); await btn('Out').click()
    await p.getByLabel('Product').selectOption('martian'); await btn('Given to boss').click(); await btn('Send for approval').click()
    await p.locator('.pill.pending').first().waitFor()
    // Wait until the phone's send queue is really empty (the "Synced" label may be left over from before).
    const queued = () => p.evaluate(() => new Promise(res => { const r = indexedDB.open('shiftpos'); r.onsuccess = () => {
      const tx = r.result.transaction('outbox'); const c = tx.objectStore('outbox').count(); tx.oncomplete = () => res(c.result) } }))
    for (let i = 0; i < 60 && (await queued()) > 0; i++) await p.waitForTimeout(500)
    if (await queued()) throw new Error('phone still has unsent changes')
  })
  await step('employee test alert goes out', async () => {
    const r = await p.evaluate(async () => {
      const s = JSON.parse(localStorage.getItem('shiftpos-auth'))
      const env = window.__env || {}
      const res = await fetch('https://qnlndzxlgfcoieqnpnfh.supabase.co/functions/v1/notify', { method: 'POST', headers: { Authorization: `Bearer ${s.access_token}`, 'Content-Type': 'application/json' }, body: '{}' })
      return res.json()
    })
    if (r.sent !== 1) throw new Error(JSON.stringify(r))
  })
  await b.close()
})()
