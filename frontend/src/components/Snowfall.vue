<template>
  <div class="snowfall" aria-hidden="true">
    <i v-for="(flake, index) in flakes" :key="index" :style="flake" />
  </div>
</template>

<script setup>
// A fixed field keeps navigation and theme changes from reshuffling the snow.
const flakes = Array.from({ length: 22 }, (_, i) => ({
  left: `${(i * 37 + 3) % 100}%`,
  '--size': `${1.3 + (i % 4) * 0.55}px`,
  '--drift': `${12 + i % 5 * 5}px`,
  '--duration': `${12 + i % 8}s`,
  '--delay': `-${(i * 3.7) % (12 + i % 8)}s`,
  opacity: 0.32 + i % 4 * 0.13,
}))
</script>

<style scoped>
.snowfall {
  position: absolute;
  inset: 0;
  container-type: size;
  overflow: hidden;
  pointer-events: none;
  user-select: none;
  color: var(--snow-color, #d8eef5);
}
.snowfall i {
  position: absolute;
  top: -5px;
  width: var(--size);
  height: var(--size);
  border-radius: 50%;
  background: currentColor;
  animation: snow-descent var(--duration) linear var(--delay) infinite;
}
@keyframes snow-descent {
  from { transform: translate3d(0, 0, 0); }
  48% { transform: translate3d(var(--drift), 48cqh, 0); }
  to { transform: translate3d(6px, calc(100cqh + 8px), 0); }
}
@media (prefers-reduced-motion: reduce) {
  .snowfall { display: none; }
  .snowfall i { animation: none; }
}
</style>
