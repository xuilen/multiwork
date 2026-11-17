const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { JSDOM } = require('../../frontend/node_modules/jsdom')

const root = path.join(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
function page(language = 'zh-CN', blocked = false) {
  const dom = new JSDOM(read('index.html'), { runScripts: 'outside-only', url: 'https://xuilen.github.io/multiwork/' })
  const { window } = dom
  Object.defineProperty(window.navigator, 'language', { value: language })
  if (blocked) Object.defineProperty(window, 'localStorage', { get() { throw Error('Unavailable') } })
  for (const file of ['i18n.js', 'main.js']) window.eval(read(file))
  const doc = window.document
  return { doc, dom, value: id => doc.getElementById(id).textContent, pick: agent => doc.querySelector('[data-agent="' + agent + '"]').click() }
}

test('release download, credit, license copies and local site assets match the distribution', () => {
  const { doc, dom } = page()
  try {
    const version = require('../../desktop/package.json').version
    assert.equal(version, require('../../frontend/package.json').version)
    assert.equal(doc.querySelector('.primary').href, 'https://github.com/xuilen/multiwork/releases/download/v' + version + '/multiwork-' + version + '-windows-x64.zip')
    assert.equal(doc.querySelector('link[rel=canonical]').href, 'https://xuilen.github.io/multiwork/')
    assert.ok(doc.querySelector('footer a[href="https://github.com/Ryder-Sun/Meldwork"]'))
    for (const name of ['LICENSE', 'NOTICE', 'COMMERCIAL_USE.md']) assert.equal(read(name), read('../' + name))
    for (const el of doc.querySelectorAll('[src],link[rel=stylesheet],link[rel=icon]')) {
      const src = (el.getAttribute('src') || el.getAttribute('href')).split('?')[0]
      assert.ok(fs.existsSync(path.join(root, src)), src)
    }
    for (const a of doc.querySelectorAll('a[href^="#"]')) assert.ok(doc.getElementById(a.hash.slice(1)))
  } finally { dom.window.close() }
})

test('sample replies add up, switches clear stale details and unavailable usage stays unknown', () => {
  const { doc, dom, value, pick } = page()
  try {
    assert.equal(value('total'), '12,840')
    assert.equal(value('input'), '10,240')
    assert.equal(value('output'), '2,600')
    assert.equal(value('quota'), '72%')
    assert.equal(doc.querySelectorAll('.bar').length, 8)
    pick('claude')
    assert.equal(value('total'), '10,330')
    assert.equal(value('quota'), '本例未报告')
    assert.equal(doc.querySelector('[aria-pressed="true"][data-agent]').dataset.agent, 'claude')
    pick('gemini')
    for (const id of ['total','input','output']) assert.equal(value(id), '—')
    assert.equal(doc.querySelectorAll('.bar').length, 0)
    pick('codex')
    assert.equal(value('quota'), '72%')
    assert.equal(doc.querySelectorAll('.bar').length, 8)
  } finally { dom.window.close() }
})

test('language and color controls work without storage and keep the selected sample', () => {
  const { doc, dom, value, pick } = page('en-US', true)
  try {
    assert.equal(doc.documentElement.lang, 'en')
    pick('gemini')
    assert.equal(value('quota'), 'Not reported')
    doc.getElementById('language').click()
    assert.equal(doc.documentElement.lang, 'zh-CN')
    assert.equal(value('quota'), '本例未报告')
    assert.equal(doc.querySelector('[data-agent="gemini"]').getAttribute('aria-pressed'), 'true')
    doc.getElementById('theme').click()
    assert.equal(doc.documentElement.dataset.theme, 'dark')
    doc.getElementById('theme').click()
    assert.equal(doc.documentElement.dataset.theme, 'light')
  } finally { dom.window.close() }
})
