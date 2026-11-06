import { resolveAppServerUrl } from '../server/appServerWebSocketClient.js'
import { createServer } from 'node:http'
import { readFile, realpath, stat } from 'node:fs/promises'
import { networkInterfaces } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { Command } from 'commander'
import {
  parseApprovalPolicy,
  parseSandboxMode,
} from '../server/appServerRuntimeConfig.js'
import { updateCodexGlobalState } from '../server/codexGlobalState.js'
import { createServer as createApp } from '../server/httpServer.js'

const program = new Command().name('codexui').description('Web interface for Codex app-server')
const __dirname = dirname(fileURLToPath(import.meta.url))
async function readCliVersion(): Promise<string> {
  try {
    const packageJsonPath = join(__dirname, '..', 'package.json')
    const raw = await readFile(packageJsonPath, 'utf8')
    const parsed = JSON.parse(raw) as { version?: unknown }
    return typeof parsed.version === 'string' ? parsed.version : 'unknown'
  } catch {
    return 'unknown'
  }
}

function openBrowser(url: string): void {
  const command = process.platform === 'darwin'
    ? { cmd: 'open', args: [url] }
    : process.platform === 'win32'
      ? { cmd: 'cmd', args: ['/c', 'start', '', url] }
      : { cmd: 'xdg-open', args: [url] }

  const child = spawn(command.cmd, command.args, { detached: true, stdio: 'ignore' })
  child.on('error', () => {})
  child.unref()
}

function getAccessibleUrls(port: number): string[] {
  const urls = new Set<string>([`http://localhost:${String(port)}`])
  try {
    const interfaces = networkInterfaces()
    for (const entries of Object.values(interfaces)) {
      if (!entries) {
        continue
      }
      for (const entry of entries) {
        if (entry.internal) {
          continue
        }
        if (entry.family === 'IPv4') {
          urls.add(`http://${entry.address}:${String(port)}`)
        }
      }
    }
  } catch {}
  return Array.from(urls)
}

function listenWithFallback(server: ReturnType<typeof createServer>, startPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const attempt = (port: number) => {
      const onError = (error: NodeJS.ErrnoException) => {
        server.off('listening', onListening)
        if (error.code === 'EADDRINUSE' || error.code === 'EACCES') {
          attempt(port + 1)
          return
        }
        reject(error)
      }
      const onListening = () => {
        server.off('error', onError)
        resolve(port)
      }

      server.once('error', onError)
      server.once('listening', onListening)
      server.listen(port, '0.0.0.0')
    }

    attempt(startPort)
  })
}

function normalizeUniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const next: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const trimmed = item.trim()
    if (!trimmed || next.includes(trimmed)) continue
    next.push(trimmed)
  }
  return next
}

async function persistLaunchProject(projectPath: string): Promise<void> {
  const trimmed = projectPath.trim()
  if (!trimmed) return
  const normalizedPath = await realpath(isAbsolute(trimmed) ? trimmed : resolve(trimmed))
  const directoryInfo = await stat(normalizedPath)
  if (!directoryInfo.isDirectory()) {
    throw new Error(`Not a directory: ${normalizedPath}`)
  }

  await updateCodexGlobalState((payload) => {
    for (const key of ['electron-saved-workspace-roots', 'active-workspace-roots', 'project-order']) {
      const values = normalizeUniqueStrings(payload[key])
      payload[key] = [normalizedPath, ...values.filter((value) => value !== normalizedPath)]
    }
  })
}

async function addProjectOnly(projectPath: string): Promise<void> {
  const trimmed = projectPath.trim()
  if (!trimmed) {
    throw new Error('Missing project path')
  }
  await persistLaunchProject(trimmed)
}

