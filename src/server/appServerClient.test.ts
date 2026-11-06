import { expect, it, vi } from 'vitest'
import { WebSocketServer } from 'ws'
import { AppServerClient } from './codexAppServerBridge'

it('correlates concurrent replies and colliding server IDs, clears pending calls, and restores subscriptions once', async () => {
  const server = new WebSocketServer({ port: 0, host: '127.0.0.1' })
  await new Promise<void>(resolve => server.once('listening', resolve))
  const address = server.address() as { port: number }
  vi.stubEnv('CODEXUI_APP_SERVER_URL', `ws://127.0.0.1:${address.port}`)
  const frames: any[] = []
  let connections = 0
  server.on('connection', socket => {
    connections++
    socket.on('message', raw => {
      const frame = JSON.parse(raw.toString()); frames.push(frame)
      if (frame.method === 'initialize') socket.send(JSON.stringify({ id: frame.id, result: {} }))
      else if (frame.method === 'test/collision') {
        socket.send(JSON.stringify({ id: frame.id, method: 'test/approval', params: {} }))
        socket.send(JSON.stringify({ method: 'test/notification', params: {} }))
        socket.send(JSON.stringify({ id: frame.id, result: 'reply' }))
      } else if (['thread/start', 'thread/resume'].includes(frame.method)) {
        socket.send(JSON.stringify({ id: frame.id, result: { thread: { id: 'test-thread', turns: [] } } }))
      } else if (frame.method === 'test/pending') socket.close()
    })
  })
  const client = new AppServerClient()
  const notifications: any[] = []
  const unsubscribe = client.onNotification(value => notifications.push(value))
  try {
    expect(await Promise.all([client.rpc('test/collision', {}), client.rpc('test/collision', {})])).toEqual(['reply', 'reply'])
    expect(connections).toBe(1)
    expect(frames.filter(f => f.method === 'initialize')).toHaveLength(1)
    expect(notifications.filter(f => f.method === 'test/notification')).toHaveLength(2)
    expect(client.listPendingServerRequests()).toHaveLength(2)
    const approval = client.listPendingServerRequests()[0]!
    await client.respondToServerRequest({ id: approval.id, result: { decision: 'accept' } })
    await client.rpc('thread/start', {})
    await expect(client.rpc('test/pending', {})).rejects.toThrow('disconnected')
    expect(client.listPendingServerRequests()).toEqual([])
    await Promise.all([client.reconnect(), client.reconnect()])
    expect(connections).toBe(2)
    expect(frames.filter(f => f.method === 'thread/resume')).toHaveLength(1)
    expect(frames.filter(f => f.method === 'test/pending')).toHaveLength(1)
    await expect(client.respondToServerRequest({ id: approval.id, result: {} })).rejects.toThrow('No pending')
    client.dispose()
    expect(server.address()).toBeTruthy()
  } finally {
    unsubscribe(); client.dispose(); vi.unstubAllEnvs()
    for (const socket of server.clients) socket.terminate()
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
})
