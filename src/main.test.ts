import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { expect, it, vi } from 'vitest'

it('mounts without intercepting fetch or collecting global errors and preserves service-worker failure logging', async () => {
  const source = readFileSync(new URL('./main.ts', import.meta.url), 'utf8')
  const ast = ts.createSourceFile('main.ts', source, ts.ScriptTarget.Latest, true)
  let script = source
  for (const node of [...ast.statements].reverse()) {
    if (ts.isImportDeclaration(node)) script = script.slice(0, node.getFullStart()) + script.slice(node.end)
  }
  script = script.replace('import.meta.env.PROD', 'true')
  const code = ts.transpileModule(script, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const fetch = vi.fn()
  const addEventListener = vi.fn()
  const window = { fetch, addEventListener }
  const failure = new Error('registration fixture')
  const register = vi.fn(async () => { throw failure })
  const console = { log: vi.fn(), error: vi.fn() }
  const mount = vi.fn()
  const use = vi.fn(() => ({ mount }))
  new Function('createApp', 'App', 'router', 'navigator', 'window', 'console', 't', code)(
    () => ({ use }), {}, {}, { serviceWorker: { register } }, window, console, (text: string) => text,
  )
  expect(mount).toHaveBeenCalledExactlyOnceWith('#app')
  expect(window.fetch).toBe(fetch)
  expect(fetch).not.toHaveBeenCalled()
  expect(addEventListener).toHaveBeenCalledOnce()
  expect(addEventListener.mock.calls[0]?.[0]).toBe('load')
  addEventListener.mock.calls[0]![1]()
  await Promise.resolve()
  expect(console.error).toHaveBeenCalledExactlyOnceWith('Service worker registration failed.', failure)
})
