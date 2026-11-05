import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, it, vi } from 'vitest'

it('retires legacy caches and registration without intercepting requests or reloading tabs', async () => {
  const handlers: Record<string, (event: { waitUntil: (promise: Promise<unknown>) => void }) => void> = {}
  const remove = vi.fn(async (_key: string) => true)
  const claim = vi.fn(async () => {})
  const unregister = vi.fn(async () => true)
  const skipWaiting = vi.fn(async () => {})
  runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), {
    self: {
      addEventListener: (type: string, handler: typeof handlers[string]) => { handlers[type] = handler },
      skipWaiting, clients: { claim }, registration: { unregister },
    },
    caches: { keys: async () => ['codexweb-shell-v2', 'codexweb-shell-v3', 'codexweb-assets-v1', 'other-app'], delete: remove },
  })
  const lifecycle = async (name: string) => {
    const pending: Promise<unknown>[] = []
    handlers[name]!({ waitUntil: promise => { pending.push(promise) } })
    await Promise.all(pending)
  }
  await lifecycle('install')
  await lifecycle('activate')
  expect(skipWaiting).toHaveBeenCalledOnce()
  expect(remove.mock.calls.map(call => call[0])).toEqual(['codexweb-shell-v2', 'codexweb-shell-v3', 'codexweb-assets-v1'])
  expect(claim).toHaveBeenCalledOnce()
  expect(unregister).toHaveBeenCalledOnce()
  expect(Object.keys(handlers).sort()).toEqual(['activate', 'install'])
})
