type PromptAttachment = { label: string; path: string }

function attachmentOnlyRequest(files: readonly PromptAttachment[]): string {
  const names = files.slice(0, 3).map((file) => {
    const name = file.label.trim() || file.path.replace(/\\/g, '/').split('/').filter(Boolean).at(-1) || 'file'
    const singleLineName = name.replace(/\s+/gu, ' ')
    return singleLineName.length > 80 ? `${singleLineName.slice(0, 77)}...` : singleLineName
  })
  const remaining = files.length > names.length ? ` (+${files.length - names.length} more)` : ''
  return `Attached ${files.length === 1 ? 'file' : 'files'}: ${names.join(', ')}${remaining}`
}

export function buildTextWithAttachments(prompt: string, files: readonly PromptAttachment[]): string {
  if (files.length === 0) return prompt
  let prefix = '# Files mentioned by the user:\n'
  for (const file of files) {
    prefix += `\n## ${file.label}: ${file.path}\n`
  }
  // Indexers may strip the file-reference prefix. Keep a meaningful request after
  // the marker without reading attachment contents or changing authored text.
  const request = prompt.trim() ? prompt : attachmentOnlyRequest(files)
  return `${prefix}\n## My request for Codex:\n\n${request}\n`
}
