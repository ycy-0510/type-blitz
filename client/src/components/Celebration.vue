<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ active: boolean }>()

const COLORS = ['#f92672', '#a6e22e', '#66d9ef', '#fd971f', '#ae81ff', '#e6db74']
const EASES = [
  'cubic-bezier(0.3, 0.1, 0.7, 1)',
  'cubic-bezier(0.5, 0, 0.5, 1)',
  'cubic-bezier(0.2, 0.6, 0.4, 1)',
  'linear',
]
const rand = (min: number, max: number) => min + Math.random() * (max - min)

// Confetti pieces — fully randomized so the fall looks scattered, not uniform:
// independent size/aspect, spin amount & direction, a mid-air sideways drift,
// per-piece easing, and a spread of negative delays so the sky is already full.
const confetti = computed(() =>
  Array.from({ length: 90 }, () => {
    const duration = rand(2.4, 5)
    const w = rand(5, 12)
    return {
      left: rand(-5, 100),
      color: COLORS[Math.floor(rand(0, COLORS.length))],
      width: w,
      height: w * rand(0.4, 1.4),        // strips and squares
      duration,
      delay: -rand(0, duration),          // negative => mid-fall at t=0, no wave
      drift: rand(-160, 160),             // final horizontal offset
      midx: rand(-90, 90),                // sideways wobble halfway down
      rot: rand(360, 1440) * (Math.random() < 0.5 ? -1 : 1),
      ease: EASES[Math.floor(rand(0, EASES.length))],
      opacity: rand(0.7, 1),
      round: Math.random() < 0.25,
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
        width: c.width + 'px',
        height: c.height + 'px',
        background: c.color,
        opacity: c.opacity,
        animationDelay: c.delay + 's',
        animationDuration: c.duration + 's',
        animationTimingFunction: c.ease,
        '--drift': c.drift + 'px',
        '--midx': c.midx + 'px',
        '--rot': c.rot + 'deg',
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
  animation-name: confetti-fall;
  animation-iteration-count: infinite;
}
@keyframes confetti-fall {
  0% {
    transform: translate(0, -20px) rotate(0deg);
  }
  50% {
    transform: translate(var(--midx), 50vh) rotate(calc(var(--rot) * 0.5));
  }
  100% {
    transform: translate(var(--drift), 105vh) rotate(var(--rot));
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
