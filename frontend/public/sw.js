const CACHE_NAME = 'sr-pulse-v2'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/logo.jpg',
  '/widget-template.json'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key.startsWith('sr-pulse-') && key !== CACHE_NAME) {
            return caches.delete(key)
          }
        })
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // API endpoints are always fetched live from the network to protect RBAC boundaries and freshness
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request))
    return
  }

  // Network-first shell avoids pinning HTML to obsolete hashed JS after deployment.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/index.html')))
    return
  }

  // Only public static assets may enter this cache. Never cache authenticated responses.
  if (!STATIC_ASSETS.includes(url.pathname) && !url.pathname.startsWith('/assets/')) return
  // Static assets: cache-first with network fallback and background revalidation
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const clone = networkResponse.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return networkResponse
      }).catch(() => cached)

      return cached || fetchPromise
    })
  )
})

// Android Web Widget Interaction Handler
self.addEventListener('widgetclick', (event) => {
  if (event.action === 'open-dashboard' || event.widgetAction === 'open') {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes('#widget') && 'focus' in client) {
            return client.focus()
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/#widget')
        }
      })
    )
  }
})
