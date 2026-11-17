const test = require('node:test')
const assert = require('node:assert/strict')
const { mkdtemp, mkdir, writeFile, rm } = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { cliTurnUsage, codexQuotaSnapshot } = require('../../../src/agents/cli/cli-usage.cjs')

test('counts provider totals once and preserves explicit zero usage', () => {
  assert.deepEqual(cliTurnUsage('codex', { type: 'turn.completed', usage: {
    input_tokens: 12, cached_input_tokens: 8, output_tokens: 0,
  } }), { inputTokens: 12, outputTokens: 0 })
  assert.deepEqual(cliTurnUsage('claude', { type: 'result', usage: {
    input_tokens: 2, cache_read_input_tokens: 8, cache_creation_input_tokens: 3, output_tokens: 4,
  } }), { inputTokens: 13, outputTokens: 4 })
  assert.deepEqual(cliTurnUsage('gemini', { type: 'result', stats: { input_tokens: -1 } }), {})
  assert.deepEqual(cliTurnUsage('workbuddy', { type: 'message', usage: { output_tokens: 7 } }), {})
})

test('quota snapshots come only from the matching local Codex rollout', async t => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'meldwork-quota-'))
  t.after(() => rm(home, { recursive: true, force: true }))
  const id = '01900000-0000-7000-8000-000000000001'
  const date = new Date(parseInt('019000000000', 16)).toISOString().slice(0, 10)
  const dir = path.join(home, 'sessions', ...date.split('-'))
  await mkdir(dir, { recursive: true })
  const record = { type: 'event_msg', payload: { type: 'token_count', rate_limits: {
    primary: { window_minutes: 300, used_percent: 100 },
  } } }
  await writeFile(path.join(dir, `rollout-${date}-${id}.jsonl`), JSON.stringify(record))
  assert.deepEqual(await codexQuotaSnapshot(id, { CODEX_HOME: home }), { quotaMinutes1: 300, quotaRemaining1: 0 })
  assert.deepEqual(await codexQuotaSnapshot(id.replace(/1$/, '2'), { CODEX_HOME: home }), {})
  assert.deepEqual(await codexQuotaSnapshot('../sessions', { CODEX_HOME: home }), {})
})
