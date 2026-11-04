

import { DirectoryPluginAppSummary, asRecord, readString, readBoolean, DirectoryPluginSkillSummary, DirectoryPluginSummary, readStringArray, DirectoryAppInfo, DirectoryMcpServerStatus, callRpc, DirectoryPluginDetail, DirectoryPluginInstallResult, DirectoryMcpLoginResult, DirectoryComposioStatus, DirectoryComposioConnectorPage, DirectoryComposioConnector, DirectoryComposioConnectorDetail, DirectoryComposioLinkResult, DirectoryComposioLoginResult, DirectoryComposioInstallResult } from './codexGateway'

function normalizeDirectoryPluginApp(value: unknown): DirectoryPluginAppSummary | null {
  const record = asRecord(value)
  if (!record) return null
  const id = readString(record.id)
  const name = readString(record.name)
  if (!id || !name) return null
  return {
    id,
    name,
    description: readString(record.description) ?? '',
    installUrl: readString(record.installUrl ?? record.install_url) ?? '',
    needsAuth: readBoolean(record.needsAuth ?? record.needs_auth) ?? false,
  }
}

function normalizeDirectoryPluginSkill(value: unknown): DirectoryPluginSkillSummary | null {
  const record = asRecord(value)
  if (!record) return null
  const name = readString(record.name)
  const path = readString(record.path)
  if (!name || !path) return null
  const iface = asRecord(record.interface)
  return {
    name,
    path,
    description: readString(record.description) ?? '',
    enabled: readBoolean(record.enabled) ?? true,
    displayName: readString(iface?.displayName ?? iface?.display_name) ?? name,
    shortDescription: readString(record.shortDescription ?? record.short_description) ?? '',
  }
}

function normalizeDirectoryPluginSummary(
  value: unknown,
  marketplace: { name?: string; displayName?: string; path?: string | null } = {},
): DirectoryPluginSummary | null {
  const record = asRecord(value)
  if (!record) return null
  const id = readString(record.id)
  const name = readString(record.name)
  if (!id || !name) return null
  const iface = asRecord(record.interface)
  const source = asRecord(record.source)
  const sourceType = readString(source?.type) ?? ''
  const sourcePath = readString(source?.path)
  const sourceUrl = readString(source?.url) ?? ''
  const remoteMarketplaceName = sourceType === 'remote' ? marketplace.name ?? null : null
  const marketplacePath = marketplace.path ?? (sourceType === 'local' ? sourcePath : null)
  const displayName = readString(iface?.displayName ?? iface?.display_name) ?? name
  const shortDescription = readString(iface?.shortDescription ?? iface?.short_description)
  const longDescription = readString(iface?.longDescription ?? iface?.long_description) ?? ''

  return {
    id,
    name,
    displayName,
    description: shortDescription ?? longDescription,
    longDescription,
    developerName: readString(iface?.developerName ?? iface?.developer_name) ?? '',
    category: readString(iface?.category) ?? '',
    marketplaceName: marketplace.name ?? '',
    marketplaceDisplayName: marketplace.displayName ?? marketplace.name ?? '',
    marketplacePath,
    remoteMarketplaceName,
    sourceType,
    sourceUrl,
    installed: readBoolean(record.installed) ?? false,
    enabled: readBoolean(record.enabled) ?? true,
    installPolicy: readString(record.installPolicy ?? record.install_policy) ?? '',
    authPolicy: readString(record.authPolicy ?? record.auth_policy) ?? '',
    logoUrl: readString(iface?.logoUrl ?? iface?.logo_url) ?? '',
    logoPath: readString(iface?.logo) ?? '',
    composerIconUrl: readString(iface?.composerIconUrl ?? iface?.composer_icon_url) ?? '',
    composerIconPath: readString(iface?.composerIcon ?? iface?.composer_icon) ?? '',
    brandColor: readString(iface?.brandColor ?? iface?.brand_color) ?? '',
    capabilities: readStringArray(iface?.capabilities),
    defaultPrompt: readStringArray(iface?.defaultPrompt ?? iface?.default_prompt),
    screenshotUrls: readStringArray(iface?.screenshotUrls ?? iface?.screenshot_urls),
    screenshots: readStringArray(iface?.screenshots),
    websiteUrl: readString(iface?.websiteUrl ?? iface?.website_url) ?? '',
    privacyPolicyUrl: readString(iface?.privacyPolicyUrl ?? iface?.privacy_policy_url) ?? '',
    termsOfServiceUrl: readString(iface?.termsOfServiceUrl ?? iface?.terms_of_service_url) ?? '',
  }
}

