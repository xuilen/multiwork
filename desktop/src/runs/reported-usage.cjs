const limits = Object.freeze({
  inputTokens: Number.MAX_SAFE_INTEGER,
  outputTokens: Number.MAX_SAFE_INTEGER,
  quotaMinutes1: 525600,
  quotaMinutes2: 525600,
  quotaRemaining1: 100,
  quotaRemaining2: 100,
})

function reportedUsage(input) {
  return Object.fromEntries(Object.entries(limits)
    .filter(([key, max]) => Number.isSafeInteger(input?.[key]) && input[key] >= 0 && input[key] <= max)
    .map(([key]) => [key, input[key]]))
}

module.exports = { reportedUsage, usageFields: Object.keys(limits) }
