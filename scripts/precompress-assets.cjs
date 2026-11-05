const { readdir, readFile, writeFile } = require('node:fs/promises');
const { join, extname } = require('node:path');
const { gzipSync } = require('node:zlib');
const { init, compress } = require('@bokuweb/zstd-wasm');

// Sequential processing bounds memory and CPU concurrency during the build.
async function precompress(root) {
  await init();
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = join(dir, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (entry.isFile() && /^(\.js|\.mjs|\.css|\.html|\.json|\.svg|\.txt|\.xml|\.map)$/.test(extname(file))) {
        const original = await readFile(file);
        await writeFile(file + '.gz', gzipSync(original, { level: 9 }));
        await writeFile(file + '.zst', compress(original, 10));
      }
    }
  }
  await walk(root);
}
module.exports = { precompress };
if (require.main === module) precompress(join(__dirname, '..', 'dist')).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
