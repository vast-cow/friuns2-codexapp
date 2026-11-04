const assert = require('node:assert/strict')
const { spawn, spawnSync } = require('node:child_process')
const { once } = require('node:events')
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs')
const { createServer, request } = require('node:http')
const { connect, createServer: createTcpServer } = require('node:net')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { WebSocket } = require(join(process.cwd(), 'node_modules/ws'))

// Build first. All files and processes belong to this isolated smoke run.
async function checkWebSocket(url) {
  const ws = new WebSocket(url.replace('http:', 'ws:') + '/codex-api/ws', { handshakeTimeout: 3000 })
  try {
    const [message] = await once(ws, 'message', { signal: AbortSignal.timeout(5000) })
    assert.equal(JSON.parse(String(message)).method, 'ready')
    const pong = once(ws, 'pong', { signal: AbortSignal.timeout(5000) })
    ws.ping('connectivity-check')
    const [payload] = await pong
    assert.equal(String(payload), 'connectivity-check')
  } finally {
    ws.terminate()
  }
}

async function run() {
  for (const flag of ['--tunnel', '--no-tunnel']) {
    const result = spawnSync(process.execPath, ['dist-cli/index.js', flag], { encoding: 'utf8' })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /unknown option/)
  }
  const home = mkdtempSync(join(tmpdir(), 'codex-connectivity-'))
  const marker = join(home, '.cloudflared-install-prompted')
  writeFileSync(marker, 'existing-user-marker\n')
  const probe = createTcpServer()
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve))
  const port = String(probe.address().port)
  await new Promise(resolve => probe.close(resolve))
  const startedAt = performance.now()
  const child = spawn(process.execPath, ['dist-cli/index.js', '--port', port, '--no-open', '--no-login'], {
    env: { ...process.env, CODEX_HOME: home, CODEXUI_CODEX_COMMAND: '/bin/true' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', chunk => { output += chunk })
  child.stderr.on('data', chunk => { output += chunk })
  let proxy
  const sockets = new Set()
  try {
    const boundPort = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { clearInterval(poll); reject(new Error('Startup timeout: ' + output)) }, 15000)
      const poll = setInterval(() => {
        const match = output.match(/Bind:\s+http:\/\/0.0.0.0:(\d+)/)
        if (match) { clearInterval(poll); clearTimeout(timer); resolve(match[1]) }
        else if (child.exitCode !== null) { clearInterval(poll); clearTimeout(timer); reject(new Error(output)) }
      }, 25)
    })
    assert.equal(boundPort, port)
    const startupMs = Math.round(performance.now() - startedAt)
    const localUrl = 'http://127.0.0.1:' + boundPort
    assert.match(await (await fetch(localUrl)).text(), /<div id="app">/)
    assert.equal((await fetch(localUrl + '/codex-api/home-directory')).status, 200)
    await checkWebSocket(localUrl)

    // Minimal independently managed forwarding proxy, including WebSocket upgrade.
    proxy = createServer((req, res) => {
      const upstream = request({ hostname: '127.0.0.1', port: boundPort, path: req.url, method: req.method,
        headers: { ...req.headers, host: 'private.example', 'x-forwarded-proto': 'https' },
      }, response => { res.writeHead(response.statusCode, response.headers); response.pipe(res) })
      upstream.on('error', error => res.destroy(error))
      req.pipe(upstream)
    })
    proxy.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)) })
    proxy.on('upgrade', (req, socket, head) => {
      const upstream = connect(Number(boundPort), '127.0.0.1', () => {
        upstream.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`)
        for (let index = 0; index < req.rawHeaders.length; index += 2) {
          upstream.write(`${req.rawHeaders[index]}: ${req.rawHeaders[index + 1]}\r\n`)
        }
        upstream.write('X-Forwarded-Proto: https\r\n\r\n')
        if (head.length) upstream.write(head)
        socket.pipe(upstream).pipe(socket)
      })
      socket.on('error', () => upstream.destroy())
      socket.on('close', () => upstream.destroy())
      upstream.on('error', () => socket.destroy())
    })
    await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve))
    const proxyUrl = 'http://127.0.0.1:' + proxy.address().port
    assert.match(await (await fetch(proxyUrl)).text(), /<div id="app">/)
    assert.equal((await fetch(proxyUrl + '/codex-api/home-directory')).status, 200)
    await checkWebSocket(proxyUrl)
    assert.equal(readFileSync(marker, 'utf8'), 'existing-user-marker\n')
    assert.doesNotMatch(output, /cloudflared|trycloudflare|Tunnel:|QR code/i)
    console.log(`PASS local HTTP/API and WebSocket ready/ping/pong: ${localUrl}`)
    console.log(`PASS independent reverse proxy HTTP/API and WebSocket: ${proxyUrl}`)
    console.log(`PASS retired options rejected; legacy marker preserved; no tunnel output; startup ${startupMs}ms`)
  } finally {
    for (const socket of sockets) socket.destroy()
    if (proxy) await new Promise(resolve => proxy.close(resolve))
    if (child.exitCode === null) { const exit = once(child, 'exit'); child.kill('SIGTERM'); await exit }
    rmSync(home, { recursive: true, force: true })
  }
  assert.equal(child.exitCode, 0)
}
run().catch(error => { console.error(error); process.exitCode = 1 })
