const fs = require('node:fs')
const path = require('node:path')
const { gzipSync } = require('node:zlib')

const root = path.resolve(process.argv[2] || 'dist')
const manifest = JSON.parse(fs.readFileSync(path.join(root, '.vite/manifest.json'), 'utf8'))
const entries = Object.keys(manifest).filter(key => manifest[key].isEntry)
if (entries.length !== 1) throw new Error(`Expected one browser entry, found ${entries.length}`)
const seen = new Set()
function visit(key) {
  if (seen.has(key)) return
  if (!manifest[key]) throw new Error(`Missing manifest import: ${key}`)
  seen.add(key)
  for (const dependency of manifest[key].imports || []) visit(dependency)
}
visit(entries[0])
function size(files) {
  return [...new Set(files)].reduce((total, file) => {
    const bytes = fs.readFileSync(path.join(root, file))
    return { bytes: total.bytes + bytes.length, gzip: total.gzip + gzipSync(bytes).length }
  }, { bytes: 0, gzip: 0 })
}
const staticFiles = [...seen].map(key => manifest[key].file).filter(file => file.endsWith('.js'))
const emittedFiles = fs.readdirSync(path.join(root, 'assets')).filter(file => file.endsWith('.js')).map(file => `assets/${file}`)
const report = {
  entry: size([manifest[entries[0]].file]),
  staticGraph: size(staticFiles),
  staticFiles,
  emitted: size(emittedFiles),
  largestChunks: emittedFiles.map(file => ({ file, ...size([file]) })).sort((a, b) => b.bytes - a.bytes).slice(0, 10),
}
console.log(JSON.stringify(report, null, 2))
const entryBudget = Number(process.env.BUNDLE_ENTRY_BUDGET || 300000)
const staticBudget = Number(process.env.BUNDLE_STATIC_BUDGET || 350000)
if (report.entry.bytes > entryBudget || report.staticGraph.bytes > staticBudget) {
  console.error(`Bundle target exceeded: entry ${report.entry.bytes}/${entryBudget}, static ${report.staticGraph.bytes}/${staticBudget} bytes`)
  process.exitCode = 1
}