function normalizeDirectoryApp(value: unknown, catalogRank = 0): DirectoryAppInfo | null {
  const record = asRecord(value)
  if (!record) return null
  const id = readString(record.id)
  const name = readString(record.name)
  if (!id || !name) return null
  const branding = asRecord(record.branding)
  const metadata = asRecord(record.appMetadata ?? record.app_metadata)
  return {
    id,
    name,
    description: readString(record.description) ?? readString(metadata?.seoDescription ?? metadata?.seo_description) ?? '',
    logoUrl: readString(record.logoUrl ?? record.logo_url) ?? '',
    logoUrlDark: readString(record.logoUrlDark ?? record.logo_url_dark) ?? '',
    distributionChannel: readString(record.distributionChannel ?? record.distribution_channel) ?? '',
    installUrl: readString(record.installUrl ?? record.install_url) ?? '',
    isAccessible: readBoolean(record.isAccessible ?? record.is_accessible) ?? false,
    isEnabled: readBoolean(record.isEnabled ?? record.is_enabled) ?? true,
    pluginDisplayNames: readStringArray(record.pluginDisplayNames ?? record.plugin_display_names),
    category: readString(branding?.category) ?? '',
    developer: readString(branding?.developer) ?? readString(metadata?.developer) ?? '',
    website: readString(branding?.website) ?? '',
    privacyPolicy: readString(branding?.privacyPolicy ?? branding?.privacy_policy) ?? '',
    termsOfService: readString(branding?.termsOfService ?? branding?.terms_of_service) ?? '',
    catalogRank,
  }
}

function normalizeDirectoryMcpServer(value: unknown): DirectoryMcpServerStatus | null {
  const record = asRecord(value)
  if (!record) return null
  const name = readString(record.name)
  if (!name) return null
  const toolsRecord = asRecord(record.tools) ?? {}
  const tools = Object.entries(toolsRecord).map(([fallbackName, raw]) => {
    const tool = asRecord(raw)
    return {
      name: readString(tool?.name) ?? fallbackName,
      title: readString(tool?.title) ?? '',
      description: readString(tool?.description) ?? '',
    }
  })
  const resources = Array.isArray(record.resources)
    ? record.resources.map((raw) => {
      const resource = asRecord(raw)
      return {
        name: readString(resource?.name) ?? '',
        title: readString(resource?.title) ?? '',
        uri: readString(resource?.uri) ?? '',
        description: readString(resource?.description) ?? '',
      }
    }).filter((resource) => resource.name || resource.uri)
    : []
  const rawResourceTemplates = record.resourceTemplates ?? record.resource_templates
  const resourceTemplates = Array.isArray(rawResourceTemplates)
    ? rawResourceTemplates.map((raw: unknown) => {
      const template = asRecord(raw)
      return {
        name: readString(template?.name) ?? '',
        title: readString(template?.title) ?? '',
        uriTemplate: readString(template?.uriTemplate ?? template?.uri_template) ?? '',
        description: readString(template?.description) ?? '',
      }
    }).filter((template) => template.name || template.uriTemplate)
    : []

  return {
    name,
    authStatus: readString(record.authStatus ?? record.auth_status) ?? 'unsupported',
    tools,
    resources,
    resourceTemplates,
  }
}

export async function listDirectoryPlugins(cwds?: string[]): Promise<DirectoryPluginSummary[]> {
  const params: Record<string, unknown> = {}
  if (cwds && cwds.length > 0) params.cwds = cwds
  const payload = await callRpc<{ marketplaces?: unknown[] }>('plugin/list', params)
  const plugins: DirectoryPluginSummary[] = []
  for (const marketplaceValue of payload.marketplaces ?? []) {
    const marketplace = asRecord(marketplaceValue)
    if (!marketplace) continue
    const iface = asRecord(marketplace.interface)
    const meta = {
      name: readString(marketplace.name) ?? '',
      displayName: readString(iface?.displayName ?? iface?.display_name) ?? '',
      path: readString(marketplace.path),
    }
    const rows = Array.isArray(marketplace.plugins) ? marketplace.plugins : []
    for (const row of rows) {
      const plugin = normalizeDirectoryPluginSummary(row, meta)
      if (plugin) plugins.push(plugin)
    }
  }
  return plugins
}

