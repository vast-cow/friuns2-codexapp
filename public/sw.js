// Retirement worker: keep this URL available for previously registered installations.
// No fetch handler, offline cache, or new registration is provided.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Replace the old caching controller before removing its caches.
    // Do not reload tabs or interrupt active work.
    await self.clients.claim()
    const keys = await caches.keys()
    await Promise.all(keys
      .filter((key) => key.startsWith('codexweb-shell-') || key.startsWith('codexweb-assets-'))
      .map((key) => caches.delete(key)))
    await self.registration.unregister()
  })())
})
