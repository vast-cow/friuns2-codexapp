import { describe, expect, it, vi } from 'vitest'
import { readPublicAuthStatus } from './codexCredentials'
const appServer = { rpc: vi.fn() }

describe('public authentication status', () => {
  it('forces token-free parameters and strips credential fields even if Codex returns them', async () => {
    appServer.rpc.mockResolvedValue({ authMethod: 'chatgpt', authToken: 'SECRET', auth_token: 'SECRET', extra: { refreshToken: 'SECRET' }, requiresOpenaiAuth: true })
    const result = await readPublicAuthStatus(appServer, { includeToken: true, refreshToken: true })
    expect(appServer.rpc).toHaveBeenCalledWith('getAuthStatus', { includeToken: false, refreshToken: true })
    expect(result).toEqual({ authMethod: 'chatgpt', authToken: null, requiresOpenaiAuth: true })
    expect(JSON.stringify(result)).not.toContain('SECRET')
  })
})
