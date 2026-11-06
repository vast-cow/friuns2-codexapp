import { afterEach, expect, it } from 'vitest'
import { WebSocketServer } from 'ws'
import { AppServerWebSocketClient, resolveAppServerUrl } from './appServerWebSocketClient'
const cleanup: (() => void)[] = []
afterEach(() => cleanup.splice(0).forEach(fn => fn()))
async function fixture(initialize = true) {
  const server = new WebSocketServer({ port: 0, host: '127.0.0.1' })
  await new Promise<void>(resolve => server.once('listening', resolve))
  cleanup.push(() => { for (const socket of server.clients) socket.terminate(); server.close() })
  const frames: any[] = []
  let connections = 0
  server.on('connection', socket => {
    connections++
    socket.on('message', data => {
      const frame = JSON.parse(data.toString()); frames.push(frame)
      if (frame.method === 'initialize' && initialize) socket.send(JSON.stringify({ id: frame.id, result: {} }))
    })
  })
  const address = server.address() as { port: number }
  return { server, frames, count: () => connections, url: `ws://127.0.0.1:${address.port}` }
}
it('resolves precedence and validates URLs', () => {
  expect(resolveAppServerUrl(undefined, undefined)).toBe('ws://127.0.0.1:4500/')
  expect(resolveAppServerUrl(undefined, 'wss://example.org')).toBe('wss://example.org/')
  expect(resolveAppServerUrl('ws://localhost:123', 'bad')).toBe('ws://localhost:123/')
  expect(() => resolveAppServerUrl('http://localhost')).toThrow()
})
it('shares initialization, preserves frames, reconnects and leaves server alive after disposal', async () => {
  const f = await fixture(); const received: string[] = []; let disconnected = 0
  const client = new AppServerWebSocketClient(frame => received.push(frame), () => disconnected++, f.url)
  cleanup.push(() => client.dispose())
  await Promise.all([client.connect(), client.connect(), client.connect()])
  client.send({ id: 22, method: 'thread/list', params: {} })
  const socket = [...f.server.clients][0]!
  socket.send(JSON.stringify({ method: 'turn/started', params: {} }))
  socket.send(JSON.stringify({ id: 'approval', method: 'item/commandExecution/requestApproval' }))
  await new Promise(resolve => setTimeout(resolve, 20))
  expect(f.count()).toBe(1)
  expect(f.frames.map(f => f.method)).toEqual(['initialize', 'initialized', 'thread/list'])
  expect(f.frames.every(f => !('jsonrpc' in f))).toBe(true)
  expect(received).toHaveLength(2)
  client.send({ id: 'approval', result: { decision: 'accept' } })
  await client.reconnect()
  expect(disconnected).toBe(1)
  expect(f.count()).toBe(2)
  client.dispose()
  expect(f.server.address()).toBeTruthy()
  await expect(client.connect()).rejects.toThrow('disposed')
})
it('bounds initialization and allows a new connection after failure', async () => {
  const f = await fixture(false)
  let failures = 0
  const client = new AppServerWebSocketClient(() => {}, () => failures++, f.url, 30)
  cleanup.push(() => client.dispose())
  await expect(client.connect()).rejects.toThrow('timed out')
  await expect(client.connect()).rejects.toThrow('timed out')
  expect(failures).toBe(2)
})
it('reports refused connections without spawning a fallback', async () => {
  const client = new AppServerWebSocketClient(() => {}, () => {}, 'ws://127.0.0.1:1', 100)
  await expect(client.connect()).rejects.toThrow('Cannot connect')
  client.dispose()
})
