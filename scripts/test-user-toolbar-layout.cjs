// Run against the current checkout: pnpm run dev --host 127.0.0.1 --port 4173
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const { mkdirSync } = require('node:fs')
const base = 'http://127.0.0.1:4173'
const output = 'output/playwright'
const html = `<!doctype html><html><body><div id="fixture"></div><script type="module">
import { createApp, h, reactive } from '/node_modules/.vite/deps/vue.js'
import ThreadConversation from '/src/components/content/ThreadConversation.vue'
import '/src/style.css'
const user = (id, text, extras = {}) => ({ id, role: 'user', text, turnId: id, turnIndex: Number(id), ...extras })
window.fixture = reactive({ messages: [
 user('1', 'Hi'),
 user('2', 'A long message that wraps naturally across multiple lines. '.repeat(15)),
 user('3', 'Attached', { submittedAt: '2026-11-05T00:00:00Z', fileAttachments: [{ path: '/tmp/a-very-long-attachment-name-for-layout-checks.txt', label: 'a-very-long-attachment-name-for-layout-checks.txt' }] }),
 user('4', '', { fileAttachments: [{ path: '/tmp/example.txt', label: 'example.txt' }] }),
 { id: 'assistant', role: 'assistant', text: 'Assistant control response', turnId: '4', turnIndex: 4 }
] })
window.rollbacks = []
createApp({ render: () => h(ThreadConversation, { ...window.fixture, pendingRequests: [], liveOverlay: null, isLoading: false, activeThreadId: 'layout-fixture', cwd: '/tmp', onRollback: value => window.rollbacks.push(value) }) }).mount('#fixture')
</script><style>html,body,#fixture { height:100%; margin:0 } #fixture { padding:16px; box-sizing:border-box } html.dark { background:#18181b; color:#eee }</style></body></html>`
;(async () => {
 mkdirSync(output, { recursive: true })
 const browser = await chromium.launch({ headless: true })
 try {
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await context.newPage()
  await page.route('**/__toolbar-layout', route => route.fulfill({ contentType: 'text/html', body: html }))
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  async function check() {
   const rows = await page.locator('.message-body[data-role="user"]').evaluateAll(bodies => bodies.map(body => {
    const toolbar = body.querySelector('.message-toolbar').getBoundingClientRect()
    const content = body.querySelector('.message-card') || body.querySelector('.message-file-attachments')
    const bubble = content.getBoundingClientRect()
    return { delta: toolbar.right - bubble.right, gap: toolbar.top - bubble.bottom, left: toolbar.left, right: toolbar.right }
   }))
   assert.ok(rows.length >= 4)
   for (const row of rows) {
    assert.ok(Math.abs(row.delta) < 1, JSON.stringify(row))
    assert.ok(row.gap >= 4 && row.gap < 80, JSON.stringify(row))
    assert.ok(row.left >= 0 && row.right <= page.viewportSize().width)
   }
   const assistant = page.locator('.message-toolbar[data-role="assistant"]')
   assert.equal(await assistant.evaluate(el => getComputedStyle(el).alignSelf), 'flex-start')
  }
  for (const viewport of [{ width:1280,height:900 }, { width:375,height:812 }, { width:768,height:1024 }]) {
   await page.setViewportSize(viewport)
   if (await page.locator('.message-toolbar').count()) await check()
   for (const theme of ['light', 'dark']) {
    await page.goto(base + '/__toolbar-layout')
    await page.waitForSelector('.message-toolbar')
    await page.evaluate(theme => document.documentElement.classList.toggle('dark', theme === 'dark'), theme)
    await check()
    await page.locator('.conversation-list').evaluate(el => { el.scrollTop = 0 })
    await check()
    await page.evaluate(() => window.fixture.messages.unshift({ id:'0', role:'user', text:'Earlier message', turnId:'0', turnIndex:0 }))
    await check()
    await page.locator('.message-edit-button').first().click()
    assert.equal(await page.evaluate(() => window.rollbacks.length), 1)
    await page.locator('.message-copy-button[data-copied]').first().click()
    await page.waitForSelector('.message-copy-button[data-copied="true"]')
    await page.waitForTimeout(2200)
    await page.screenshot({ path: output + '/user-toolbar-' + viewport.width + '-' + theme + '.png', fullPage:true })
    console.log('PASS', viewport.width, theme, 'alignment, spacing, scrolling, prepend, edit and copy')
   }
  }
  assert.deepEqual(errors, [])
 } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
