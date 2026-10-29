const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const { once } = require('node:events')
const { mkdtempSync, rmSync, existsSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { WebSocket } = require(join(process.cwd(), 'node_modules/ws'))

async function websocket(url, cookie, expectedStatus) {
  await new Promise((resolve, reject) => {
    const ws = new WebSocket(url.replace('http:', 'ws:') + '/codex-api/ws', {
      headers: cookie ? { Cookie: cookie } : {}, handshakeTimeout: 3000,
    })
    ws.on('error', reject)
    ws.on('unexpected-response', (_req, response) => {
      response.resume()
      ws.terminate()
      try { assert.equal(response.statusCode, expectedStatus); resolve() } catch (error) { reject(error) }
    })
    ws.on('open', () => {
      ws.close()
      try { assert.equal(expectedStatus, 101); resolve() } catch (error) { reject(error) }
    })
  })
}

async function run(label, flags, protectedMode) {
  const probe = require('node:net').createServer()
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve))
  const port = String(probe.address().port)
  await new Promise(resolve => probe.close(resolve))
  const home = mkdtempSync(join(tmpdir(), 'codex-password-smoke-'))
  const child = spawn(process.execPath, ['dist-cli/index.js', '--port', port, '--no-open', '--no-tunnel', '--no-login', ...flags], {
    env: { ...process.env, CODEX_HOME: home, CODEXUI_CODEX_COMMAND: '/bin/true' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let log = ''
  child.stdout.on('data', chunk => { log += chunk })
  child.stderr.on('data', chunk => { log += chunk })
  try {
    const url = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { clearInterval(poll); reject(new Error('Startup timeout: ' + log)) }, 15000)
      const poll = setInterval(() => {
        const match = log.match(/Bind:\s+http:\/\/0.0.0.0:(\d+)/)
        if (match) { clearInterval(poll); clearTimeout(timer); resolve('http://127.0.0.1:' + match[1]) }
        else if (child.exitCode !== null) { clearInterval(poll); clearTimeout(timer); reject(new Error(log)) }
      }, 30)
    })
    const page = await (await fetch(url)).text()
    assert.equal(page.includes('<form id="f">'), protectedMode)
    assert.equal(existsSync(join(home, 'codexui-password')), false)
    assert.equal(log.includes('Generated password file:'), false)
    assert.equal(log.includes('SMOKE_SECRET'), false)
    await websocket(url, null, protectedMode ? 401 : 101)
    if (protectedMode) {
      const invalid = await fetch(url + '/auth/login', {
        method: 'POST', body: JSON.stringify({password: 'wrong'}), headers: {'Content-Type':'application/json'},
      })
      assert.equal(invalid.status, 401)
      const login = await fetch(url + '/auth/login', {
        method: 'POST', body: JSON.stringify({password: 'SMOKE_SECRET'}), headers: {'Content-Type':'application/json'},
      })
      assert.equal(login.status, 200)
      const cookie = login.headers.get('set-cookie').split(';')[0]
      const page = await (await fetch(url, {headers: {cookie}})).text()
      assert.equal(page.includes('<form id="f">'), false)
      assert.ok(page.includes('<div id="app">'))
      await websocket(url, cookie, 101)
    } else assert.ok(page.includes('<div id="app">'))
    console.log('PASS ' + label + ': HTTP, WebSocket, password-file/output checks (' + url + ')')
  } finally {
    if (child.exitCode === null) { const exit = once(child, 'exit'); child.kill('SIGTERM'); await exit }
    rmSync(home, {recursive: true, force: true})
  }
}
(async () => {
  await run('default', [], false)
  await run('explicit --no-password', ['--no-password'], false)
  await run('explicit --password', ['--password', 'SMOKE_SECRET'], true)
  await run('password overrides earlier no-password', ['--no-password', '--password', 'SMOKE_SECRET'], true)
  await run('no-password overrides earlier password', ['--password', 'SMOKE_SECRET', '--no-password'], false)
})().catch(error => { console.error(error); process.exitCode = 1 })
