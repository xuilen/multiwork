(() => {
  'use strict'
  // Illustrative, per-reply input/output pairs. No provider calls or account access.
  const samples = {
    codex: { name: 'Codex', turns: [[640,160],[980,240],[820,200],[1460,360],[1100,280],[1600,400],[1420,350],[2220,610]], remaining: 72 },
    claude: { name: 'Claude Code', turns: [[420,110],[740,230],[920,340],[600,180],[1470,370],[1420,390],[860,210],[1620,450]] },
    gemini: { name: 'Gemini CLI', turns: null },
  }
  const buttons = [...document.querySelectorAll('[data-agent]')]
  const byId = id => document.getElementById(id)
  const scale = 3000 // fixed token scale so the two reported sessions can be compared
  let selected = 'codex'
  function render() {
    const en = document.documentElement.lang === 'en'
    const t = (zh, english) => en ? english : zh
    const sample = samples[selected]
    const format = new Intl.NumberFormat(en ? 'en-US' : 'zh-CN')
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.agent === selected))
    const chart = byId('chart')
    chart.replaceChildren()
    chart.setAttribute('aria-label', t('各条回复上报的输入和输出 tokens', 'Reported input and output tokens by reply'))
    const axis = document.querySelector('.axis')
    axis.style.visibility = sample.turns ? 'visible' : 'hidden'
    let input = 0
    let output = 0
    if (sample.turns) {
      for (const [index, [incoming, outgoing]] of sample.turns.entries()) {
        input += incoming
        output += outgoing
        const bar = document.createElement('span')
        bar.className = 'bar'
        bar.title = t('回复', 'Reply') + ' ' + (index + 1) + ' · ' + t('输入', 'Input') + ' ' + incoming + ' / ' + t('输出', 'Output') + ' ' + outgoing
        for (const [type, value] of [['out', outgoing], ['in', incoming]]) {
          const segment = document.createElement('i')
          segment.className = type
          segment.style.height = (value / scale * 100) + '%'
          bar.append(segment)
        }
        chart.append(bar)
      }
    } else {
      const blank = document.createElement('span')
      blank.className = 'empty-bar'
      blank.textContent = t('这些示例回复未返回 token 统计', 'These sample replies returned no token counts')
      chart.setAttribute('aria-label', blank.textContent)
      chart.append(blank)
    }
    const counts = { total: input + output, input, output }
    for (const [id, count] of Object.entries(counts)) byId(id).textContent = sample.turns ? format.format(count) : '—'
    byId('scope').textContent = sample.remaining == null ? t('回复时的额度快照', 'Quota at reply time') : t('回复时 · 5 小时窗口剩余', 'At reply · 5-hour quota remaining')
    byId('quota').textContent = sample.remaining == null ? t('本例未报告', 'Not reported') : sample.remaining + '%'
    byId('announcement').textContent = sample.name + ' · ' + (sample.turns ? format.format(input + output) + ' tokens' : t('未报告用量', 'Usage not reported'))
  }
  for (const button of buttons) button.addEventListener('click', () => { selected = button.dataset.agent; render() })
  document.addEventListener('multiwork-language', render)
  render()
})()
