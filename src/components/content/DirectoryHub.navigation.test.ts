import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { expect, it } from 'vitest'

const source = readFileSync(new URL('./DirectoryHub.vue', import.meta.url), 'utf8').split('<script setup lang="ts">')[1]!.split('</script>')[0]!
const ast = ts.createSourceFile('DirectoryHub.ts', source, ts.ScriptTarget.Latest, true)
const declarations = ast.statements.filter((node) =>
  (ts.isFunctionDeclaration(node) && ['isDirectoryTab', 'tabFromRoute'].includes(node.name?.text ?? '')) ||
  (ts.isVariableStatement(node) && node.declarationList.declarations.some((entry) => entry.name.getText(ast) === 'tabs')),
).map((node) => node.getText(ast)).join('\n')
const code = ts.transpileModule(declarations, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText

it.each(['skills', 'plugins', 'apps'])('supports the %s tab and preserves only independent sections', (tab) => {
  const result = new Function('route', `${code}; return { tab: tabFromRoute(), tabs }`)({ query: { tab } })
  expect(result.tab).toBe(tab)
  expect(result.tabs.map((entry: { id: string }) => entry.id)).toEqual(['plugins', 'apps', 'skills'])
})
it.each(['composio', 'unknown', undefined, ['plugins']])('falls back to Skills for stale or invalid tab %s', (tab) => {
  expect(new Function('route', `${code}; return tabFromRoute()` )({ query: { tab } })).toBe('skills')
})
