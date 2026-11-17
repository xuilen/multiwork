(() => {
  'use strict'
  const root = document.documentElement
  const langButton = document.getElementById('language')
  const themeButton = document.getElementById('theme')
  const labels = [...document.querySelectorAll('[data-en]')].map(el => [el, el.textContent])
  const images = [...document.querySelectorAll('[data-alt-en]')].map(el => [el, el.alt])
  function read(key) { try { return localStorage.getItem(key) } catch { return null } }
  function write(key, value) { try { localStorage.setItem(key, value) } catch { /* optional */ } }
  function setLanguage(en) {
    root.lang = en ? 'en' : 'zh-CN'
    for (const [el, zh] of labels) el.textContent = en ? el.dataset.en : zh
    for (const [el, zh] of images) el.alt = en ? el.dataset.altEn : zh
    document.title = en ? 'multiwork · Multi-agent desktop workspace' : 'multiwork · 多 Agent 桌面工作台'
    langButton.textContent = en ? '中文' : 'EN'
    langButton.setAttribute('aria-label', en ? '切换为中文' : 'Switch to English')
    themeButton.setAttribute('aria-label', en ? 'Toggle color theme' : '切换配色')
    document.dispatchEvent(new Event('multiwork-language'))
  }
  function setTheme(dark) {
    root.dataset.theme = dark ? 'dark' : 'light'
    themeButton.setAttribute('aria-pressed', String(dark))
  }
  const saved = read('meldwork-landing-locale')
  setLanguage(saved ? saved === 'en' : !navigator.language.toLowerCase().startsWith('zh'))
  setTheme(read('meldwork-landing-theme') === 'dark')
  langButton.addEventListener('click', () => {
    const en = root.lang !== 'en'
    write('meldwork-landing-locale', en ? 'en' : 'zh')
    setLanguage(en)
  })
  themeButton.addEventListener('click', () => {
    const dark = root.dataset.theme !== 'dark'
    write('meldwork-landing-theme', dark ? 'dark' : 'light')
    setTheme(dark)
  })
})()
