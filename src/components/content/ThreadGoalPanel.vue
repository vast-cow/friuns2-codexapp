<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { clearThreadGoal, getThreadGoal, setThreadGoal, THREAD_GOAL_STATUSES, type ThreadGoal, type ThreadGoalStatus } from '../../api/codexGateway'
import ComposerDropdown from './ComposerDropdown.vue'
import { useUiLanguage } from '../../composables/useUiLanguage'

const props = defineProps<{ threadId: string; inProgress: boolean }>()
const { t } = useUiLanguage()
const goal = ref<ThreadGoal | null>(null)
const editing = ref(false)
const busy = ref(false)
const error = ref('')
const objective = ref('')
const objectiveInput = ref<HTMLTextAreaElement | null>(null)
const status = ref<ThreadGoalStatus>('active')
let generation = 0
const statusOptions = THREAD_GOAL_STATUSES.map(value => ({ value, label: value.replace(/([A-Z])/g, ' $1').toLowerCase() }))

async function load() {
  const current = ++generation
  const id = props.threadId
  if (!id) return
  try {
    const result = await getThreadGoal(id)
    if (current === generation) goal.value = result
  } catch (cause) {
    if (current === generation) error.value = cause instanceof Error ? cause.message : 'Failed to load goal'
  }
}
function edit() {
  if (busy.value || !props.threadId) return
  if (editing.value) {
    objectiveInput.value?.focus()
    return
  }
  objective.value = goal.value?.objective ?? ''
  status.value = goal.value?.status ?? 'active'
  error.value = ''
  editing.value = true
  void nextTick(() => objectiveInput.value?.focus())
}
async function save(clear = false) {
  if (busy.value || (!clear && !objective.value.trim())) return
  const current = ++generation
  busy.value = true
  error.value = ''
  try {
    let result: ThreadGoal | null = null
    if (clear) {
      if (!await clearThreadGoal(props.threadId)) throw new Error('Failed to clear goal')
    } else {
      result = await setThreadGoal(props.threadId, { objective: objective.value.trim(), status: status.value })
    }
    if (current !== generation) return
    goal.value = result
    editing.value = false
  } catch (cause) {
    if (current === generation) error.value = cause instanceof Error ? cause.message : 'Failed to save goal'
  } finally {
    if (current === generation) busy.value = false
  }
}
watch(() => props.threadId, () => {
  goal.value = null
  editing.value = false
  busy.value = false
  error.value = ''
  void load()
}, { immediate: true })
watch(() => props.inProgress, (running, previous) => {
  if (previous && !running && !busy.value) void load()
})
onBeforeUnmount(() => { generation++ })
defineExpose({ edit })
</script>

<template>
  <section v-if="goal || editing" class="thread-goal-panel" :aria-label="t('Goal')">
    <button v-if="goal && !editing" type="button" class="thread-goal-summary" :title="goal.objective" :aria-label="`${t('Edit goal')}: ${goal.objective}`" :aria-expanded="false" @click="edit">
      <strong>{{ t('Goal') }} · {{ goal.status }}</strong>
      <span class="thread-goal-preview">— {{ goal.objective }}</span>
    </button>
    <form v-if="editing" class="thread-goal-editor" @submit.prevent="save()">
      <strong>{{ t(goal ? 'Edit goal' : 'Set goal') }}</strong>
      <small v-if="goal">{{ goal.tokensUsed.toLocaleString() }} {{ t('tokens') }}<template v-if="goal.tokenBudget !== null"> / {{ goal.tokenBudget.toLocaleString() }}</template> · {{ Math.round(goal.timeUsedSeconds) }}s</small>
      <textarea ref="objectiveInput" v-model="objective" :aria-label="t('Goal objective')" :disabled="busy" rows="3" />
      <ComposerDropdown :model-value="status" :options="statusOptions" :disabled="busy" @update:model-value="status = $event as ThreadGoalStatus" />
      <p v-if="error" role="alert">{{ error }}</p>
      <div class="thread-goal-actions">
        <button v-if="goal" type="button" :disabled="busy" @click="save(true)">{{ t('Clear goal') }}</button>
        <button type="button" :disabled="busy" @click="editing = false">{{ t('Cancel') }}</button>
        <button type="submit" :disabled="busy || !objective.trim()">{{ t('Save goal') }}</button>
      </div>
    </form>
  </section>
</template>
