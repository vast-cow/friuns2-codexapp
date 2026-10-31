import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDefaultAutoSelectFamilyAttemptTimeout } from 'node:net'

const { agent, request } = vi.hoisted(() => ({ agent: vi.fn(), request: vi.fn() }))
vi.mock('undici', () => ({ Agent: agent, fetch: request }))

afterEach(() => { vi.resetModules(); vi.clearAllMocks(); vi.unstubAllEnvs() })

describe('Telegram network', () => {
  it('uses a Telegram-only dispatcher with a 3000ms attempt timeout', async () => {
    const { telegramFetch } = await import('./telegramNetwork.js')
    telegramFetch('https://api.telegram.org/botsecret/getUpdates', { method: 'POST' })
    expect(agent).toHaveBeenCalledWith({ connect: { autoSelectFamily: true, autoSelectFamilyAttemptTimeout: 3000 } })
    expect(request).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ method: 'POST', dispatcher: expect.anything() }))
  })

  it('respects an explicit Node timeout override', async () => {
    vi.stubEnv('NODE_OPTIONS', '--network-family-autoselection-attempt-timeout=5000')
    await import('./telegramNetwork.js')
    expect(agent).toHaveBeenCalledWith({ connect: expect.objectContaining({ autoSelectFamilyAttemptTimeout: getDefaultAutoSelectFamilyAttemptTimeout() }) })
  })

  it('redacts credentials from stored errors', async () => {
    const { redactTelegramError } = await import('./telegramNetwork.js')
    expect(redactTelegramError('failed https://api.telegram.org/bot123456:secret/send and 123456:secret')).toBe('failed [redacted URL] and [redacted token]')
  })

  it('reports nested connection errors without messages, URLs or tokens', async () => {
    const { telegramNetworkErrorDetails } = await import('./telegramNetwork.js')
    const error = { message: 'secret', cause: { errors: [
      { code: 'ETIMEDOUT', syscall: 'connect', address: '149.154.166.110', port: 443, message: 'bot123:secret' },
      { code: 'ENETUNREACH', syscall: 'connect', address: '2001:67c:4e8:f004::9', port: 443 },
    ] } }
    expect(telegramNetworkErrorDetails(error)).toEqual({ cause: { errors: [
      { code: 'ETIMEDOUT', syscall: 'connect', address: '149.154.166.110', port: 443 },
      { code: 'ENETUNREACH', syscall: 'connect', address: '2001:67c:4e8:f004::9', port: 443 },
    ] } })
    expect(JSON.stringify(telegramNetworkErrorDetails(error))).not.toContain('secret')
  })
})
