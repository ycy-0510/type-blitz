<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ active: boolean }>()

const COLORS = ['#f92672', '#a6e22e', '#66d9ef', '#fd971f', '#ae81ff', '#e6db74']

// Confetti pieces — random horizontal position, color, size, fall delay/duration.
const confetti = computed(() =>
  Array.from({ length: 80 }, (_, i) => {
    const r = (n: number) => ((Math.sin(i * 99.7 + n) + 1) / 2)
    return {
      left: r(1) * 100,
      color: COLORS[i % COLORS.length],
      size: 6 + r(2) * 8,
      delay: r(3) * 0.6,
      duration: 2.2 + r(4) * 1.8,
      drift: (r(5) - 0.5) * 120,
      round: i % 3 === 0,
    }
  })
)

// Balloons floating up from the bottom.
const balloons = computed(() =>
  Array.from({ length: 12 }, (_, i) => {
    const r = (n: number) => ((Math.sin(i * 51.3 + n) + 1) / 2)
    return {
      left: 4 + r(1) * 92,
      color: COLORS[i % COLORS.length],
      size: 40 + r(2) * 30,
      delay: r(3) * 1.2,
      duration: 4 + r(4) * 2.5,
      sway: (r(5) - 0.5) * 40,
    }
  })
)
</script>

<template>
  <div v-if="active" class="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
    <!-- Confetti -->
    <span
      v-for="(c, i) in confetti"
      :key="'c' + i"
      class="confetti"
      :class="{ 'rounded-full': c.round }"
      :style="{
        left: c.left + '%',
        width: c.size + 'px',
        height: c.size + 'px',
        background: c.color,
        animationDelay: c.delay + 's',
        animationDuration: c.duration + 's',
        '--drift': c.drift + 'px',
      }"
    ></span>

    <!-- Balloons -->
    <div
      v-for="(b, i) in balloons"
      :key="'b' + i"
      class="balloon"
      :style="{
        left: b.left + '%',
        animationDelay: b.delay + 's',
        animationDuration: b.duration + 's',
        '--sway': b.sway + 'px',
      }"
    >
      <div
        class="balloon-body"
        :style="{ width: b.size + 'px', height: b.size * 1.2 + 'px', background: b.color }"
      ></div>
      <div class="balloon-string" :style="{ height: b.size * 0.9 + 'px' }"></div>
    </div>
  </div>
</template>

<style scoped>
.confetti {
  position: absolute;
  top: -20px;
  opacity: 0.9;
  animation-name: confetti-fall;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}
@keyframes confetti-fall {
  0% {
    transform: translate(0, -20px) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translate(var(--drift), 105vh) rotate(720deg);
    opacity: 0.9;
  }
}

.balloon {
  position: absolute;
  bottom: -160px;
  display: flex;
  flex-direction: column;
  align-items: center;
  animation-name: balloon-rise;
  animation-timing-function: ease-in;
  animation-iteration-count: infinite;
}
.balloon-body {
  border-radius: 50%;
  box-shadow: inset -6px -6px 0 rgba(0, 0, 0, 0.15);
  position: relative;
}
.balloon-body::after {
  content: '';
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-bottom: 7px solid inherit;
  border-bottom-color: rgba(255, 255, 255, 0.4);
}
.balloon-string {
  width: 1px;
  background: rgba(255, 255, 255, 0.4);
}
@keyframes balloon-rise {
  0% {
    transform: translate(0, 0);
    opacity: 1;
  }
  100% {
    transform: translate(var(--sway), -120vh);
    opacity: 1;
  }
}
</style>
