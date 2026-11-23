// Sends phone alerts.
// - Called by the database (trigger + every minute) with the shared secret: sends everything that is due.
// - Called by a signed-in phone with its own login: sends that person a test alert.
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2.119.2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-notify-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
type Alert = { staff_id: string; title: string; body: string; tag: string }
type Sub = { endpoint: string; staff_id: string; p256dh: string; auth: string }

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!)

  let alerts: Alert[] = []
  const secret = req.headers.get('x-notify-secret')
  if (secret) {
    if (secret !== Deno.env.get('NOTIFY_SECRET')) return reply(401, { error: 'no' })
    const { data, error } = await admin.rpc('claim_due_notifications')
    if (error) return reply(500, { error: error.message })
    alerts = data ?? []
  } else {
    const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '')
    const { data } = await admin.auth.getUser(jwt)
    const staffId = data.user?.user_metadata?.staff_id as string | undefined
    if (!staffId) return reply(401, { error: 'Sign in first' })
    alerts = [{ staff_id: staffId, title: 'Alerts are on', body: 'This phone will buzz for the shop.', tag: 'test' }]
  }
  if (!alerts.length) return reply(200, { due: 0, sent: 0 })

  const { data: subs } = await admin.from('push_subscriptions').select('*').in('staff_id', [...new Set(alerts.map(a => a.staff_id))])
  let sent = 0, gone = 0, failed = 0
  await Promise.all(alerts.flatMap(a => ((subs ?? []) as Sub[]).filter(s => s.staff_id === a.staff_id).map(async s => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: a.title, body: a.body, tag: a.tag }), { TTL: 3600, urgency: 'high' })
      sent++
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) { await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint); gone++ } else failed++
    }
  })))
  return reply(200, { due: alerts.length, sent, gone, failed })
})
