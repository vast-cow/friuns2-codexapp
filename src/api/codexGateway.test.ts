import { afterEach, describe, expect, it, vi } from 'vitest'
import { reasoningCatalog, getAvailableModelIds, getThreadDetail, resumeThread, startThreadTurn } from './codexGateway'

function mockRpcFetch(): { requests: Array<{ method: string, params: Record<string, unknown> }> } {
  const requests: Array<{ method: string, params: Record<string, unknown> }> = []

  vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = typeof init?.body === 'string'
      ? JSON.parse(init.body) as { method: string, params: Record<string, unknown> }
      : { method: '', params: {} }

    requests.push(body)

    return new Response(JSON.stringify({
      result: {
        turn: {
          id: `turn-${requests.length}`,
        },
      },
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }))

  return { requests }
}

describe('startThreadTurn collaboration mode payloads', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends default collaboration mode explicitly after a plan turn', async () => {
    reasoningCatalog.value = [{ id: 'gpt-5.4', supportedReasoningEfforts: ['medium'], defaultReasoningEffort: 'medium' }]
    const { requests } = mockRpcFetch()

    await startThreadTurn('thread-1', 'make a plan', [], 'gpt-5.4', 'medium', undefined, [], 'plan')
    await startThreadTurn('thread-1', 'implement it', [], 'gpt-5.4', 'medium', undefined, [], 'default')

    expect(requests).toHaveLength(2)
    expect(requests[0].method).toBe('turn/start')
    expect(requests[0].params.collaborationMode).toEqual({
      mode: 'plan',
      settings: {
        model: 'gpt-5.4',
        reasoning_effort: 'medium',
        developer_instructions: null,
      },
    })
    expect(requests[1].method).toBe('turn/start')
    expect(requests[1].params.collaborationMode).toEqual({
      mode: 'default',
      settings: {
        model: 'gpt-5.4',
        reasoning_effort: 'medium',
        developer_instructions: null,
      },
    })
  })
})

describe('startThreadTurn attachment-only payloads', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each(['pasted-text-2026-11-04-12-00-00.txt', 'notes.txt'])('sends an indexable request and original references for %s', async (name) => {
    const { requests } = mockRpcFetch()
    const file = { label: name, path: `/uploads/${name}`, fsPath: `/uploads/${name}` }

    await startThreadTurn('new-thread', '', [], 'gpt-5.4', 'medium', undefined, [file])

    expect(requests).toHaveLength(1)
    expect(requests[0].params.input).toEqual([{
      type: 'text',
      text: `# Files mentioned by the user:\n\n## ${name}: /uploads/${name}\n\n## My request for Codex:\n\nAttached file: ${name}\n`,
    }])
    expect(requests[0].params.attachments).toEqual([file])
  })
})

describe('getThreadDetail', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('preserves historical provider metadata as data without selecting a connection', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = typeof init?.body === 'string'
        ? JSON.parse(init.body) as { method: string; params: Record<string, unknown> }
        : { method: '', params: {} }
      expect(body.method).toBe('thread/read')
      return new Response(JSON.stringify({
        result: {
          thread: {
            id: body.params.threadId,
            modelProvider: 'opencode_zen',
            turns: [],
          },
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }))

    await expect(getThreadDetail('legacy-thread')).resolves.toMatchObject({
      modelProvider: 'opencode_zen',
    })
  })
})

describe('resumeThread', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('coalesces repeated resume failures for the same thread', async () => {
    const requests: Array<{ method: string; params: Record<string, unknown> }> = []
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = typeof init?.body === 'string'
        ? JSON.parse(init.body) as { method: string; params: Record<string, unknown> }
        : { method: '', params: {} }
      requests.push(body)
      return new Response(JSON.stringify({ error: 'no rollout found for thread id missing-thread' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }))

    const results = await Promise.allSettled([
      resumeThread('missing-thread'),
      resumeThread('missing-thread'),
    ])

    expect(results.every((result) => result.status === 'rejected')).toBe(true)
    expect(requests).toEqual([
      { method: 'thread/resume', params: { threadId: 'missing-thread' } },
    ])
  })

  it('evicts a stalled resume so later resume attempts are not pinned forever', async () => {
    vi.useFakeTimers()
    const requests: Array<{ method: string; params: Record<string, unknown> }> = []
    vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      const body = typeof init?.body === 'string'
        ? JSON.parse(init.body) as { method: string; params: Record<string, unknown> }
        : { method: '', params: {} }
      requests.push(body)
      return new Promise<Response>(() => undefined)
    }))

    const first = resumeThread('stalled-thread')
    void resumeThread('stalled-thread')
    expect(requests).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(30_000)

    const retried = resumeThread('stalled-thread')
    expect(retried).not.toBe(first)
    expect(requests).toEqual([
      { method: 'thread/resume', params: { threadId: 'stalled-thread' } },
      { method: 'thread/resume', params: { threadId: 'stalled-thread' } },
    ])
  })
})


describe('official Codex model catalog', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('loads all model/list pages and retains reasoning capabilities without external requests', async () => {
    const calls: Array<{ method: string; params: unknown }> = []
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      expect(String(url)).toBe('/codex-api/rpc')
      const body = JSON.parse(init.body)
      calls.push(body)
      return new Response(JSON.stringify({ result: body.params?.cursor
        ? { data: [{ id: 'gpt-second' }], nextCursor: null }
        : { data: [{ id: 'gpt-test', supportedReasoningEfforts: ['low', 'high'], defaultReasoningEffort: 'high' }], nextCursor: 'page2' } }))
    }))
    const catalog = await getAvailableModelIds()
    expect(catalog.ids).toEqual(['gpt-test', 'gpt-second'])
    expect(catalog.models[0].defaultReasoningEffort).toBe('high')
    expect(calls).toEqual([{ method: 'model/list', params: {} }, { method: 'model/list', params: { cursor: 'page2' } }])
  })
})

describe('MCP directory transport', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('preserves status, inspection, reload and OAuth through generic RPC', async () => {
    const { listDirectoryMcpServers, reloadDirectoryMcpServers, startDirectoryMcpLogin } = await import('./codexGateway')
    const requests: Array<{ method: string; params: unknown }> = []
    vi.stubGlobal('fetch', vi.fn(async (_input: unknown, init: RequestInit) => {
      const body = JSON.parse(init.body as string)
      requests.push(body)
      const result = body.method === 'mcpServerStatus/list'
        ? { data: [{ name: 'example', authStatus: 'notLoggedIn', tools: { inspect: { title: 'Inspect' } }, resources: [{ uri: 'example://resource' }] }] }
        : { authorizationUrl: 'https://example.com/oauth' }
      return new Response(JSON.stringify({ result }))
    }))
    expect(await listDirectoryMcpServers()).toEqual([expect.objectContaining({
      name: 'example', authStatus: 'notLoggedIn',
      tools: [expect.objectContaining({ name: 'inspect', title: 'Inspect' })],
      resources: [expect.objectContaining({ uri: 'example://resource' })],
    })])
    await reloadDirectoryMcpServers()
    expect(await startDirectoryMcpLogin('example')).toEqual({ authorizationUrl: 'https://example.com/oauth' })
    expect(requests).toEqual([
      { method: 'mcpServerStatus/list', params: {} },
      { method: 'config/mcpServer/reload', params: {} },
      { method: 'mcpServer/oauth/login', params: { name: 'example' } },
    ])
  })
})
