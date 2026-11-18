<template>
  <section v-if="hasReplies" class="workspace-usage home-panel" aria-labelledby="workspace-usage-title">
    <header class="home-panel-header">
      <div>
        <h2 id="workspace-usage-title">{{ t('usage.title') }}</h2>
        <p>{{ t('usage.description') }}</p>
      </div>
      <select v-model="period" :aria-label="t('usage.period')">
        <option v-for="choice in periods" :key="choice" :value="choice">{{ t('usage.' + choice) }}</option>
      </select>
    </header>
    <div v-if="rows.length" class="usage-table-scroll">
      <table :aria-label="t('usage.title')">
        <thead>
          <tr>
            <th scope="col">{{ t('trace.agentSelector') }}</th>
            <th scope="col">{{ t('usage.input') }}</th>
            <th scope="col">{{ t('usage.output') }}</th>
            <th scope="col">{{ t('usage.coverage') }}</th>
            <th v-if="hasQuota" scope="col">{{ t('usage.quota') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in rows" :key="entry.kind">
            <th scope="row">{{ labels.get(entry.kind) || agentLabel(entry.kind) }}</th>
            <td>{{ formatTokens(entry.metrics.inputTokens) }}</td>
            <td>{{ formatTokens(entry.metrics.outputTokens) }}</td>
            <td :aria-label="t('run.reportedReplies', entry)">{{ entry.reported }} / {{ entry.total }}</td>
            <td v-if="hasQuota" class="usage-quota">
              <template v-if="entry.quota">
                <span v-for="(window, index) in entry.quota.windows" :key="index">
                  {{ t('usage.windowRemaining', { period: quotaPeriodLabel(window.minutes, t), percent: window.percent }) }}
                </span>
                <time :datetime="new Date(entry.quota.time).toISOString()">
                  {{ t('usage.atReply', { time: dateFormat.format(entry.quota.time) }) }}
                </time>
              </template>
              <template v-else>—</template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else class="usage-empty" role="status">{{ t('usage.empty') }}</p>
  </section>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { quotaPeriodLabel, summarizeAgentUsage } from '../agentUsage.js'
import { agentLabel } from '../catalog.js'
import { locale, t } from '../i18n.js'

const props = defineProps({
  messages: { type: Array, required: true },
  agents: { type: Array, required: true },
})
const labels = computed(() => new Map(props.agents.map(agent => [agent.kind, agent.label])))
const periods = ['today', 'week', 'all']
const period = ref('week')
const day = ref(new Date().setHours(0, 0, 0, 0))
const hasReplies = computed(() => props.messages.some(message => message.role === 'agent' && message.agentKind))
let midnightTimer

function dayBoundary(offset) {
  const boundary = new Date(day.value)
  return new Date(boundary.getFullYear(), boundary.getMonth(), boundary.getDate() + offset).getTime()
}

function refreshDay() {
  clearTimeout(midnightTimer)
  day.value = new Date().setHours(0, 0, 0, 0)
  midnightTimer = setTimeout(refreshDay, dayBoundary(1) - Date.now())
}

onMounted(() => {
  refreshDay()
  window.addEventListener('focus', refreshDay)
})
onBeforeUnmount(() => {
  clearTimeout(midnightTimer)
  window.removeEventListener('focus', refreshDay)
})

const rows = computed(() => {
  const range = period.value === 'all' ? {} : {
    start: dayBoundary(period.value === 'today' ? 0 : -6), end: dayBoundary(1),
  }
  const total = row => (row.metrics.inputTokens ?? 0) + (row.metrics.outputTokens ?? 0)
  return summarizeAgentUsage(props.messages, { ...range, includeQuota: true }).sort((left, right) => total(right) - total(left))
})
const hasQuota = computed(() => rows.value.some(entry => entry.quota))
const dateFormat = computed(() => new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'short' }))
const formatTokens = value => value == null ? '—' : value.toLocaleString(locale.value)
</script>

<style scoped>
.workspace-usage { margin-block: 14px; }
.home-panel-header { align-items: center; flex-wrap: wrap; }
select { background: var(--surface); color: inherit; border: 1px solid var(--border); border-radius: 6px; padding: 4px 8px; }
.usage-table-scroll { max-width: 100%; overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
th, td { text-align: end; padding: 7px 5px; font-size: var(--text-sm); }
th:first-child { text-align: start; overflow-wrap: anywhere; }
thead th, .usage-empty { color: var(--muted); }
tbody tr { border-top: 1px solid var(--border); }
td { white-space: nowrap; }
.usage-quota span, .usage-quota time { display: block; }
.usage-quota time { color: var(--muted); font-size: var(--text-xs); }
</style>
