import { mount } from '@vue/test-utils'
import { expect, it } from 'vitest'
import TaskBoard from '../../components/TaskBoard.vue'

it('shows the latest attempt per topic, routes by topic and filters across groups', async () => {
  const groups = ['a', 'b'].map(id => ({ id, name: id, agentKinds: ['codex'] }))
  const messages = ['q1', 'q2', 'q3'].map((id, i) => ({ id, role: 'user', content: 'Task ' + i }))
  const first = { runId: 'r1', groupId: 'a', threadRootId: 'q1', targetKinds: ['codex'], status: 'failed', finishedAt: 8 }
  const retry = { ...first, runId: 'r2', finishedAt: undefined }
  const other = { ...first, runId: 'r3', groupId: 'b', threadRootId: 'q2', targetKinds: ['claude'], status: 'completed' }
  const waiting = { ...retry, runId: 'r4', threadRootId: 'q3' }
  const wrapper = mount(TaskBoard, { props: {
    snapshot: { groups, messages, runs: [retry, waiting], runOutcomes: [first, other] },
    gates: [{ runId: waiting.runId }], agents: [], groupName: group => group.name,
  } })
  expect(wrapper.findAll('.task-board-card')).toHaveLength(3)
  await wrapper.get('[data-column="attention"] button').trigger('click')
  expect(wrapper.emitted('open-task')[0][0]).toMatchObject({ groupId: 'a', threadRootId: 'q3' })
  await wrapper.get('select').setValue('claude')
  expect(wrapper.findAll('.task-board-card')).toHaveLength(1)
  expect(wrapper.get('[data-column="done"] strong').text()).toBe('Task 1')
})
