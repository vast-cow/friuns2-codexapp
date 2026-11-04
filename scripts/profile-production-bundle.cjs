const { chromium } = require('playwright')
const fs = require('node:fs')
const path = require('node:path')
const { gzipSync } = require('node:zlib')

async function main() {
  const root = path.resolve(process.env.PROFILE_DIST || 'dist')
  const base = process.env.PROFILE_BASE_URL || 'http://127.0.0.1:4173'
  const route = process.env.PROFILE_ROUTE || '/'
  const browser = await chromium.launch()
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } })
    const page = await context.newPage()
    const client = await context.newCDPSession(page)
    await client.send('Network.enable')
    await client.send('Network.setCacheDisabled', { cacheDisabled: true })
    const files = new Set()
    const errors = []
    const apiRequests = []
    page.on('pageerror', error => errors.push(String(error)))
    page.on('request', request => {
      const url = new URL(request.url())
      if (url.origin === new URL(base).origin && url.pathname.endsWith('.js')) files.add(url.pathname.slice(1))
      if (url.pathname.startsWith('/codex-api/')) apiRequests.push({ path: url.pathname, body: request.postData() })
    })
    const started = Date.now()
    await page.goto(new URL(route, base).href)
    await page.locator('.thread-composer textarea').waitFor()
    const textarea = page.locator('.thread-composer textarea')
    const textEnabled = await textarea.isEnabled()
    const model = page.locator('.thread-composer .composer-dropdown-trigger').first()
    await page.waitForFunction(() => {
      const control = document.querySelector('.thread-composer .composer-dropdown-trigger')
      return control && !control.disabled
    }, null, { timeout: 15000 }).catch(() => {})
    const modelEnabled = await model.isEnabled()
    const readyMs = Date.now() - started
    await page.waitForTimeout(Number(process.env.PROFILE_WAIT_MS || 7000))
    const assets = [...files].map(file => {
      const body = fs.readFileSync(path.join(root, file))
      return { file, bytes: body.length, gzip: gzipSync(body).length }
    })
    const report = {
      url: page.url(), conditions: { freshContext: true, serviceWorkers: 'blocked', httpCache: 'disabled' },
      textEnabled, modelEnabled, readyMs, errors, apiRequests, assets,
      total: assets.reduce((sum, row) => ({ bytes: sum.bytes + row.bytes, gzip: sum.gzip + row.gzip }), { bytes: 0, gzip: 0 }),
    }
    fs.mkdirSync('output/playwright', { recursive: true })
    fs.writeFileSync('output/playwright/production-bundle.json', JSON.stringify(report, null, 2))
    console.log(JSON.stringify(report, null, 2))
    if (!textEnabled || !modelEnabled || errors.length) process.exitCode = 1
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
