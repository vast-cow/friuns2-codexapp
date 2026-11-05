<template>
  <div class="directory-hub">
    <div class="directory-header">
      <div>
        <h2 class="directory-title">Skills & MCPs</h2>
        <p class="directory-subtitle">Manage MCP servers and installed local skills.</p>
      </div>
      <div class="directory-header-actions">
        <button class="directory-refresh" type="button" :disabled="isManualRefreshInFlight" @click="refreshMcps">
          {{ isManualRefreshInFlight ? 'Refreshing...' : 'Refresh' }}
        </button>
      </div>
    </div>

    <div v-if="toast" class="directory-toast" :class="{ 'is-error': toast.type === 'error' }">{{ toast.text }}</div>
    <section class="directory-section">
      <SkillsHub
        :try-in-flight-key="props.tryInFlightKey"
        @skills-changed="emit('skills-changed')"
        @try-item="(payload) => emit('try-item', payload)"
      >
        <template #before-installed>
          <div class="skills-embedded-section">
            <button class="skills-embedded-toggle" type="button" @click="isMcpSectionOpen = !isMcpSectionOpen">
              <span class="skills-embedded-title">MCPs({{ visibleMcpServers.length }})</span>
              <span class="skills-embedded-chevron" :class="{ 'is-open': isMcpSectionOpen }">›</span>
            </button>
            <div v-if="isMcpSectionOpen" class="skills-embedded-body">
              <div v-if="!supportsMcps" class="directory-empty">
                MCP status APIs unavailable in this Codex CLI. Update Codex CLI to inspect MCP servers.
              </div>
              <div v-else-if="mcpError" class="directory-error">{{ mcpError }}</div>
              <div v-else-if="isLoadingMcps" class="directory-loading">Loading MCP servers...</div>
              <div v-else-if="visibleMcpServers.length === 0" class="directory-empty">No MCP servers configured.</div>
              <div v-else class="mcp-skill-grid">
                <article v-for="server in visibleMcpServers" :key="server.name">
                  <button class="mcp-skill-card skill-card" type="button" @click="toggleMcpExpanded(server.name)">
                    <div class="mcp-skill-card-top">
                      <div class="mcp-skill-avatar-fallback">{{ server.name.charAt(0) }}</div>
                      <div class="mcp-skill-info">
                        <div class="mcp-skill-header">
                          <span class="mcp-skill-name">{{ server.name }}</span>
                          <span class="mcp-skill-badge" :class="mcpCardBadgeClass(server.authStatus)">{{ formatMcpAuthStatus(server.name) }}</span>
                        </div>
                        <span class="mcp-skill-owner">mcp</span>
                      </div>
                      <span class="mcp-skill-chevron" :class="{ 'is-open': expandedMcpNames.has(server.name) }">›</span>
                    </div>
                    <p class="mcp-skill-meta">{{ server.tools.length }} tools · {{ server.resources.length + server.resourceTemplates.length }} resources</p>
                    <div v-if="expandedMcpNames.has(server.name)" class="directory-mcp-detail">
                      <div v-if="server.tools.length > 0">
                        <h3 class="directory-mini-heading">Tools</h3>
                        <p class="directory-mini-list">{{ server.tools.map((tool) => tool.title || tool.name).join(', ') }}</p>
                      </div>
                      <div v-if="server.resources.length > 0 || server.resourceTemplates.length > 0">
                        <h3 class="directory-mini-heading">Resources</h3>
                        <p class="directory-mini-list">
                          {{ [...server.resources.map((r) => r.title || r.name || r.uri), ...server.resourceTemplates.map((r) => r.title || r.name || r.uriTemplate)].join(', ') }}
                        </p>
                      </div>
                    </div>
                  </button>
                  <button v-if="shouldShowMcpLogin(server.name)" class="directory-action" type="button" :disabled="mcpLoginServerName === server.name" @click="loginMcpServer(server.name)">
                    {{ mcpLoginServerName === server.name ? 'Opening...' : 'Authenticate' }}
                  </button>
                </article>
              </div>
            </div>
          </div>
        </template>
      </SkillsHub>
    </section>

  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { getMethodCatalog, listDirectoryMcpServers, reloadDirectoryMcpServers, startDirectoryMcpLogin, type DirectoryMcpServerStatus } from '../../api/codexGateway'