export async function readDirectoryPlugin(plugin: DirectoryPluginSummary): Promise<DirectoryPluginDetail> {
  const params: Record<string, unknown> = { pluginName: plugin.name }
  if (plugin.marketplacePath) params.marketplacePath = plugin.marketplacePath
  if (plugin.remoteMarketplaceName) params.remoteMarketplaceName = plugin.remoteMarketplaceName
  const payload = await callRpc<{ plugin?: unknown }>('plugin/read', params)
  const detailRecord = asRecord(payload.plugin)
  if (!detailRecord) throw new Error('Plugin detail response is empty')
  const summary = normalizeDirectoryPluginSummary(detailRecord.summary, {
    name: readString(detailRecord.marketplaceName) ?? plugin.marketplaceName,
    displayName: plugin.marketplaceDisplayName,
    path: readString(detailRecord.marketplacePath) ?? plugin.marketplacePath,
  }) ?? plugin
  return {
    summary,
    description: readString(detailRecord.description) ?? summary.longDescription,
    apps: Array.isArray(detailRecord.apps)
      ? detailRecord.apps.map(normalizeDirectoryPluginApp).filter((row): row is DirectoryPluginAppSummary => row !== null)
      : [],
    skills: Array.isArray(detailRecord.skills)
      ? detailRecord.skills.map(normalizeDirectoryPluginSkill).filter((row): row is DirectoryPluginSkillSummary => row !== null)
      : [],
    mcpServers: readStringArray(detailRecord.mcpServers ?? detailRecord.mcp_servers),
  }
}

export async function installDirectoryPlugin(plugin: DirectoryPluginSummary): Promise<DirectoryPluginInstallResult> {
  const params: Record<string, unknown> = { pluginName: plugin.name }
  if (plugin.marketplacePath) params.marketplacePath = plugin.marketplacePath
  if (plugin.remoteMarketplaceName) params.remoteMarketplaceName = plugin.remoteMarketplaceName
  const payload = await callRpc<{ authPolicy?: string; auth_policy?: string; appsNeedingAuth?: unknown[]; apps_needing_auth?: unknown[] }>('plugin/install', params)
  const apps = payload.appsNeedingAuth ?? payload.apps_needing_auth ?? []
  return {
    authPolicy: readString(payload.authPolicy ?? payload.auth_policy) ?? '',
    appsNeedingAuth: apps.map(normalizeDirectoryPluginApp).filter((row): row is DirectoryPluginAppSummary => row !== null),
  }
}

export async function uninstallDirectoryPlugin(pluginId: string): Promise<void> {
  await callRpc('plugin/uninstall', { pluginId })
}

export async function setDirectoryPluginEnabled(pluginId: string, enabled: boolean): Promise<void> {
  await callRpc('config/batchWrite', {
    edits: [{ keyPath: `plugins.${pluginId}.enabled`, value: enabled, mergeStrategy: 'upsert' }],
    filePath: null,
    expectedVersion: null,
    reloadUserConfig: true,
  })
}

export async function listDirectoryApps(threadId?: string): Promise<DirectoryAppInfo[]> {
  const apps: DirectoryAppInfo[] = []
  let cursor: string | null = null
  let catalogRank = 0
  do {
    const params: Record<string, unknown> = { limit: 100 }
    if (cursor) params.cursor = cursor
    if (threadId) params.threadId = threadId
    const payload = await callRpc<{ data?: unknown[]; nextCursor?: string | null; next_cursor?: string | null }>('app/list', params)
    for (const item of payload.data ?? []) {
      const app = normalizeDirectoryApp(item, catalogRank)
      if (app) apps.push(app)
      catalogRank += 1
    }
    cursor = readString(payload.nextCursor ?? payload.next_cursor)
  } while (cursor)
  return apps
}