async function startServer(options: {
  appServerUrl?: string
  port: string
  password: string | boolean
  open: boolean
  login: boolean
  memories: boolean
  sandboxMode?: string
  approvalPolicy?: string
  projectPath?: string
}) {
  const version = await readCliVersion()
  const projectPath = options.projectPath?.trim() ?? ''
  if (projectPath.length > 0) {
    try {
      await persistLaunchProject(projectPath)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`\n[project] Could not open launch project: ${message}\n`)
    }
  }
  process.env.CODEXUI_APP_SERVER_URL = resolveAppServerUrl(options.appServerUrl)
  const requestedPort = parseInt(options.port, 10)
  const password = typeof options.password === 'string' ? options.password : undefined
  const { app, dispose, attachWebSocket } = createApp({ password })
  const server = createServer(app)
  attachWebSocket(server)
  const port = await listenWithFallback(server, requestedPort)
  const lines = [
    '',
    'Codex Web Local is running!',
    `  Version:  ${version}`,
    '',
    `  Bind:     http://0.0.0.0:${String(port)}`,
    `  App-server: ${process.env.CODEXUI_APP_SERVER_URL}`,
    '  Runtime configuration and authentication: managed externally',
  ]
  const accessUrls = getAccessibleUrls(port)
  if (accessUrls.length > 0) {
    lines.push(`  Local:    ${accessUrls[0]}`)
    for (const accessUrl of accessUrls.slice(1)) {
      lines.push(`  Network:  ${accessUrl}`)
    }
  }

  if (port !== requestedPort) {
    lines.push(`  Requested port ${String(requestedPort)} was unavailable; using ${String(port)}.`)
  }

  lines.push('')
  console.log(lines.join('\n'))
  if (options.open) openBrowser(`http://localhost:${String(port)}`)

  function shutdown() {
    console.log('\nShutting down...')
    server.close(() => {
      dispose()
      process.exit(0)
    })
    // Force exit after timeout
    setTimeout(() => {
      dispose()
      process.exit(1)
    }, 5000).unref()
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

async function runLogin(): Promise<void> {
  throw new Error('Manage authentication in the independently running Codex app-server (codex login), then reconnect the web application.')
}

program
  .argument('[projectPath]', 'project directory to open on launch')
  .option('--open-project <path>', 'open project directory on launch (Codex desktop parity)')
  .option('-p, --port <port>', 'port to listen on', '5900')
  .option('--password <pass>', 'enable password protection with a specific password', false)
  .option('--no-password', 'disable password protection (default)')
  .option('--open', 'open browser on startup', true)
  .option('--no-open', 'do not open browser on startup')
  .option('--app-server-url <url>', 'external Codex app-server WebSocket URL')
  .option('--login', 'deprecated compatibility flag; authentication is managed externally', true)
  .option('--no-login', 'deprecated compatibility flag; authentication is managed externally')
  .option('--memories', 'deprecated; configure memories on the external server', true)
  .option('--no-memories', 'deprecated; configure memories on the external server')
  .option('--sandbox-mode <mode>', 'deprecated; configure sandbox on the external server')
  .option('--approval-policy <policy>', 'deprecated; configure approvals on the external server')
  .action(async (
    projectPath: string | undefined,
    opts: {
      appServerUrl?: string
      port: string
      password: string | boolean
      open: boolean
      login: boolean
      memories: boolean
      sandboxMode?: string
      approvalPolicy?: string
      openProject?: string
    },
  ) => {
    const rawArgv = process.argv.slice(2)
    if (rawArgv.some(arg => /^(--(no-)?memories|--sandbox-mode|--approval-policy)(=|$)/.test(arg))) {
      throw new Error('Configure memories, sandbox and approval defaults on the external app-server; use thread settings for per-thread choices.')
    }
    const openProjectFlagIndex = rawArgv.findIndex((arg) => arg === '--open-project' || arg.startsWith('--open-project='))

    let openProjectOnly = (opts.openProject ?? '').trim()
    if (!openProjectOnly && openProjectFlagIndex >= 0 && projectPath?.trim()) {
      // Commander may map "--open-project ." to the positional arg in this command layout.
      openProjectOnly = projectPath.trim()
    }
    if (openProjectOnly.length > 0) {
      await addProjectOnly(openProjectOnly)
      console.log(`Added project: ${openProjectOnly}`)
      return
    }

    const launchProject = (projectPath ?? '').trim()
    if (opts.sandboxMode) {
      const parsedSandboxMode = parseSandboxMode(opts.sandboxMode)
      if (!parsedSandboxMode) {
        throw new Error(`Invalid sandbox mode: ${opts.sandboxMode}`)
      }
      opts.sandboxMode = parsedSandboxMode
    }
    if (opts.approvalPolicy) {
      const parsedApprovalPolicy = parseApprovalPolicy(opts.approvalPolicy)
      if (!parsedApprovalPolicy) {
        throw new Error(`Invalid approval policy: ${opts.approvalPolicy}`)
      }
      opts.approvalPolicy = parsedApprovalPolicy
    }
    await startServer({ ...opts, projectPath: launchProject })
  })

program.command('login').description('Explain external server authentication').action(runLogin)

program.command('help').description('Show codexui command help').action(() => {
  program.outputHelp()
})

program.parseAsync(process.argv).catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`\nFailed to run codexui: ${message}`)
  process.exit(1)
})
