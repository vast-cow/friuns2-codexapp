type PromptAttachment = { label: string; path: string }

export function buildTextWithAttachments(prompt: string, files: readonly PromptAttachment[]): string {
  if (files.length === 0) return prompt
  let prefix = '# Files mentioned by the user:\n'
  for (const file of files) {
    prefix += `\n## ${file.label}: ${file.path}\n`
  }
  const request = prompt.trim() ? prompt : ''
  return `${prefix}\n## My request for Codex:\n\n${request}\n`
}
