import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

const source = readFileSync(new URL('./DirectoryHub.vue', import.meta.url), 'utf8')
it('retains Skills workflows and MCP inspection without catalog loading', () => {
  expect(source).toContain('<SkillsHub')
  expect(source).toContain('listDirectoryMcpServers()')
  expect(source).toContain('startDirectoryMcpLogin(serverName)')
  expect(source).toContain('reloadDirectoryMcpServers()')
  expect(source).not.toMatch(/plugin\/|app\/list|selectedPlugin|directory-tabs|route.query.tab/)
})
