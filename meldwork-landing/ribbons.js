// Two folded bands traverse the hero. Draw once for reduced motion and while offscreen.
(() => {
  const canvas = document.getElementById('ribbons')
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  let width = 0, height = 0, visible = true, frame = 0, previous = 0, phase = 0
  function draw() {
    ctx.clearRect(0, 0, width, height)
    const light = document.documentElement.dataset.theme === 'light'
    for (let band = 0; band < 2; band++) {
      const gradient = ctx.createLinearGradient(0, height, width, height * .2)
      gradient.addColorStop(0, light ? '#196c87' : '#54c5d5')
      gradient.addColorStop(.42, light ? '#53949c' : '#89e0da')
      gradient.addColorStop(.72, light ? '#646799' : '#8b9ad8')
      gradient.addColorStop(1, light ? '#8569ab' : '#c1a3ed')
      ctx.strokeStyle = gradient
      for (let line = 0; line <= 42; line++) {
        const v = line / 42
        ctx.globalAlpha = (band ? .16 : .24) + .30 * Math.pow(Math.cos(v * Math.PI), 4)
        ctx.lineWidth = line % 7 === 0 ? 1.5 : .85
        ctx.beginPath()
        for (let step = 0; step <= 94; step++) {
          const u = step / 94
          const twist = u * 7.5 + phase * .28 + band * 1.35
          const center = .87 - .47 * u + .18 * Math.sin(u * 5.8 + phase * .24 + band * .48)
          const fold = (v - .5) * (.08 + .42 * Math.sin(twist)) + .075 * Math.sin(v * Math.PI) * Math.cos(twist)
          const x = (u * 1.06 - .03) * width
          const y = (center + fold + band * .09) * height
          if (step === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1
  }
  function tick(time) {
    if (time - previous >= 50) {
      phase += Math.min(time - previous, 100) / 1000
      previous = time
      draw()
    }
    frame = requestAnimationFrame(tick)
  }
  function sync() {
    cancelAnimationFrame(frame)
    if (!visible || document.hidden || !width) return
    draw()
    if (!motion.matches) { previous = performance.now(); frame = requestAnimationFrame(tick) }
  }
  function size() {
    const box = canvas.getBoundingClientRect()
    width = box.width
    height = box.height
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5)
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    sync()
  }
  new ResizeObserver(size).observe(canvas)
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync() }).observe(canvas)
  document.addEventListener('visibilitychange', sync)
  document.addEventListener('meldwork:themechange', sync)
  motion.addEventListener('change', sync)
  size()
})()
