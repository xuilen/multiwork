import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import WorkspaceUsage from '../../components/WorkspaceUsage.vue'
import { summarizeAgentUsage } from '../../agentUsage.js'
import { locale, setLocale } from '../../i18n.js'

const reply = (groupId, agentKind, createdAt, context) => ({
  groupId, role: 'agent', agentKind, createdAt, trace: { context }, content: '你好',
})
let wrapper
let originalLocale
beforeEach(() => {
  originalLocale = locale.value
  setLocale('en')
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 10, 18, 23, 59, 59))
})
afterEach(() => {
  wrapper?.unmount()
  vi.useRealTimers()
  setLocale(originalLocale)
})

it('aggregates saved replies across conversations using local calendar days and refreshes at midnight', async () => {
  wrapper = mount(WorkspaceUsage, { props: { agents: [{ kind: 'custom', label: 'Research' }], messages: [
    reply('group-a', 'custom', new Date(2026, 10, 12).toISOString(), { inputTokens: 8 }),
    reply('direct-b', 'custom', new Date(2026, 10, 18).toISOString(), { inputTokens: 4, outputTokens: 0 }),
    reply('direct-b', 'codex', new Date(2026, 10, 11, 23, 59).toISOString(), { inputTokens: 20 }),
    reply('group-a', 'custom', undefined, { outputTokens: 7 }),
    reply('group-a', 'claude', new Date(2026, 10, 18).toISOString(), {}),
    { ...reply('group-a', 'custom', new Date().toISOString(), { inputTokens: 30 }), role: 'system' },
  ] } })
  const table = () => wrapper.findAll('tbody tr').map(row => row.findAll('th, td').map(cell => cell.text()))
  expect(table()).toEqual([['Research', '12', '0', '2 / 2'], ['Claude Code', '—', '—', '0 / 1']])
  await wrapper.get('select').setValue('all')
  expect(table()[0]).toEqual(['Codex', '20', '—', '1 / 1'])
  expect(table()[1]).toEqual(['Research', '12', '7', '3 / 3'])
  await wrapper.get('select').setValue('today')
  expect(table()[0]).toEqual(['Research', '4', '0', '1 / 1'])
  await vi.advanceTimersByTimeAsync(1000)
  expect(wrapper.get('[role="status"]').text()).toBe('No saved Agent replies in this period.')
  await wrapper.setProps({ messages: [reply('direct-b', 'codex', new Date().toISOString(), { outputTokens: 5 })] })
  expect(table()).toEqual([['Codex', '—', '5', '1 / 1']])
  await wrapper.setProps({ messages: [] })
  expect(wrapper.find('section').exists()).toBe(false)
})

it('keeps conversation estimates separate from reported counts and preserves a reported zero', () => {
  const messages = [reply('group', 'codex', undefined, { promptBytes: 9, outputTokens: 0 }),
    reply('group', 'codex', undefined, { inputTokens: 4 })]
  expect(summarizeAgentUsage(messages)[0]).toMatchObject({ metrics: { inputTokens: 4, outputTokens: 0 }, estimated: {} })
  expect(summarizeAgentUsage(messages, { estimateMissing: true })[0]).toMatchObject({
    total: 2, reported: 2, estimated: { inputTokens: 3, outputTokens: 2 },
  })
})

it('shows one dated quota snapshot per Agent within the selected period, independently of token coverage', async () => {
  const seen = new Date(2026, 10, 17, 12).toISOString()
  const earlier = new Date(2026, 10, 16).toISOString()
  const later = new Date(2026, 10, 18).toISOString()
  const windows = { quotaMinutes1: 300, quotaRemaining1: 0, quotaMinutes2: 10080, quotaRemaining2: 84 }
  wrapper = mount(WorkspaceUsage, { props: { agents: [], messages: [
    reply('b', 'codex', seen, windows),
    reply('a', 'codex', earlier, { quotaMinutes1: 60, quotaRemaining1: 99 }),
    reply('b', 'codex', later, { quotaMinutes1: 300, quotaRemaining1: 101 }),
    reply('b', 'codex', undefined, { quotaMinutes1: 10, quotaRemaining1: 42 }),
    reply('a', 'claude', later, { inputTokens: 3 }),
  ] } })
  const quotas = () => wrapper.findAll('.usage-quota').map(cell => cell.text())
  expect(quotas()[0]).toBe('—')
  expect(quotas()[1]).toContain('5h: 0% remaining')
  expect(quotas()[1]).toContain('7d: 84% remaining')
  expect(wrapper.get('time').attributes('datetime')).toBe(seen)
  expect(wrapper.text()).toContain('0 / 3')
  await wrapper.get('select').setValue('today')
  expect(quotas()).toEqual([])
  await wrapper.get('select').setValue('all')
  expect(wrapper.get('time').attributes('datetime')).toBe(seen)
  await wrapper.setProps({ messages: [...wrapper.props('messages'),
    reply('a', 'codex', later, { quotaMinutes1: 90, quotaRemaining1: 100 })] })
  expect(quotas()[1]).toContain('90m: 100% remaining')
  expect(quotas()[1]).not.toContain('7d')
  expect(wrapper.get('time').attributes('datetime')).toBe(later)
})
