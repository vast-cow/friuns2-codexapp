import WebSocket from 'ws'

export function resolveAppServerUrl(cli?: string, env = process.env.CODEXUI_APP_SERVER_URL): string {
  const value = cli ?? env ?? 'ws://127.0.0.1:4500'
  const url = new URL(value)
  if (!['ws:', 'wss:'].includes(url.protocol) || url.hash || url.username || url.password) {
    throw new Error('App-server URL must use ws:// or wss:// without credentials or a fragment')
  }
  return url.href
}

/** One shared handshake per connection; never replays an application request. */
export class AppServerWebSocketClient {
  private socket: WebSocket | null = null
  private ready: Promise<void> | null = null
  private reconnecting: Promise<void> | null = null
  private nextId = 1
  private disposed = false
  private pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void }>()
  constructor(private message: (frame: string) => void, private disconnected: () => void,
    private url = resolveAppServerUrl(), private timeoutMs = 10_000) {}

  private fail(socket: WebSocket, error: Error): void {
    if (this.socket !== socket) return
    this.socket = null
    this.ready = null
    for (const request of this.pending.values()) request.reject(error)
    this.pending.clear()
    this.disconnected()
    socket.terminate()
  }

  connect(): Promise<void> {
    if (this.disposed) return Promise.reject(new Error('App-server client disposed'))
    if (this.ready) return this.ready
    const socket = new WebSocket(this.url, { handshakeTimeout: this.timeoutMs })
    this.socket = socket
    this.ready = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => this.fail(socket, new Error(`App-server connection/initialization timed out: ${this.url}`)), this.timeoutMs)
      const id = this.nextId++
      this.pending.set(id, {
        resolve: () => { clearTimeout(timer); try { this.send({ method: 'initialized' }); resolve() } catch (error) { reject(error); this.fail(socket, error as Error) } },
        reject: (error) => { clearTimeout(timer); reject(error) },
      })
      socket.on('open', () => this.send({ id, method: 'initialize', params: {
        clientInfo: { name: 'codex-web-local', version: '0.1.0' }, capabilities: { experimentalApi: true },
      } }))
      socket.on('message', (data, binary) => {
        if (this.socket !== socket) return
        if (binary) { this.fail(socket, new Error('Expected app-server text frame')); return }
        try {
          const frame = JSON.parse(data.toString())
          if (!frame.method && this.pending.has(frame.id)) {
            const request = this.pending.get(frame.id)!
            this.pending.delete(frame.id)
            if (frame.error) { request.reject(new Error(frame.error.message)); this.fail(socket, new Error('App-server initialization rejected')) }
            else request.resolve(frame.result)
          } else this.message(data.toString())
        } catch { this.fail(socket, new Error('Invalid app-server JSON frame')) }
      })
      socket.on('error', (error) => this.fail(socket, new Error(`Cannot connect to app-server ${this.url}: ${error.message}`)))
      socket.on('close', () => this.fail(socket, new Error(`App-server disconnected: ${this.url}. Retry the operation to reconnect; check whether the previous turn was accepted.`)))
    })
    return this.ready
  }

  send(payload: Record<string, unknown>): void {
    const socket = this.socket
    if (!socket || socket.readyState !== WebSocket.OPEN) throw new Error('App-server is disconnected; retry to reconnect')
    socket.send(JSON.stringify(payload), (error) => { if (error) this.fail(socket, error) })
  }

  reconnect(): Promise<void> {
    if (this.reconnecting) return this.reconnecting
    if (this.socket) this.fail(this.socket, new Error('App-server connection reset'))
    this.reconnecting = this.connect().finally(() => { this.reconnecting = null })
    return this.reconnecting
  }

  dispose(): void {
    this.disposed = true
    if (this.socket) this.fail(this.socket, new Error('App-server client disposed'))
  }
}
