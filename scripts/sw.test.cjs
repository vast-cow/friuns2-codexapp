const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { runInNewContext } = require('node:vm')

function worker() {
  const handlers = {}
  const stores = new Map()
  const calls = []
  let network = () => new Response('download')
  const key = (request) => typeof request === 'string' ? request : request.url
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map())
      const entries = stores.get(name)
      return {
        async match(request) { return entries.get(key(request))?.clone() },
        async put(request, response) { entries.set(key(request), response.clone()) },
        async keys() { return [...entries.keys()] },
        async delete(request) { return entries.delete(key(request)) },
        async addAll(paths) { for (const path of paths) entries.set(path, new Response('shell')) },
      }
    },
    async keys() { return [...stores.keys()] },
    async delete(name) { return stores.delete(name) },
  }
  runInNewContext(readFileSync('public/sw.js', 'utf8'), {
    self: { location: { origin: 'https://app.test' }, addEventListener: (type, fn) => { handlers[type] = fn }, skipWaiting() {}, clients: { claim() {} } },
    caches, URL, Response, fetch: async (request) => { calls.push(request.url); return network(request) },
  })
  return {
    stores, calls, caches,
    network(fn) { network = fn },
    async lifecycle(type) {
      const pending = []
      handlers[type]({ waitUntil: (promise) => pending.push(promise) })
      await Promise.all(pending)
    },
    async request(path, options = {}) {
      const pending = []
      let response
      handlers.fetch({
        request: { url: new URL(path, 'https://app.test').href, method: 'GET', destination: 'script', ...options },
        respondWith(promise) { response = promise },
        waitUntil(promise) { pending.push(promise) },
      })
      const result = await response
      await Promise.all(pending)
      return result
    },
  }
}

for (const [extension, destination] of [['js', 'script'], ['css', 'style']]) {
  test(`hashed ${extension}: cold download, warm/offline cache hit, changed hash download`, async () => {
    const sw = worker()
    const path = `/assets/index-Beh94Zfe.${extension}`
    assert.equal(await (await sw.request(path, { destination })).text(), 'download')
    sw.network(() => { throw new Error('offline') })
    assert.equal(await (await sw.request(path, { destination })).text(), 'download')
    assert.equal(sw.calls.length, 1)
    sw.network(() => new Response('new build'))
    assert.equal(await (await sw.request(`/assets/index-Abc123_-.${extension}`, { destination })).text(), 'new build')
    assert.equal(sw.calls.length, 2)
  })
}

test('non-hashed scripts retain network first and offline fallback', async () => {
  const sw = worker()
  await sw.request('/assets/runtime.js')
  sw.network(() => new Response('updated'))
  assert.equal(await (await sw.request('/assets/runtime.js')).text(), 'updated')
  sw.network(() => { throw new Error('offline') })
  assert.equal(await (await sw.request('/assets/runtime.js')).text(), 'updated')
  assert.equal(sw.calls.length, 3)
})

test('HTML navigation stays network first with shell fallback', async () => {
  const sw = worker()
  await sw.lifecycle('install')
  await sw.request('/', { mode: 'navigate', destination: 'document' })
  sw.network(() => new Response('fresh HTML'))
  assert.equal(await (await sw.request('/', { mode: 'navigate' })).text(), 'fresh HTML')
  sw.network(() => { throw new Error('offline') })
  assert.equal(await (await sw.request('/', { mode: 'navigate' })).text(), 'fresh HTML')
  assert.equal(sw.calls.length, 3)
})

test('API, local endpoints, cross-origin and non-GET requests bypass worker caching', async () => {
  const sw = worker()
  for (const path of ['/codex-api/x', '/codex-local-image/x', '/codex-local-file/x', '/codex-local-browse/x', '/codex-local-edit/x', 'https://other.test/assets/index-Beh94Zfe.js']) {
    assert.equal(await sw.request(path), undefined)
  }
  assert.equal(await sw.request('/assets/index-Beh94Zfe.js', { method: 'POST' }), undefined)
  assert.equal(sw.calls.length, 0)
  assert.equal(sw.stores.size, 0)
})

test('failed and redirected downloads are not cached', async () => {
  const sw = worker()
  sw.network(() => new Response('missing', { status: 404 }))
  await sw.request('/assets/index-Beh94Zfe.js')
  sw.network(() => { const response = new Response('HTML'); Object.defineProperty(response, 'redirected', { value: true }); return response })
  await sw.request('/assets/index-Beh94Zfe.js')
  assert.equal(sw.stores.get('codexweb-assets-v1').size, 0)
})

test('concurrent insertions bound asset retention without touching the shell or newest asset', async () => {
  const sw = worker()
  await sw.lifecycle('install')
  await Promise.all(Array.from({ length: 270 }, (_, i) => sw.request(`/assets/chunk-${String(i).padStart(8, '0')}.js`)))
  const assets = sw.stores.get('codexweb-assets-v1')
  assert.equal(assets.size, 256)
  assert.equal(assets.has('https://app.test/assets/chunk-00000000.js'), false)
  assert.equal(assets.has('https://app.test/assets/chunk-00000269.js'), true)
  assert.equal(sw.stores.get('codexweb-shell-v3').has('/'), true)
})

test('activation removes old caches while retaining current shell and hashed assets', async () => {
  const sw = worker()
  await sw.lifecycle('install')
  await sw.request('/assets/index-Beh94Zfe.js')
  await sw.caches.open('codexweb-shell-v2')
  await sw.lifecycle('activate')
  assert.deepEqual([...sw.stores.keys()].sort(), ['codexweb-assets-v1', 'codexweb-shell-v3'])
})
