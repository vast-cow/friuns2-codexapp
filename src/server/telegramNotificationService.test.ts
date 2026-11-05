import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { Response } from 'undici'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { TelegramNotificationService } from './telegramNotificationService.js'
import { normalizeTelegramCompletionConfig } from '../telegramCompletionConfig.js'
import { telegramFetch } from './telegramNetwork.js'
vi.mock('./telegramNetwork.js', () => ({ telegramFetch: vi.fn(), redactTelegramError: (s: string) => s, telegramNetworkErrorDetails: () => ({}) }))
const services: TelegramNotificationService[] = []
const dirs: string[] = []
afterEach(async () => {
  services.splice(0).forEach(s => s.stop())
  await Promise.all(dirs.splice(0).map(d => rm(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })))
  vi.clearAllMocks()
})
async function setup(path?: string) {
  const dir = await mkdtemp(join(tmpdir(), 'telegram-service-')); dirs.push(dir)
  const listeners = new Set<(v: { method: string; params: unknown }) => void>()
  const rpc = vi.fn(async () => ({ thread: { name: 'Example task' } }))
  const outboxPath = path ?? join(dir, 'outbox.json')
  const service = new TelegramNotificationService({ rpc, onNotification: cb => { listeners.add(cb); return () => { listeners.delete(cb) } } }, { outboxPath })
  services.push(service)
  service.configureToken('123:secret')
  service.configureCompletionNotifications({ enabled: true, chatIds: [-123], appUrl: 'https://example.com' })
  vi.mocked(telegramFetch).mockImplementation(async () => new Response(JSON.stringify({ ok: true })))
  return { service, listeners, rpc, outboxPath, emit: (id: string, status = 'completed') => listeners.forEach(cb => cb({ method: 'turn/completed', params: { threadId: 'thread', turn: { id, status } } })) }
}
it('delivers browser and queued completions once, retaining receipts across restart', async () => {
  const first = await setup()
  first.emit('browser'); first.emit('browser'); first.emit('queued')
  await vi.waitFor(() => expect(telegramFetch).toHaveBeenCalledTimes(2), { timeout: 6000 })
  await vi.waitFor(async () => expect(JSON.parse(await readFile(first.outboxPath, 'utf8')).settled).toHaveLength(2))
  expect(first.rpc).toHaveBeenCalledWith('thread/read', { threadId: 'thread', includeTurns: false })
  const [url, options] = vi.mocked(telegramFetch).mock.calls[0]!
  expect(String(url)).toMatch(/\/sendMessage$/)
  const message = JSON.parse(String(options?.body))
  expect(message.chat_id).toBe(-123)
  expect(message.text).toContain('Codex turn completed')
  expect(message.text).toContain('Example task')
  expect(message.text).toContain('https://example.com/#/thread/thread')
  first.service.stop()
  const restarted = await setup(first.outboxPath)
  restarted.emit('browser')
  await new Promise(r => setTimeout(r, 150))
  expect(telegramFetch).toHaveBeenCalledTimes(2)
})
it('ignores failed/interrupted events and performs no work when disabled', async () => {
  const s = await setup()
  s.emit('failed', 'failed'); s.emit('interrupted', 'interrupted')
  s.service.configureCompletionNotifications({ enabled: false, chatIds: [-123] })
  expect(s.listeners.size).toBe(0)
  s.emit('disabled')
  await new Promise(r => setTimeout(r, 100))
  expect(telegramFetch).not.toHaveBeenCalled()
  expect(s.rpc).not.toHaveBeenCalled()
  await s.service.sendTestNotification()
  expect(telegramFetch).toHaveBeenCalledTimes(1)
})
it('normalizes legacy completion settings without using legacy allowlists or chat lists', () => {
  expect(normalizeTelegramCompletionConfig({ enabled: true, chatIds: [123, 456], statuses: ['failed'], appUrl: 'https://example.com/#/old' }))
    .toEqual({ enabled: true, chatIds: [123], appUrl: 'https://example.com' })
  expect(normalizeTelegramCompletionConfig({ allowedUserIds: [123] }).enabled).toBe(false)
})