import SkillsHub from './SkillsHub.vue'
const props = defineProps<{
  tryInFlightKey?: string
}>()

export type DirectoryTryItemPayload = {
  kind: 'skill'
  name: string
  displayName: string
  skillPath?: string
}

const emit = defineEmits<{
  'skills-changed': []
  'try-item': [payload: DirectoryTryItemPayload]
}>()

const methodSet = ref<Set<string>>(new Set())
const methodsLoaded = ref(false)
const mcpServers = ref<DirectoryMcpServerStatus[]>([])
const isLoadingMcps = ref(false)
const isManualRefreshInFlight = ref(false)
const isMcpSectionOpen = ref(true)
const mcpError = ref('')
const mcpLoginServerName = ref('')
const expandedMcpNames = ref<Set<string>>(new Set())
const toast = ref<{ text: string; type: 'success' | 'error' } | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | null = null
const supportsMcps = computed(() => !methodsLoaded.value || methodSet.value.has('mcpServerStatus/list'))
const supportsMcpReload = computed(() => methodSet.value.has('config/mcpServer/reload'))
const supportsMcpLogin = computed(() => methodSet.value.has('mcpServer/oauth/login'))
const visibleMcpServers = computed(() => [...mcpServers.value].sort((a, b) => a.name.localeCompare(b.name)))
const mcpStatusByName = computed(() => new Map(mcpServers.value.map((server) => [server.name, server])))
async function refreshMcps(): Promise<void> {
  if (isManualRefreshInFlight.value) return
  isManualRefreshInFlight.value = true
  try {
    if (supportsMcpReload.value) await reloadMcps()
    else await loadMcps()
  } finally {
    isManualRefreshInFlight.value = false
  }
}
function getMcpAuthStatus(serverName: string): string {
  return mcpStatusByName.value.get(serverName)?.authStatus ?? 'unknown'
}

function formatMcpAuthStatus(serverName: string): string {
  const status = getMcpAuthStatus(serverName)
  if (status === 'oAuth') return 'Logged in'
  if (status === 'bearerToken') return 'Bearer token'
  if (status === 'notLoggedIn') return 'Login required'
  if (status === 'unsupported') return 'Auth unsupported'
  return 'Status unknown'
}

function mcpCardBadgeClass(status: string): string {
  if (status === 'oAuth' || status === 'bearerToken') return 'mcp-skill-badge-ok'
  if (status === 'notLoggedIn') return 'mcp-skill-badge-warning'
  return 'mcp-skill-badge-muted'
}

function shouldShowMcpLogin(serverName: string): boolean {
  return supportsMcpLogin.value && getMcpAuthStatus(serverName) === 'notLoggedIn'
}

function showToast(text: string, type: 'success' | 'error' = 'success'): void {
  toast.value = { text, type }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = null }, 3000)
}

