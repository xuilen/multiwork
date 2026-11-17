<template>
  <section v-if="tasks.length" class="task-board home-panel" aria-labelledby="task-board-title">
    <header class="home-panel-header">
      <h2 id="task-board-title">{{ t('board.title') }}</h2>
      <select v-model="filter" :aria-label="t('board.filter')">
        <option value="">{{ t('board.all') }}</option>
        <option v-for="kind in participants" :value="kind" :key="kind">{{ label(kind) }}</option>
      </select>
    </header>
    <div class="task-board-columns">
      <section v-for="column in columns" :key="column.key" :data-column="column.key">
        <h3>{{ t('board.' + column.key) }} <small>{{ column.items.length }}</small></h3>
        <p v-if="!column.items.length">{{ t('board.empty') }}</p>
        <button v-for="task in column.items.slice(0, expanded[column.key] ? undefined : 4)"
          :key="task.runId" type="button" class="task-board-card" @click="$emit('open-task', task)">
          <strong>{{ task.title }}</strong>
          <span>{{ task.group }} · {{ task.kinds.map(label).join('、') }}</span>
          <small>{{ task.detail }}</small>
        </button>
        <button v-if="column.items.length > 4" class="task-board-more" type="button"
          :aria-expanded="!!expanded[column.key]" @click="expanded[column.key] = !expanded[column.key]">
          {{ t(expanded[column.key] ? 'board.less' : 'board.more', { count: column.items.length - 4 }) }}
        </button>
      </section>
    </div>
  </section>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { agentLabel } from '../catalog.js'
import { t } from '../i18n.js'

const props = defineProps({
  snapshot: { type: Object, required: true },
  gates: { type: Array, required: true },
  agents: { type: Array, required: true },
  groupName: { type: Function, required: true },
})
defineEmits(['open-task'])
const filter = ref('')
const expanded = reactive({})
const labels = computed(() => new Map(props.agents.map(agent => [agent.kind, agent.label])))
const label = kind => labels.value.get(kind) || agentLabel(kind)
const tasks = computed(() => {
  const groups = new Map(props.snapshot.groups.map(group => [group.id, group]))
  const roots = new Map(props.snapshot.messages.filter(m => m.role === 'user').map(m => [m.id, m]))
  const gates = new Map(props.gates.map(gate => [gate.runId, gate]))
  const active = new Set(props.snapshot.runs.map(run => run.runId))
  const latest = new Map()
  for (const run of [...props.snapshot.runOutcomes, ...props.snapshot.runs]) {
    const group = groups.get(run.groupId)
    if (!group || !run.runId) continue
    const root = roots.get(run.threadRootId)
    const gate = gates.get(run.runId)
    const live = active.has(run.runId)
    const key = JSON.stringify([run.groupId, run.threadRootId || run.runId])
    const time = Number(new Date(run.finishedAt || run.startedAt || root?.createdAt || 0))
    if (!live && latest.has(key) && latest.get(key).time >= time) continue
    const column = gate ? 'attention' : live ? 'working' : run.status === 'completed' ? 'done' : 'attention'
    const agentKinds = run.targetKinds?.length ? run.targetKinds : root?.targetKinds || group.agentKinds || []
    latest.set(key, {
      runId: run.runId, groupId: group.id, threadRootId: root?.id || '', time, column,
      title: root?.content?.trim() || t('board.untitled'), group: props.groupName(group),
      kinds: agentKinds, detail: gate ? t('humanGate.waiting') : live ? t('run.status.running')
        : t('run.status.' + ({ 'round-limit': 'roundLimit', 'budget-exhausted': 'budgetExhausted', 'circuit-breaker': 'circuitBreaker' }[run.status] || run.status)),
    })
  }
  return [...latest.values()].sort((a, b) => b.time - a.time)
})
const participants = computed(() => [...new Set(tasks.value.flatMap(task => task.kinds))])
watch(participants, kinds => { if (!kinds.includes(filter.value)) filter.value = '' })
const columns = computed(() => ['attention', 'working', 'done'].map(key => ({
  key, items: tasks.value.filter(task => task.column === key && (!filter.value || task.kinds.includes(filter.value))),
})))
</script>
