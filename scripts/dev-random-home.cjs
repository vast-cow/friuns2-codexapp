// The backend must share CODEX_HOME with the independently started app-server.
console.warn('dev2 now preserves CODEX_HOME; start the external app-server with the same environment.')
require('./dev.cjs')
