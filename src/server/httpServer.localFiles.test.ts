import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer as createHttpServer, type Server } from 'node:http'
import { once } from 'node:events'
import { expect, it, vi } from 'vitest'

vi.mock('./codexAppServerBridge', () => ({
  createCodexBridgeMiddleware: () => Object.assign(
    (_req: unknown, _res: unknown, next: () => void) => next(),
    { dispose() {}, subscribeNotifications: () => () => {} },
  ),
}))

import { createServer } from './httpServer'

it('preserves local navigation, image and edit routes without direct-file serving', async () => {
  const root = await mkdtemp(join(tmpdir(), 'local-file-retirement-'))
  const textPath = join(root, 'example.txt')
  const imagePath = join(root, 'example.svg')
  const text = 'unique-local-file-content'
  const image = '<svg xmlns="http://www.w3.org/2000/svg"/>'
  await mkdir(join(root, 'subdirectory'))
  await writeFile(textPath, text)
  await writeFile(imagePath, image)
  const production = createServer()
  // Load the real dev configuration so both route implementations are exercised.
  const { createServer: createViteServer } = await import('vite')
  const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } })
  const servers: Server[] = []
  try {
    for (const handler of [production.app, vite.middlewares]) {
      const server = createHttpServer(handler)
      servers.push(server)
      server.listen(0, '127.0.0.1')
      await once(server, 'listening')
      const address = server.address() as { port: number }
      const base = 'http://127.0.0.1:' + address.port
      const browse = '/codex-local-browse' + encodeURI(textPath)
      expect(await (await fetch(base + browse)).text()).toBe(text)
      const listing = await fetch(base + '/codex-local-directories?path=' + encodeURIComponent(root))
      expect(listing.status).toBe(200)
      expect(await listing.text()).toContain('subdirectory')
      expect(await (await fetch(base + '/codex-local-browse' + encodeURI(root))).text()).toContain('example.txt')
      const renderedImage = await fetch(base + '/codex-local-image?path=' + encodeURIComponent(imagePath))
      expect(renderedImage.headers.get('content-type')).toContain('image/svg+xml')
      expect(await renderedImage.text()).toBe(image)
      const edit = base + '/codex-local-edit' + encodeURI(textPath)
      expect((await fetch(edit)).status).toBe(200)
      expect((await fetch(edit, { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: text })).status).toBe(200)
      expect(await readFile(textPath, 'utf8')).toBe(text)
      for (const method of ['GET', 'HEAD']) {
        const retired = await fetch(base + '/codex-local-file?path=' + encodeURIComponent(textPath), { method })
        expect(retired.headers.get('content-disposition')).toBeNull()
        expect(await retired.text()).not.toBe(text)
      }
    }
  } finally {
    for (const server of servers) {
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
    await vite.close()
    production.dispose()
    await rm(root, { recursive: true, force: true })
  }
}, 30000)
