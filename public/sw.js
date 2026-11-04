const CACHE_NAME = 'codexweb-shell-v3'
const ASSET_CACHE_NAME = 'codexweb-assets-v1'
const MAX_HASHED_ASSETS = 256
const HASHED_ASSET_PATH = /^\/assets\/[^/]+-[A-Za-z0-9_-]{8}\.(?:js|css)$/
let assetCacheWrites = Promise.resolve()
const APP_SHELL_PATHS = ['/', '/manifest.webmanifest']
const STATIC_DESTINATIONS = new Set(['document', 'script', 'style', 'image', 'font'])
const BYPASS_PREFIXES = ['/codex-api/', '/codex-local-image', '/codex-local-file', '/codex-local-browse/', '/codex-local-edit/']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_PATHS)),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== ASSET_CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (BYPASS_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request))
    return
  }

  if ((request.destination === 'script' || request.destination === 'style') && HASHED_ASSET_PATH.test(url.pathname)) {
    event.respondWith(cacheFirstHashedAsset(request, event))
    return
  }

  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(networkFirstStatic(request))
    return
  }

  if (STATIC_DESTINATIONS.has(request.destination) || url.pathname === '/manifest.webmanifest') {
    event.respondWith(staleWhileRevalidate(request))
  }
})

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_NAME)
  try {
    const response = await fetch(request)
    cache.put('/', response.clone())
    return response
  } catch {
    return (await cache.match('/')) || Response.error()
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(request)
  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => null)

  if (cached) {
    return cached
  }

  const response = await networkPromise
  return response || Response.error()
}

async function networkFirstStatic(request) {
  const cache = await caches.open(CACHE_NAME)
  try {
    const response = await fetch(request)
    if (response.ok) {
      cache.put(request, response.clone())
      return response
    }
    return (await cache.match(request)) || response
  } catch {
    return (await cache.match(request)) || Response.error()
  }
}

async function cacheFirstHashedAsset(request, event) {
  const cache = await caches.open(ASSET_CACHE_NAME)
  const cached = await cache.match(request)
  if (cached) return cached

  const response = await fetch(request)
  if (response.ok && !response.redirected) {
    const copy = response.clone()
    // Serialize insertions and trimming so concurrent chunk loads respect the cap.
    // Evict oldest insertions; never trim the separate navigation/shell cache.
    assetCacheWrites = assetCacheWrites.catch(() => {}).then(async () => {
      await cache.put(request, copy)
      const keys = await cache.keys()
      for (const key of keys.slice(0, Math.max(0, keys.length - MAX_HASHED_ASSETS))) {
        await cache.delete(key)
      }
    })
    event.waitUntil(assetCacheWrites.catch(() => {}))
  }
  return response
}