export async function setDirectoryAppEnabled(appId: string, enabled: boolean): Promise<void> {
  await callRpc('config/batchWrite', {
    edits: [{ keyPath: `apps.${appId}.enabled`, value: enabled, mergeStrategy: 'upsert' }],
    filePath: null,
    expectedVersion: null,
    reloadUserConfig: true,
  })
}

export async function listDirectoryMcpServers(): Promise<DirectoryMcpServerStatus[]> {
  const servers: DirectoryMcpServerStatus[] = []
  let cursor: string | null = null
  do {
    const params: Record<string, unknown> = {}
    if (cursor) params.cursor = cursor
    const payload = await callRpc<{ data?: unknown[]; nextCursor?: string | null; next_cursor?: string | null }>('mcpServerStatus/list', params)
    for (const item of payload.data ?? []) {
      const server = normalizeDirectoryMcpServer(item)
      if (server) servers.push(server)
    }
    cursor = readString(payload.nextCursor ?? payload.next_cursor)
  } while (cursor)
  return servers
}

export async function reloadDirectoryMcpServers(): Promise<void> {
  await callRpc('config/mcpServer/reload', {})
}

export async function startDirectoryMcpLogin(name: string): Promise<DirectoryMcpLoginResult> {
  const payload = await callRpc<{ authorizationUrl?: string; authorization_url?: string }>('mcpServer/oauth/login', { name })
  return {
    authorizationUrl: readString(payload.authorizationUrl ?? payload.authorization_url) ?? '',
  }
}

export async function getDirectoryComposioStatus(): Promise<DirectoryComposioStatus> {
  const response = await fetch('/codex-api/composio/status')
  if (!response.ok) {
    throw new Error(`Failed to load Composio status (${response.status})`)
  }
  return await response.json() as DirectoryComposioStatus
}

export async function listDirectoryComposioConnectors(
  query = '',
  cursor: string | null = null,
  limit = 50,
): Promise<DirectoryComposioConnectorPage> {
  const params = new URLSearchParams()
  if (query.trim()) params.set('query', query.trim())
  if (cursor) params.set('cursor', cursor)
  if (limit && Number.isFinite(limit)) params.set('limit', String(Math.max(1, Math.floor(limit))))
  const suffix = params.toString()
  const response = await fetch(`/codex-api/composio/connectors${suffix ? `?${suffix}` : ''}`)
  if (!response.ok) {
    throw new Error(`Failed to list Composio connectors (${response.status})`)
  }
  const payload = await response.json() as DirectoryComposioConnectorPage | { data?: DirectoryComposioConnector[]; nextCursor?: string | null; total?: number }
  return {
    data: Array.isArray(payload.data) ? payload.data : [],
    nextCursor: typeof payload.nextCursor === 'string' && payload.nextCursor.length > 0 ? payload.nextCursor : null,
    total: typeof payload.total === 'number' && Number.isFinite(payload.total) ? Math.max(0, Math.floor(payload.total)) : 0,
  }
}

export async function readDirectoryComposioConnector(slug: string): Promise<DirectoryComposioConnectorDetail> {
  const response = await fetch(`/codex-api/composio/connector?slug=${encodeURIComponent(slug)}`)
  if (!response.ok) {
    throw new Error(`Failed to load Composio connector (${response.status})`)
  }
  return await response.json() as DirectoryComposioConnectorDetail
}

export async function startDirectoryComposioLogin(slug: string): Promise<DirectoryComposioLinkResult> {
  const response = await fetch('/codex-api/composio/link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug }),
  })
  if (!response.ok) {
    throw new Error(`Failed to start Composio login (${response.status})`)
  }
  return await response.json() as DirectoryComposioLinkResult
}

export async function startDirectoryComposioCliLogin(): Promise<DirectoryComposioLoginResult> {
  const response = await fetch('/codex-api/composio/login', {
    method: 'POST',
  })
  if (!response.ok) {
    throw new Error(`Failed to start Composio CLI login (${response.status})`)
  }
  return await response.json() as DirectoryComposioLoginResult
}

export async function installDirectoryComposioCli(): Promise<DirectoryComposioInstallResult> {
  const response = await fetch('/codex-api/composio/install', {
    method: 'POST',
  })
  if (!response.ok) {
    throw new Error(`Failed to install Composio CLI (${response.status})`)
  }
  return await response.json() as DirectoryComposioInstallResult
}
