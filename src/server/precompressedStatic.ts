import { readFileSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import type { Request, Response, NextFunction } from 'express'

// Explicit values override wildcard; identity is acceptable by default,
// but is a fallback rather than competing with a requested content coding.
export function encodingPreferences(header: string | undefined): string[] {
  if (!header?.trim()) return ['identity']
  const values = new Map<string, number>()
  for (const item of header.split(',')) {
    const [name, ...params] = item.trim().toLowerCase().split(';')
    let q = 1
    for (const param of params) {
      if (!param.trim().startsWith('q=')) continue
      const raw = param.trim().slice(2)
      q = /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(raw) ? Number(raw) : 0
    }
    values.set(name!, Math.min(values.get(name!) ?? 1, q))
  }
  const weight = (name: string) => values.get(name) ?? values.get('*') ?? 0
  const identity = values.get('identity') ?? (values.get('*') === 0 ? 0 : 0.001)
  return ['zstd', 'gzip', 'identity']
    .map((name, order) => ({ name, order, q: name === 'identity' ? identity : weight(name) }))
    .filter(({ q }) => q > 0)
    .sort((a, b) => b.q - a.q || a.order - b.order)
    .map(({ name }) => name)
}

async function isFile(file: string) {
  try { return (await stat(file)).isFile() }
  catch (error) {
    if (['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) return false
    throw error
  }
}

export async function sendPrecompressed(req: Request, res: Response, next: NextFunction, file: string, immutable = false) {
  if (extname(file) === '.html') res.setHeader('Cache-Control', 'no-cache')
  else if (immutable) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  res.vary('Accept-Encoding')
  for (const encoding of encodingPreferences(req.headers['accept-encoding'])) {
    const candidate = file + (encoding === 'zstd' ? '.zst' : encoding === 'gzip' ? '.gz' : '')
    if (!(await isFile(candidate))) continue
    const metadata = await stat(candidate)
    res.setHeader('ETag', 'W/"' + encoding + '-' + metadata.size.toString(16) + '-' + metadata.mtimeMs.toString(16) + '"')
    res.type(extname(file))
    if (encoding !== 'identity') res.setHeader('Content-Encoding', encoding)
    // sendFile computes length, validators, ranges and freshness for the selected file.
    res.sendFile(candidate, (error) => {
      if (!error) return
      if (res.headersSent) return next(error)
      res.removeHeader('Content-Encoding')
      next(error)
    })
    return
  }
  res.status(406).end()
}

export function precompressedStatic(root: string) {
  const base = resolve(root)
  // Only build-manifest entries qualify; public/unversioned files never opt in.
  // Read once at startup, with a safe revalidation fallback for older builds.
  const immutableFiles = new Set<string>()
  try {
    const manifest = JSON.parse(readFileSync(resolve(base, '.vite/manifest.json'), 'utf8'))
    for (const entry of Object.values(manifest) as { file?: unknown }[]) {
      if (typeof entry?.file === 'string' && /^assets\/[^/]+-[A-Za-z0-9_-]{8}\.js$/.test(entry.file)) {
        immutableFiles.add(resolve(base, entry.file))
      }
    }
  } catch { /* Missing or invalid manifest: retain default revalidation. */ }
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    let pathname: string
    try { pathname = decodeURIComponent(req.path) } catch { return next() }
    if (pathname.includes('\0') || pathname.split(/[\\/]/).some(part => part.startsWith('.'))) return next()
    const file = resolve(base, '.' + pathname, pathname.endsWith('/') ? 'index.html' : '')
    if (!file.startsWith(base + sep) || !(await isFile(file))) return next()
    return sendPrecompressed(req, res, next, file, immutableFiles.has(file))
  }
}
