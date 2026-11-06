import type { IncomingMessage, ServerResponse } from 'node:http'

export async function handleAccountRoutes(req: IncomingMessage, res: ServerResponse, url: URL, _context: unknown): Promise<boolean> {
  if (req.method !== 'POST' || !url.pathname.startsWith('/codex-api/accounts/login/')) return false
  res.statusCode = 409
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify({ error: 'external_authentication', message: 'Authentication is managed by the external Codex app-server. Run codex login in its environment, then reconnect using POST /codex-api/reconnect.' }))
  return true
}