function openExternalUrl(rawUrl: string): void {
  const url = rawUrl.trim()
  if (!/^https?:\/\//i.test(url)) return
  window.location.assign(url)
}

async function loadMethods(): Promise<void> {
  try {
    methodSet.value = new Set(await getMethodCatalog())
  } catch {
    methodSet.value = new Set()
  } finally {
    methodsLoaded.value = true
  }
}

async function loadMcps(): Promise<void> {
  if (!supportsMcps.value) return
  isLoadingMcps.value = true
  mcpError.value = ''
  try {
    mcpServers.value = await listDirectoryMcpServers()
  } catch (error) {
    mcpError.value = error instanceof Error ? error.message : 'Failed to load MCP servers'
  } finally {
    isLoadingMcps.value = false
  }
}

async function loginMcpServer(serverName: string): Promise<boolean> {
  if (!supportsMcpLogin.value) return false
  mcpLoginServerName.value = serverName
  try {
    const result = await startDirectoryMcpLogin(serverName)
    if (!result.authorizationUrl) {
      showToast(`No login URL returned for ${serverName}`, 'error')
      return false
    }
    openExternalUrl(result.authorizationUrl)
    return true
  } catch (error) {
    showToast(error instanceof Error ? error.message : `Failed to start login for ${serverName}`, 'error')
    return false
  } finally {
    mcpLoginServerName.value = ''
  }
}

async function reloadMcps(): Promise<void> {
  try {
    await reloadDirectoryMcpServers()
    await loadMcps()
    showToast('MCP servers reloaded')
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Failed to reload MCP servers', 'error')
  }
}

function toggleMcpExpanded(name: string): void {
  const next = new Set(expandedMcpNames.value)
  if (next.has(name)) next.delete(name)
  else next.add(name)
  expandedMcpNames.value = next
}
onMounted(async () => {
  await loadMethods()
  await loadMcps()
})
onUnmounted(() => { if (toastTimer) clearTimeout(toastTimer) })
</script>
<style scoped>
@reference "tailwindcss";

.directory-hub {
  @apply flex h-full w-full flex-col gap-3 overflow-y-auto p-3 sm:p-6;
}

.directory-header {
  @apply mx-auto flex w-full max-w-5xl items-start justify-between gap-3;
}

.directory-header-actions {
  @apply flex items-center gap-2;
}

.directory-title {
  @apply m-0 text-xl font-semibold text-zinc-900 sm:text-2xl;
}

.directory-subtitle {
  @apply m-0 mt-1 text-sm text-zinc-500;
}

.directory-refresh,
.directory-action {
  @apply shrink-0 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 no-underline transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50;
}

.directory-section {
  @apply mx-auto flex w-full max-w-5xl flex-col gap-3;
}

.skills-embedded-section {
  @apply flex flex-col gap-2;
}

.skills-embedded-toggle {
  @apply flex items-center gap-1.5 border-0 bg-transparent p-0 text-sm font-medium text-zinc-600 transition hover:text-zinc-900 cursor-pointer;
}

.skills-embedded-title {
  @apply text-sm font-medium;
}

.skills-embedded-chevron {
  @apply inline-block text-base leading-none transition-transform;
}

.skills-embedded-chevron.is-open {
  @apply rotate-90;
}

.skills-embedded-body {
  @apply flex flex-col gap-3;
}

.mcp-skill-grid {
  @apply grid grid-cols-1 gap-3 md:grid-cols-2;
}

.mcp-skill-card {
  @apply flex w-full flex-col gap-1.5 rounded-xl border border-zinc-200 bg-white p-3 text-left transition hover:border-zinc-300 hover:shadow-sm cursor-pointer;
}

.mcp-skill-card-top {
  @apply flex items-start gap-2.5;
}

.mcp-skill-avatar-fallback {
  @apply w-8 h-8 rounded-full shrink-0 bg-zinc-200 text-zinc-500 flex items-center justify-center text-xs font-medium uppercase;
}

.mcp-skill-info {
  @apply flex flex-col gap-0.5 min-w-0 flex-1;
}

.mcp-skill-header {
  @apply flex items-center gap-2;
}

.mcp-skill-name {
  @apply text-sm font-medium text-zinc-900 truncate;
}

.mcp-skill-owner {
  @apply text-xs text-zinc-400;
}

.mcp-skill-meta {
  @apply m-0 text-xs text-zinc-500;
}

.mcp-skill-chevron {
  @apply inline-block text-base leading-none text-zinc-400 transition-transform;
}

.mcp-skill-chevron.is-open {
  @apply rotate-90;
}

.mcp-skill-badge {
  @apply shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-none border;
}

.mcp-skill-badge-ok {
  @apply border-emerald-200 bg-emerald-50 text-emerald-700;
}

.mcp-skill-badge-warning {
  @apply border-amber-200 bg-amber-50 text-amber-700;
}

.mcp-skill-badge-muted {
  @apply border-zinc-200 bg-zinc-100 text-zinc-500;
}

.directory-loading,
.directory-empty,
.directory-error {
  @apply rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-500;
}

.directory-error,
.directory-toast.is-error {
  @apply border-rose-200 bg-rose-50 text-rose-700;
}

.directory-toast {
  @apply mx-auto w-full max-w-5xl rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700;
}

.directory-mcp-detail {
  @apply flex flex-col gap-3 border-t border-zinc-100 pt-3;
}

.directory-mini-heading {
  @apply m-0 text-xs font-semibold text-zinc-700;
}

.directory-mini-list {
  @apply m-0 text-xs leading-relaxed text-zinc-500;
}

</style>
