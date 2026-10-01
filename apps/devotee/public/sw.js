/* Shree Saibaba service worker — hand written, no build plugin.
 *
 * `__BUILD_ID__` is stamped at build by the saibaba-pwa Vite plugin (vite.config.ts), which also
 * emits /sw-manifest.json (the hashed app-shell asset list precached below).
 *
 * Caches
 *   sb-shell-<build>   app shell, replaced on every deploy
 *   sb-static-v1       hashed/static assets, cache-first (long-lived)
 *   sb-runtime-v1      API-like same-origin GETs, stale-while-revalidate (size capped)
 *   sb-offline-read-v1 aarti texts + today's schedule, filled via postMessage `cache-aarti`
 *                      (see features/pwa/offline.ts -> warmOfflineCache). Survives deploys.
 *
 * Privacy: requests carrying an Authorization header, non-GET requests and cross-origin
 * requests are never cached.
 */
const BUILD = '__BUILD_ID__'
const SHELL = `sb-shell-${BUILD}`
const STATIC = 'sb-static-v1'
const RUNTIME = 'sb-runtime-v1'
const OFFLINE_READ = 'sb-offline-read-v1'
const KEEP = new Set([SHELL, STATIC, RUNTIME, OFFLINE_READ])
const RUNTIME_MAX = 60

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL)
      let assets = ['/', '/offline.html']
      try {
        const res = await fetch('/sw-manifest.json', { cache: 'no-store' })
        if (res.ok) assets = (await res.json()).assets
      } catch {
        /* dev / offline install: shell minimal */
      }
      await Promise.all(
        assets.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined),
        ),
      )
      // No skipWaiting here: the page shows "New version available" and asks us (SKIP_WAITING).
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (!KEEP.has(key)) await caches.delete(key)
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable()
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('message', (event) => {
  const data = event.data || {}
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  } else if (data.type === 'GET_VERSION') {
    event.source && event.source.postMessage({ type: 'VERSION', version: BUILD })
  } else if (data.type === 'cache-aarti' && Array.isArray(data.urls)) {
    event.waitUntil(warm(data.urls, event.source))
  } else if (data.type === 'clear-offline-read') {
    event.waitUntil(caches.delete(OFFLINE_READ))
  }
})

async function warm(urls, source) {
  const cache = await caches.open(OFFLINE_READ)
  let ok = 0
  await Promise.all(
    urls.map(async (u) => {
      try {
        const url = new URL(u, self.location.origin)
        if (url.origin !== self.location.origin) return
        const res = await fetch(url.href, { cache: 'reload', credentials: 'same-origin' })
        if (res.ok) {
          await cache.put(url.href, res)
          ok++
        }
      } catch {
        /* skip unreachable url */
      }
    }),
  )
  if (source) source.postMessage({ type: 'cache-aarti:done', cached: ok, requested: urls.length })
}

const isApiLike = (url) =>
  /^\/(api|rest|functions|schedule)\//.test(url.pathname) ||
  (url.pathname.endsWith('.json') && url.pathname !== '/sw-manifest.json')

const isStatic = (url) =>
  url.pathname.startsWith('/assets/') ||
  /\.(woff2?|png|jpe?g|webp|avif|svg|ico|mp3|mp4|webm)$/i.test(url.pathname)

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET' || req.headers.has('authorization')) return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname === '/sw.js' || url.pathname === '/sw-manifest.json') return
  if (req.headers.has('range')) return // let the browser stream media itself

  event.respondWith(handle(event, req, url))
})

async function handle(event, req, url) {
  // Explicitly saved reading material (aarti, schedule) wins: serve saved copy, refresh quietly.
  const saved = await (await caches.open(OFFLINE_READ)).match(req.url)
  if (saved) {
    event.waitUntil(revalidate(OFFLINE_READ, req))
    return saved
  }
  if (req.mode === 'navigate') return navigation(event, req, url)
  if (isStatic(url)) return cacheFirst(req)
  if (isApiLike(url)) return staleWhileRevalidate(event, req)
  return fetch(req)
}

async function navigation(event, req, url) {
  try {
    const preload = event.preloadResponse ? await event.preloadResponse : undefined
    const res = preload || (await fetch(req))
    return res
  } catch {
    const cache = await caches.open(SHELL)
    const exact = await cache.match(req, { ignoreSearch: true })
    if (exact) return exact
    // The SPA can boot from the cached shell and read saved aarti/schedule data.
    if (url.pathname === '/' || /^\/(darshan|aarti)(\/|$)/.test(url.pathname)) {
      const shell = await cache.match('/')
      if (shell) return shell
    }
    return (await cache.match('/offline.html')) || Response.error()
  }
}

async function cacheFirst(req) {
  const hit = (await caches.match(req)) // any cache (shell precache included)
  if (hit) return hit
  const res = await fetch(req)
  if (res.ok) (await caches.open(STATIC)).put(req, res.clone())
  return res
}

async function revalidate(name, req) {
  try {
    const res = await fetch(req)
    if (res.ok) await (await caches.open(name)).put(req, res.clone())
    return res
  } catch {
    return undefined
  }
}

async function staleWhileRevalidate(event, req) {
  const cache = await caches.open(RUNTIME)
  const cached = await cache.match(req)
  const network = revalidate(RUNTIME, req).then(async (res) => {
    trim(cache)
    return res
  })
  if (cached) {
    event.waitUntil(network)
    return cached
  }
  return (await network) || Response.error()
}

async function trim(cache) {
  const keys = await cache.keys()
  for (let i = 0; i < keys.length - RUNTIME_MAX; i++) await cache.delete(keys[i])
}

/* ---- Web push (stub: needs a backend to send; see features/pwa/push.ts) ---- */
self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: 'Shree Saibaba', body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || 'Shree Saibaba', {
      body: payload.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: payload.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const c of all) {
        if ('focus' in c) {
          await c.focus()
          if ('navigate' in c) await c.navigate(target)
          return
        }
      }
      await self.clients.openWindow(target)
    })(),
  )
})
