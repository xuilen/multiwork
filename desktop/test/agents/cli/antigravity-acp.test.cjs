const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const {
  detectAgents,
  imageAttachmentLimit,
  invocation,
  runAgent,
  searchPath,
  shutdownAcpSessionRuntime,
} = require('../../../src/agents/cli/cli-adapters.cjs')
const { probeAgentCapabilities } = require('../../../src/agents/cli/cli-discovery.cjs')
const { automaticPermissionResponse } = require('../../../src/agents/agent-permission-policy.cjs')
const { nativeCredentialState } = require('../../../src/agents/local-agent-readiness.cjs')
const { nativeAuthIdentityFiles } = require('../../../src/agents/native-config-directory.cjs')
const { listLocalAgentSkills } = require('../../../src/skills/local-skill-catalog.cjs')
const { executable } = require('../../support/cli-adapters-test-helpers.cjs')

test('Antigravity discovery searches Windows agy bin and verifies ACP compatibility', async () => {
  const searched = searchPath({
    platform: 'win32',
    home: 'C:\\Users\\tester',
    env: { LOCALAPPDATA: 'C:\\Users\\tester\\AppData\\Local' },
  })
  assert.ok(searched.split(';').includes('C:\\Users\\tester\\AppData\\Local\\agy\\bin'))

  const compat = await probeAgentCapabilities('antigravity', 'agy', {
    version: '1.5.9',
    execFileFn: async (_cmd, args) => {
      assert.deepEqual(args, ['acp', '--help'])
      return { stdout: 'Start the Agent Client Protocol (ACP) stdio server\n  --stdio\n', stderr: '' }
    },
  })
  assert.equal(compat.compatibilityState, 'compatible')

  const agents = await detectAgents({
    platform: 'win32',
    env: {},
    resolveExecutableFn: async kind => kind === 'antigravity' ? 'C:\\Users\\tester\\AppData\\Local\\agy\\bin\\agy.exe' : null,
    execFileFn: async () => ({ stdout: '1.5.9\n', stderr: '' }),
    probeAgentCapabilitiesFn: async () => ({ compatibilityState: 'compatible' }),
  })
  assert.equal(agents.length, 1)
  assert.equal(agents[0].kind, 'antigravity')
  assert.equal(agents[0].name, 'Antigravity CLI')
  assert.equal(agents[0].version, '1.5.9')
  assert.equal(agents[0].resolvedVersion, '1.5.9')
})

