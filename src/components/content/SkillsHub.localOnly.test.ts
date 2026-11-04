import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { expect, it, vi } from 'vitest'

// Execute the actual SFC handler without mounting unrelated directory UI.
const source = readFileSync(new URL('./SkillsHub.vue', import.meta.url), 'utf8').split('<script setup lang="ts">')[1]!.split('</script>')[0]!
const ast = ts.createSourceFile('SkillsHub.ts', source, ts.ScriptTarget.Latest, true)
const handler = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'handleToggleEnabled')!
const code = ts.transpileModule(handler.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText

it.each([true, false])('sets local skill enabled=%s with no sync request', async (enabled) => {
  const fetch = vi.fn(async () => ({ ok: true }))
  const fetchSkills = vi.fn(async () => {})
  const showToast = vi.fn()
  const toggle = new Function('fetch', 'fetchSkills', 'showToast', `${code}; return handleToggleEnabled`)(fetch, fetchSkills, showToast)
  await toggle({ path: '/local/skills/sample/SKILL.md', name: 'sample' }, enabled)
  expect(fetch).toHaveBeenCalledExactlyOnceWith('/codex-api/rpc', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method: 'skills/config/write', params: { path: '/local/skills/sample/SKILL.md', enabled } }),
  })
  expect(fetchSkills).toHaveBeenCalledOnce()
  expect(showToast).toHaveBeenCalledWith(`sample skill ${enabled ? 'enabled' : 'disabled'}`)
})

it('does not reload or sync when the local update fails', async () => {
  const fetch = vi.fn(async () => ({ ok: false }))
  const fetchSkills = vi.fn()
  const showToast = vi.fn()
  const toggle = new Function('fetch', 'fetchSkills', 'showToast', `${code}; return handleToggleEnabled`)(fetch, fetchSkills, showToast)
  await toggle({ path: '/sample/SKILL.md', name: 'sample' }, true)
  expect(fetch).toHaveBeenCalledOnce()
  expect(fetchSkills).not.toHaveBeenCalled()
  expect(showToast).toHaveBeenCalledWith('Failed to update skill', 'error')
})
