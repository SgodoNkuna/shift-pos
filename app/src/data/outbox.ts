import type { OutboxEntry, ShiftDB } from './db'

/**
 * Sends waiting changes oldest first. Stops at the first failure so order is kept;
 * the failed entry stays (with tries + 1) and is sent again, with the same id, next time.
 */
export async function flush(db: ShiftDB, send: (e: OutboxEntry) => Promise<void>): Promise<{ sent: number; failed: boolean }> {
  let sent = 0
  for (const e of await db.outbox.orderBy('seq').toArray()) {
    try {
      await send(e)
      await db.outbox.delete(e.seq!)
      sent++
    } catch {
      await db.outbox.update(e.seq!, { tries: e.tries + 1 })
      return { sent, failed: true }
    }
  }
  return { sent, failed: false }
}