test('Antigravity ACP enforces read-only permissions, forwards workspace-write approvals, resumes sessions, and maps auth errors', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'meldwork-antigravity-'))
  const logFile = path.join(directory, 'acp-log.jsonl')
  const imageFile = path.join(directory, 'sample.png')
  fs.writeFileSync(imageFile, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))

  const fakeScript = `
const fs = require('node:fs')
const readline = require('node:readline')
const logFile = ${JSON.stringify(logFile)}
const input = readline.createInterface({ input: process.stdin })
const send = message => process.stdout.write(JSON.stringify(message) + '\\n')
let pendingPrompt = null
input.on('line', line => {
  if (!line.trim()) return
  const msg = JSON.parse(line)
  fs.appendFileSync(logFile, JSON.stringify(msg) + '\\n')
  if (msg.method === 'initialize') {
    send({ jsonrpc: '2.0', id: msg.id, result: {
      protocolVersion: 1,
      agentCapabilities: { promptCapabilities: { image: true }, sessionCapabilities: { resume: {} } },
    } })
  } else if (msg.method === 'session/new') {
    send({ jsonrpc: '2.0', id: msg.id, result: {
      sessionId: 'agy-sess-1',
      modes: { currentModeId: 'default', availableModes: ['default', 'plan'] },
    } })
  } else if (msg.method === 'session/resume') {
    if (msg.params?.sessionId !== 'agy-sess-1') process.exit(2)
    send({ jsonrpc: '2.0', id: msg.id, result: {
      modes: { currentModeId: 'default', availableModes: ['default', 'plan'] },
    } })
  } else if (msg.method === 'session/set_mode') {
    send({ jsonrpc: '2.0', id: msg.id, result: {} })
  } else if (msg.method === 'session/prompt') {
    const text = (msg.params?.prompt || []).find(block => block.type === 'text')?.text || ''
    if (text === 'unauth') {
      send({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: 'You are not logged into Antigravity.' } })
      return
    }
    pendingPrompt = msg
    send({ jsonrpc: '2.0', method: 'session/update', params: { sessionId: 'agy-sess-1', update: { sessionUpdate: 'user_message_chunk', content: { type: 'text', text } } } })
    send({ jsonrpc: '2.0', method: 'session/update', params: { sessionId: 'agy-sess-1', update: { sessionUpdate: 'current_mode_update', currentModeId: 'default' } } })
    send({ jsonrpc: '2.0', id: '1', method: 'session/request_permission', params: {
      sessionId: 'agy-sess-1',
      toolCall: { toolCallId: 'edit-1', title: 'Write file', kind: 'edit', status: 'pending' },
      options: [
        { optionId: 'allow', name: 'Allow once', kind: 'allow_once' },
        { optionId: 'deny', name: 'Deny', kind: 'reject_once' },
      ],
    } })
  } else if (msg.id === '1' && pendingPrompt) {
    const decision = msg.result?.outcome?.optionId || ''
    const hasImage = (pendingPrompt.params?.prompt || []).some(block => block.type === 'image')
    send({ jsonrpc: '2.0', method: 'session/update', params: {
      sessionId: 'agy-sess-1',
      update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: \`decision=\${decision};image=\${hasImage}\` } },
    } })
    const doneId = pendingPrompt.id
    pendingPrompt = null
    send({ jsonrpc: '2.0', id: doneId, result: { stopReason: 'end_turn' } })
  }
})
`
  let cli
  if (process.platform === 'win32') {
    const targetDir = path.join(directory, 'node_modules', 'agy-cli')
    fs.mkdirSync(targetDir, { recursive: true })
    fs.writeFileSync(path.join(targetDir, 'agy.cjs'), fakeScript)
    cli = path.join(directory, 'agy.cmd')
    fs.writeFileSync(cli, '@ECHO off\r\n"%~dp0\\node.exe" "%~dp0\\node_modules\\agy-cli\\agy.cjs" %*\r\n')
  } else {
    cli = executable(directory, 'agy.cjs', fakeScript)
  }

  t.after(async () => {
    await shutdownAcpSessionRuntime()
    fs.rmSync(directory, { recursive: true, force: true })
  })

  assert.equal(imageAttachmentLimit('antigravity'), 4)
  const spec = invocation('antigravity', cli, directory, '', { sandbox: 'read-only', attachments: [imageFile] })
  assert.deepEqual(spec.args, ['acp'])
  assert.equal(spec.acpMode, 'default')
  assert.equal(spec.eventTransport, 'acp')
  assert.deepEqual(spec.imageAttachments, [imageFile])

  const agent = { kind: 'antigravity', executable: cli, name: 'Antigravity' }
  const first = await runAgent(agent, 'hello', directory, {
    sandbox: 'read-only',
    onPermissionRequest: request => automaticPermissionResponse(request, { allowWrite: false }),
  })
  assert.equal(first.text, 'decision=deny;image=false')
  assert.equal(first.sessionRef, 'agy-sess-1')

  const deniedByDefault = await runAgent(agent, 'fallback-deny', directory, {
    sandbox: 'read-only',
    sessionRef: first.sessionRef,
  })
  assert.equal(deniedByDefault.text, 'decision=deny;image=false')

  const resumed = await runAgent(agent, 'again', directory, {
    sandbox: 'workspace-write',
    sessionRef: first.sessionRef,
    attachments: [imageFile],
    onPermissionRequest: () => ({ status: 'approved', optionId: 'allow' }),
  })
  assert.equal(resumed.text, 'decision=allow;image=true')

  await assert.rejects(
    runAgent(agent, 'unauth', directory, { sandbox: 'read-only' }),
    { code: 'LOCAL_AGENT_AUTH_REQUIRED' },
  )
})

test('Antigravity native credential checks, identity files, and skill roots stay scoped cleanly', (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'meldwork-antigravity-home-'))
  t.after(() => fs.rmSync(home, { recursive: true, force: true }))

  assert.deepEqual(nativeCredentialState('antigravity', { home, env: {} }), {
    state: 'unknown',
    source: 'unverified',
  })

  fs.mkdirSync(path.join(home, '.gemini', 'antigravity-cli'), { recursive: true })
  fs.writeFileSync(path.join(home, '.gemini', '.env'), 'GEMINI_API_KEY=example-test-value\n')
  assert.deepEqual(nativeCredentialState('antigravity', { home, env: {} }), {
    state: 'ready',
    source: 'native-credential',
  })

  const identityFiles = nativeAuthIdentityFiles('antigravity', { USERPROFILE: home }, home, 'win32')
  assert.ok(identityFiles.includes(path.win32.join(home, '.gemini', 'antigravity-cli', 'settings.json')))
  assert.ok(identityFiles.includes(path.win32.join(home, '.gemini', '.env')))

  const skillDir = path.join(home, '.gemini', 'antigravity', 'skills', 'demo-skill')
  fs.mkdirSync(skillDir, { recursive: true })
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: demo-skill\ndescription: Demo skill\n---\nBody\n')
  const catalog = listLocalAgentSkills('antigravity', { home, cwd: home })
  assert.ok(catalog.skills.some(skill => skill.slug === 'demo-skill'))
})
