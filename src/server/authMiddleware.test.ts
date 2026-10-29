import { EventEmitter } from 'node:events'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { IncomingMessage } from 'node:http'
import type { Request, Response } from 'express'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAuthSession } from './authMiddleware.js'

let home: string
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'codexapp-auth-'))
  vi.stubEnv('CODEX_HOME', home)
})
afterEach(() => {
  vi.unstubAllEnvs()
  rmSync(home, { recursive: true, force: true })
})

function request(remoteAddress: string, cookie?: string) {
  return Object.assign(new EventEmitter(), {
    socket: { remoteAddress }, headers: { host: 'localhost:5900', cookie },
    method: 'GET', path: '/', setEncoding: vi.fn(),
  }) as unknown as Request
}
function response() {
  return { setHeader: vi.fn(), status: vi.fn().mockReturnThis(),
    send: vi.fn(), json: vi.fn(), redirect: vi.fn() } as unknown as Response
}

describe('password authentication without IP bypass', () => {
  it.each(['127.0.0.1', '::1', '::ffff:127.0.0.1', '100.64.0.1',
    '100.127.255.254', '::ffff:100.64.0.1', 'fd7a:115c:a1e0::1',
    'fd7a:115c:a1e0:abcd::2', '192.168.1.2', '203.0.113.1'])('requires a session for %s', (ip) => {
    const auth = createAuthSession('secret')
    const req = request(ip)
    const res = response()
    const next = vi.fn()
    auth.middleware(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('name="password"'))
    expect(auth.isRequestAuthorized(req as IncomingMessage)).toBe(false)
    expect(auth.isRequestAuthorized(request(ip, 'portal_session=invalid'))).toBe(false)
  })

  it('rejects wrong passwords and accepts login cookies for HTTP and WebSocket authorization', () => {
    const auth = createAuthSession('secret')
    for (const password of ['wrong', 'secret']) {
      const req = request('127.0.0.1')
      req.method = 'POST'
      Object.defineProperty(req, 'path', { value: '/auth/login' })
      const res = response()
      auth.middleware(req, res, vi.fn())
      req.emit('data', JSON.stringify({ password }))
      req.emit('end')
      if (password === 'wrong') {
        expect(res.status).toHaveBeenCalledWith(401)
        expect(res.setHeader).not.toHaveBeenCalled()
        continue
      }
      const cookie = vi.mocked(res.setHeader).mock.calls[0]![1] as string
      const authenticated = request('100.64.0.1', cookie.split(';')[0])
      const next = vi.fn()
      auth.middleware(authenticated, response(), next)
      expect(next).toHaveBeenCalledOnce()
      expect(auth.isRequestAuthorized(authenticated)).toBe(true)
      expect(createAuthSession('secret').isRequestAuthorized(authenticated)).toBe(true)
    }
  })
})
