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
  if (new Date(inv.expires_at) < new Date()) return reply(410, { error: 'This invite link has expired. Ask the manager for a new one.' })
  // An invite stays usable until the person has saved a PIN, so a setup that was interrupted
  // (app closed, opened in another browser) can be finished with the same link.
  const { data: hasPin } = await admin.rpc('staff_has_pin', { p_staff: inv.staff_id })
  if (inv.used_at && hasPin) return reply(410, { error: 'This invite link was already used. Ask the manager for a new one.' })
  await admin.from('invites').update({ used_at: new Date().toISOString() }).eq('token', token)

  const { data: staff } = await admin.from('staff').select('id, name, role, user_id, active').eq('id', inv.staff_id).single()
  if (!staff?.active) return reply(403, { error: 'This person is not active.' })

  // A new phone replaces the old one.
  if (staff.user_id) await admin.auth.admin.deleteUser(staff.user_id)
  const email = `${staff.id}@staff.shift-pos.app`
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { staff_id: staff.id } })
  if (error || !created.user) return reply(500, { error: 'Could not set up this phone. Try again.' })
  await admin.from('staff').update({ user_id: created.user.id }).eq('id', staff.id)
  await admin.from('audit').insert({ by_staff: staff.id, action: 'join', ref: staff.id })
  // Any other unused links for this person stop working, so a stray link cannot move their account to another phone.
  await admin.from('invites').delete().eq('staff_id', staff.id).is('used_at', null).neq('token', token)

  return reply(200, { email, staff: { id: staff.id, name: staff.name, role: staff.role } })
})
