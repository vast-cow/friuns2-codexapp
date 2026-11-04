// Accept explicit event timestamps only; never infer from thread activity.
export function readMessageTimestamp(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return undefined
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? new Date(ms).toISOString() : undefined
}

export function formatMessageTimestamp(value: unknown): string {
  const iso = readMessageTimestamp(value)
  if (!iso) return ''
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
