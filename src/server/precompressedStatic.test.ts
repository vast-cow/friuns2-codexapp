import { afterAll, beforeAll, expect, it } from 'vitest'
import express from 'express'
import { request } from 'node:http'
import { mkdtemp, writeFile, rm, readFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { createRequire } from 'node:module'
import { decompress } from '@bokuweb/zstd-wasm'
import { precompressedStatic, sendPrecompressed } from './precompressedStatic'
const require = createRequire(import.meta.url)
const { precompress } = require('../../scripts/precompress-assets.cjs')
let root: string
let server: ReturnType<ReturnType<typeof express>['listen']>
let port: number
const content = '<html>compression test</html>'.repeat(100)
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'precompress-'))
  await writeFile(join(root, 'index.html'), content)
  await writeFile(join(root, 'app.js'), 'const text = "hello";'.repeat(100))
  await mkdir(join(root, 'assets'), { recursive: true })
  await mkdir(join(root, '.vite'), { recursive: true })
  await writeFile(join(root, 'assets/app-Abcd123_.js'), 'const built = true;'.repeat(100))
  await writeFile(join(root, 'assets/manual-Abcd123_.js'), 'const manual = true;')
  await writeFile(join(root, 'sw.js'), '// retirement worker')
  await writeFile(join(root, '.vite/manifest.json'), JSON.stringify({
    'index.html': { file: 'assets/app-Abcd123_.js' },
    publicScript: { file: 'app.js' },
  }))
  await precompress(root)
  await writeFile(join(root, 'plain.txt'), 'uncompressed')
  const app = express()
  app.get('/codex-api/test', (_req, res) => res.set('Cache-Control', 'private, no-store').json({ ok: true }))
  app.get('/auth/test', (_req, res) => res.status(401).end())
  app.get('/local/test', (_req, res) => res.set('Cache-Control', 'private, max-age=300').send('local'))
  app.use('/legacy', precompressedStatic(join(root, 'assets')))
  app.use(precompressedStatic(root))
  app.use((req, res, next) => sendPrecompressed(req, res, next, join(root, 'index.html')))
  server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  port = (server.address() as { port: number }).port
})
afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  await rm(root, { recursive: true, force: true })
})
function get(encoding?: string, path = '/', method = 'GET', extra = {}) {
  return new Promise<{ status: number, headers: import('node:http').IncomingHttpHeaders, body: Buffer }>((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method, headers: { ...(encoding === undefined ? {} : { 'Accept-Encoding': encoding }), ...extra } }, res => {
      const chunks: Buffer[] = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, body: Buffer.concat(chunks) }))
    })
    req.on('error', reject)
    req.end()
  })
}
it.each([
  ['zstd, gzip', 'zstd'], ['gzip', 'gzip'],
  ['gzip;q=1, zstd;q=0.5', 'gzip'], ['zstd;q=0, gzip', 'gzip'],
  ['br', undefined], [undefined, undefined], ['*', 'zstd'],
  ['*;q=1,zstd;q=0', 'gzip'], ['identity;q=1,gzip;q=0.5', undefined],
  ['*;q=0,gzip;q=1', 'gzip'],
])('negotiates %s', async (header, encoding) => {
  const response = await get(header)
  expect(response.status).toBe(200)
  expect(response.headers['content-encoding']).toBe(encoding)
  expect(response.headers.vary).toBe('Accept-Encoding')
  expect(response.headers['content-type']).toContain('text/html')
  expect(Number(response.headers['content-length'])).toBe(response.body.length)
  const decoded = encoding === 'gzip' ? gunzipSync(response.body) : encoding === 'zstd' ? Buffer.from(decompress(response.body)) : response.body
  expect(decoded.toString()).toBe(content)
})
it('falls back for missing sidecars and refuses unacceptable representations', async () => {
  expect((await get('zstd,gzip', '/plain.txt')).body.toString()).toBe('uncompressed')
  expect((await get('zstd,identity;q=0', '/plain.txt')).status).toBe(406)
  expect((await get('*;q=0')).status).toBe(406)
})
it('serves SPA routes, JavaScript MIME, HEAD and representation-specific validators', async () => {
  expect((await get('zstd', '/thread/example')).headers['content-encoding']).toBe('zstd')
  expect((await get('gzip', '/app.js')).headers['content-type']).toMatch(/javascript/)
  const gzip = await get('gzip')
  const head = await get('gzip', '/', 'HEAD')
  expect(head.body.length).toBe(0)
  expect(head.headers['content-length']).toBe(gzip.headers['content-length'])
  expect(head.headers.etag).toBe(gzip.headers.etag)
  expect(gzip.headers['cache-control']).toBe('no-cache')
  expect((await get('gzip', '/', 'GET', { 'If-None-Match': gzip.headers.etag })).status).toBe(304)
  expect((await get('identity', '/', 'GET', { 'If-None-Match': gzip.headers.etag })).status).toBe(200)
})
it('keeps originals and skips binary assets', async () => {
  expect((await readFile(join(root, 'index.html'))).toString()).toBe(content)
  await writeFile(join(root, 'image.png'), Buffer.from([1, 2, 3]))
  await precompress(root)
  await expect(readFile(join(root, 'image.png.gz'))).rejects.toThrow()
  await expect(readFile(join(root, 'image.png.zst'))).rejects.toThrow()
})

it.each(['identity', 'gzip', 'zstd'])('caches only build-generated JavaScript with %s', async encoding => {
  const path = '/assets/app-Abcd123_.js'
  const response = await get(encoding, path + '?v=1')
  expect(response.status).toBe(200)
  expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable')
  expect(response.headers['content-type']).toMatch(/javascript/)
  expect(response.headers['content-encoding']).toBe(encoding === 'identity' ? undefined : encoding)
  expect(response.headers.vary).toBe('Accept-Encoding')
  const head = await get(encoding, path, 'HEAD')
  expect(head.body.length).toBe(0)
  expect(head.headers['cache-control']).toBe(response.headers['cache-control'])
  expect(head.headers['content-length']).toBe(response.headers['content-length'])
  const fresh = await get(encoding, path, 'GET', { 'If-None-Match': response.headers.etag })
  expect(fresh.status).toBe(304)
  expect(fresh.headers['cache-control']).toBe(response.headers['cache-control'])
  const otherEncoding = encoding === 'identity' ? 'gzip' : 'identity'
  expect((await get(otherEncoding, path, 'GET', { 'If-None-Match': response.headers.etag })).status).toBe(200)
  for (const path of ['/app.js', '/sw.js', '/assets/manual-Abcd123_.js', '/legacy/app-Abcd123_.js', '/plain.txt']) {
    expect((await get(encoding, path)).headers['cache-control']).toBe('public, max-age=0')
  }
  for (const path of ['/', '/index.html', '/thread/example', '/missing-Abcd123_.js']) {
    expect((await get(encoding, path)).headers['cache-control']).toBe('no-cache')
  }
})
it('preserves policies on non-static routes and hides the manifest', async () => {
  expect((await get(undefined, '/codex-api/test')).headers['cache-control']).toBe('private, no-store')
  const auth = await get(undefined, '/auth/test')
  expect(auth.status).toBe(401)
  expect(auth.headers['cache-control']).toBeUndefined()
  expect((await get(undefined, '/local/test')).headers['cache-control']).toBe('private, max-age=300')
  expect((await get(undefined, '/.vite/manifest.json')).headers['content-type']).toContain('text/html')
})
