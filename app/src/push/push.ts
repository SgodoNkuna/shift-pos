import { supabase, SUPABASE_URL, SUPABASE_KEY, deviceStaffId } from '../sync/client'
import { DEMO_ONLY } from '../app/brand'

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export type AlertState = 'on' | 'off' | 'blocked' | 'install-first' | 'unsupported' | 'needs-account'

export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const isInstalled = () => matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!VAPID && !!supabase

/** Starts the background helper (alerts + opening without signal). Only in the built app. */
export function registerServiceWorker(): void {
  if ('serviceWorker' in navigator && import.meta.env.PROD && !DEMO_ONLY) navigator.serviceWorker.register('/sw.js').catch(() => {})
}

export async function alertState(): Promise<AlertState> {
  if (DEMO_ONLY || (supabase && !(await deviceStaffId()))) return 'needs-account'
  if (isIos() && !isInstalled()) return 'install-first'
  if (!supported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

const keyBytes = (b64: string) => {
  const raw = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

/** Asks permission, subscribes this phone and saves it for this person. */
export async function turnOnAlerts(staffId: string): Promise<AlertState> {
  if (!supported()) return 'unsupported'
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return perm === 'denied' ? 'blocked' : 'off'
  const reg = await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID!) }))
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  const { error } = await supabase!.from('push_subscriptions').upsert({ endpoint: j.endpoint, staff_id: staffId, p256dh: j.keys.p256dh, auth: j.keys.auth })
  if (error) throw error
  return 'on'
}

/** Buzzes this person's phones once so they know alerts work. */
export async function sendTestAlert(): Promise<{ sent: number; gone: number; failed: number }> {
  const { data } = await supabase!.auth.getSession()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/notify`, {
    method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${data.session?.access_token ?? ''}`, 'Content-Type': 'application/json' }, body: '{}',
  })
  if (!res.ok) throw new Error('test failed')
  return res.json()
}
