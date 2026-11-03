import { describe, expect, it } from 'vitest'
import { buildTextWithAttachments } from './attachmentPrompt'

const attachment = (label: string) => ({ label, path: `/uploads/${label}` })

describe('attachment prompt requests', () => {
  it.each(['pasted-text-2026-11-04-12-00-00.txt', 'notes.txt'])(
    'keeps a meaningful request after the attachment prefix for %s', (name) => {
      expect(buildTextWithAttachments('', [attachment(name)])).toBe(
        `# Files mentioned by the user:\n\n## ${name}: /uploads/${name}\n\n## My request for Codex:\n\nAttached file: ${name}\n`,
      )
    },
  )

  it('treats whitespace-only requests as empty', () => {
    expect(buildTextWithAttachments(' \n\t ', [attachment('notes.txt')]))
      .toContain('## My request for Codex:\n\nAttached file: notes.txt\n')
  })

  it('preserves authored request whitespace and multiline text exactly', () => {
    const request = '  Read these notes.\n\n  Keep this indentation.\n '
    expect(buildTextWithAttachments(request, [attachment('notes.txt')]))
      .toContain(`## My request for Codex:\n\n${request}\n`)
  })

  it('names multiple attachments', () => {
    expect(buildTextWithAttachments('', [attachment('one.txt'), attachment('two.txt')]))
      .toContain('## My request for Codex:\n\nAttached files: one.txt, two.txt\n')
  })

  it('bounds the summary while retaining every original file reference', () => {
    const files = [attachment('a'.repeat(100) + '.txt'), attachment('b.txt'), attachment('c.txt'), attachment('d.txt')]
    const prompt = buildTextWithAttachments('', files)
    expect(prompt).toContain(`## ${files[0]!.label}: ${files[0]!.path}\n`)
    expect(prompt).toContain('## d.txt: /uploads/d.txt\n')
    expect(prompt).toContain(`Attached files: ${'a'.repeat(77)}..., b.txt, c.txt (+1 more)\n`)
  })

  it('uses the path basename when a label is empty', () => {
    expect(buildTextWithAttachments('', [{ label: '', path: 'C:\\uploads\\notes.txt' }]))
      .toContain('Attached file: notes.txt\n')
  })

  it.each(['hello', '  hello\nworld\n ', '', ' \n\t'])('leaves text without attachments unchanged: %j', (text) => {
    expect(buildTextWithAttachments(text, [])).toBe(text)
  })
})
