const fs = require('node:fs/promises')
const path = require('node:path')

function cliTurnUsage(kind, event) {
  let input, output
  if (kind === 'codex' && event.type === 'turn.completed') {
    input = event.usage?.input_tokens
    output = event.usage?.output_tokens
  } else if (event.type === 'result' && ['claude', 'qwen', 'workbuddy'].includes(kind)) {
    const usage = event.usage
    input = usage?.input_tokens
    // Anthropic reports cached reads and cache creation separately from input.
    if (kind === 'claude' && Number.isSafeInteger(input)) {
      input += (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0)
    }
    output = usage?.output_tokens
  } else if (kind === 'gemini' && event.type === 'result') {
    input = event.stats?.input_tokens
    output = event.stats?.output_tokens
  }
  return Object.fromEntries(Object.entries({ inputTokens: input, outputTokens: output })
    .filter(([, value]) => Number.isSafeInteger(value) && value >= 0))
}

// The CLI's exec stream contains token counts. Its matching local rollout also
// carries the provider's quota windows. Read only the bounded tail of that run.
async function codexQuotaSnapshot(sessionId, env) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) return {}
  const home = env.CODEX_HOME || ((env.USERPROFILE || env.HOME) && path.join(env.USERPROFILE || env.HOME, '.codex'))
  if (!home || !path.isAbsolute(home)) return {}
  const started = parseInt(sessionId.replaceAll('-', '').slice(0, 12), 16)
  for (const offset of [0, -86400000, 86400000]) {
    let handle
    try {
      const date = new Date(started + offset).toISOString().slice(0, 10)
      const folder = path.join(home, 'sessions', ...date.split('-'))
      const filename = (await fs.readdir(folder)).find(name => name.startsWith('rollout-') && name.endsWith(`-${sessionId}.jsonl`))
      if (!filename) continue
      handle = await fs.open(path.join(folder, filename), 'r')
      const { size } = await handle.stat()
      const buffer = Buffer.alloc(Math.min(size, 262144))
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, size - buffer.length)
      for (const line of buffer.toString('utf8', 0, bytesRead).split('\n').reverse()) {
        if (!line.includes('"rate_limits"')) continue
        let event
        try { event = JSON.parse(line) } catch { continue }
        if (event.type !== 'event_msg' || event.payload?.type !== 'token_count') continue
        const limits = event.payload.rate_limits
        const result = {}
        for (const [index, window] of [limits?.primary, limits?.secondary].entries()) {
          if (!window || !Number.isFinite(window.used_percent) || window.used_percent < 0 || window.used_percent > 100
              || !Number.isSafeInteger(window.window_minutes) || window.window_minutes <= 0) continue
          result[`quotaMinutes${index + 1}`] = window.window_minutes
          result[`quotaRemaining${index + 1}`] = Math.round(100 - window.used_percent)
        }
        if (Object.keys(result).length) return result
      }
    } catch { /* Older and ephemeral sessions can lack a local quota report. */ }
    finally { await handle?.close().catch(() => {}) }
  }
  return {}
}

module.exports = { cliTurnUsage, codexQuotaSnapshot }
