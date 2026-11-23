export const MAX_TRIES = 5

export interface PinUser { id: string; salt: string; pinHash: string; failed: number; locked: boolean }

const enc = new TextEncoder()
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('')

/** PBKDF2-SHA256, 100k rounds. The PIN itself is never stored. */
export async function hashPin(pin: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100_000 }, key, 256)
  return hex(bits)
}

/** Checks a PIN and returns the updated user. Locks after MAX_TRIES wrong tries; a manager resets it. */
export function createPinGuard() {
  return {
    async check(u: PinUser, pin: string): Promise<{ ok: boolean; user: PinUser }> {
      if (u.locked || !/^\d{4}$/.test(pin)) return { ok: false, user: u }
      if ((await hashPin(pin, u.salt)) === u.pinHash) return { ok: true, user: { ...u, failed: 0 } }
      const failed = u.failed + 1
      return { ok: false, user: { ...u, failed, locked: failed >= MAX_TRIES } }
    },
  }
}
