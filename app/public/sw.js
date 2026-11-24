// Hash Cannabis Lounge background helper: opens the app without signal, and shows alerts.
const CACHE = 'shiftpos-v2'

self.addEventListener('install', e => {
  self.skipWaiting()
  e.waitUntil((async () => {
    const c = await caches.open(CACHE)
    const res = await fetch('/', { cache: 'no-cache' })
    const html = await res.clone().text()
    await c.put('/', res)
    const assets = [...new Set(html.match(/\/assets\/[^"']+/g) || [])]
    await c.addAll(['/manifest.webmanifest', '/icon-192.png', ...assets])
  })())
})

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k)
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin) return
  if (e.request.mode === 'navigate') {
    // Newest page when online; the saved one when not.
    e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put('/', copy)); return r })
      .catch(() => caches.match('/')))
    return
  }
  if (url.pathname.startsWith('/assets/') || url.pathname.endsWith('.png')) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
      const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r
    })))
  }
})

self.addEventListener('push', e => {
  let d = { title: 'Hash Lounge', body: '', tag: 'shiftpos' }
  try { d = { ...d, ...e.data.json() } } catch { /* plain message */ }
  e.waitUntil(self.registration.showNotification(d.title, {
    body: d.body, tag: d.tag, renotify: true, icon: '/icon-192.png', badge: '/icon-192.png',
    vibrate: [300, 120, 300, 120, 300], requireInteraction: String(d.tag).startsWith('out-'),
  }))
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
    for (const w of ws) if ('focus' in w) return w.focus()
    return self.clients.openWindow('/')
  }))
})
