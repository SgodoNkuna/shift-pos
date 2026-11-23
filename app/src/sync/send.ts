import type { SupabaseClient } from '@supabase/supabase-js'
import type { OutboxEntry } from '../data/db'
import { db, getMeta, setMeta } from '../app/store'
import { isPermanent, planSend } from './map'

export class TransientError extends Error {}

/** Sends one outbox entry. Throws TransientError to retry later; permanent refusals are logged and skipped. */
export function makeSend(sb: SupabaseClient) {
  return async (e: OutboxEntry): Promise<void> => {
    const p = planSend(e)
    let error: { code?: string; message?: string } | null = null
    if (p.how === 'insert_ignore') ({ error } = await sb.from(p.table).upsert(p.row, { onConflict: 'id', ignoreDuplicates: true }))
    else if (p.how === 'upsert') ({ error } = await sb.from(p.table).upsert(p.row, { onConflict: 'id' }))
    else if (p.how === 'update') ({ error } = await sb.from(p.table).update(p.patch).eq('id', p.id))
    else {
      const r = await sb.from(p.table).update(p.row).eq('id', p.id).select('id')
      error = r.error
      if (!error && !r.data?.length) ({ error } = await sb.from(p.table).insert(p.row))
    }
    if (!error) return
    if (isPermanent(error)) {
      await db.audit.add({ at: new Date().toISOString(), by: 'sync', action: 'sync_refused', ref: e.id, detail: { table: e.table, code: error.code, message: error.message } })
      await setMeta('syncRefused', (await getMeta<number>('syncRefused', 0)) + 1)
      console.error('Server refused a change', e.table, error.code, error.message)
      return
    }
    throw new TransientError(error.message ?? 'network')
  }
}
