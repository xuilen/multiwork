const tokenFields = ['inputTokens', 'outputTokens']
const encoder = new TextEncoder()

export function quotaWindows(context) {
  const windows = []
  for (const index of [1, 2]) {
    const minutes = context?.['quotaMinutes' + index]
    const percent = context?.['quotaRemaining' + index]
    if (Number.isSafeInteger(minutes) && minutes > 0 && minutes <= 525600
        && Number.isSafeInteger(percent) && percent >= 0 && percent <= 100) {
      windows.push({ minutes, percent })
    }
  }
  return windows
}

export function quotaPeriodLabel(minutes, t) {
  return minutes % 1440 === 0 ? t('run.days', { count: minutes / 1440 })
    : minutes % 60 === 0 ? t('run.hours', { count: minutes / 60 }) : t('run.minutes', { count: minutes })
}

export function summarizeAgentUsage(messages, { start, end, estimateMissing = false, includeQuota = false } = {}) {
  const byKind = new Map()
  for (const message of messages) {
    if (message.role !== 'agent' || !message.agentKind) continue
    const time = (start !== undefined || includeQuota) && message.createdAt != null
      ? new Date(message.createdAt).getTime() : NaN
    if (start !== undefined && !(time >= start && time < end)) continue
    const kind = message.agentKind
    const row = byKind.get(kind) || { kind, metrics: {}, total: 0, reported: 0, estimated: {} }
    const context = message.trace?.context
    if (includeQuota && Number.isFinite(time) && time >= (row.quota?.time ?? -Infinity)) {
      const windows = quotaWindows(context)
      if (windows.length) row.quota = { time, windows }
    }
    let reported = false
    for (const field of tokenFields) {
      const value = context?.[field]
      if (Number.isSafeInteger(value) && value >= 0) {
        row.metrics[field] = (row.metrics[field] ?? 0) + value
        reported = true
      } else if (estimateMissing) {
        const bytes = field === 'inputTokens' ? context?.promptBytes
          : message.content ? encoder.encode(message.content).length : 0
        if (bytes > 0) row.estimated[field] = (row.estimated[field] ?? 0) + Math.ceil(bytes / 4)
      }
    }
    row.total++
    if (reported) row.reported++
    byKind.set(kind, row)
  }
  return [...byKind.values()]
}
