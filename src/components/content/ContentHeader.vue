<template>
  <header class="content-header">
    <div class="content-leading" :class="{ 'is-accent': accent }">
      <slot name="leading" />
    </div>
    <div class="content-heading">
      <span v-if="projectName" class="content-project-name" :title="projectName">{{ projectName }}</span>
      <h1 class="content-title" :class="{ 'is-accent': accent }" :title="title">{{ title }}</h1>
    </div>
    <div class="content-actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  projectName?: string
  accent?: boolean
}>()
</script>

<style scoped>
@reference "tailwindcss";

.content-header {
  @apply relative z-[250] w-full min-w-0 min-h-12 sm:min-h-14 flex items-center gap-2 sm:gap-3 px-2 sm:px-3 pt-3 sm:pt-4 pb-2 bg-white;
}

.content-heading {
  @apply flex min-w-0 flex-1 items-center gap-2;
}

.content-project-name {
  @apply min-w-0 max-w-[40%] shrink truncate text-xs text-slate-500;
}

.content-title {
  @apply m-0 min-w-0 max-w-[min(72ch,100%)] shrink truncate text-sm font-medium leading-6 text-slate-900 max-sm:text-xs;
}

.content-title.is-accent {
  @apply text-lg font-semibold leading-7 tracking-[-0.01em] text-zinc-950 sm:text-[1.4rem];
}

.content-actions {
  @apply ml-auto flex shrink-0 items-center justify-end gap-1;
}

.content-leading {
  @apply flex shrink-0 items-center gap-1;
}

.content-leading.is-accent {
  @apply gap-2;
}

:global(:root.dark) .content-title.is-accent {
  @apply text-zinc-100;
}
</style>
