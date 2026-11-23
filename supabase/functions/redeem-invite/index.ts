// Turns a one-time invite into an account for this phone.
// The phone sends {token, password}; the password was made on the phone and never shown to anyone.
import { createClient } from 'npm:@supabase/supabase-js@2.119.2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply(405, { error: 'POST only' })
  let token = '', password = ''
  try { ({ token, password } = await req.json()) } catch { return reply(400, { error: 'Bad request' }) }
  if (!/^[a-f0-9]{48}$/.test(token ?? '') || typeof password !== 'string' || password.length < 32) return reply(400, { error: 'This invite link is not valid.' })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const { data: inv } = await admin.from('invites').select('token, staff_id, expires_at, used_at').eq('token', token).maybeSingle()
  if (!inv) return reply(404, { error: 'This invite link is not valid.' })
  if (inv.used_at) return reply(410, { error: 'This invite link was already used. Ask the manager for a new one.' })
  if (new Date(inv.expires_at) < new Date()) return reply(410, { error: 'This invite link has expired. Ask the manager for a new one.' })

  // Claim the invite first so it can only ever be used once.
  const { data: claimed } = await admin.from('invites').update({ used_at: new Date().toISOString() }).eq('token', token).is('used_at', null).select('token')
  if (!claimed?.length) return reply(410, { error: 'This invite link was already used.' })

  const { data: staff } = await admin.from('staff').select('id, name, role, user_id, active').eq('id', inv.staff_id).single()
  if (!staff?.active) return reply(403, { error: 'This person is not active.' })

  // A new phone replaces the old one.
  if (staff.user_id) await admin.auth.admin.deleteUser(staff.user_id)
  const email = `${staff.id}@staff.shift-pos.app`
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { staff_id: staff.id } })
  if (error || !created.user) return reply(500, { error: 'Could not set up this phone. Try again.' })
  await admin.from('staff').update({ user_id: created.user.id }).eq('id', staff.id)
  await admin.from('audit').insert({ by_staff: staff.id, action: 'join', ref: staff.id })

  return reply(200, { email, staff: { id: staff.id, name: staff.name, role: staff.role } })
})
