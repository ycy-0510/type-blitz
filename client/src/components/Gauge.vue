<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    label: string
    value: number // needle position (the average)
    min?: number
    max?: number
    unit?: string
    color?: string
    decimals?: number
    valueSuffix?: string
    markers?: { value: number; color: string }[]
  }>(),
  { min: 0, max: 100, unit: '', color: '#66d9ef', decimals: 0, valueSuffix: '', markers: () => [] }
)

const R = 80

function frac(v: number): number {
  const f = (v - props.min) / (props.max - props.min)
  return Math.max(0, Math.min(1, f))
}

// Polar point on the semicircle: f=0 -> left, f=0.5 -> top, f=1 -> right.
function pt(f: number, r = R): [number, number] {
  const a = Math.PI - f * Math.PI
  return [100 + r * Math.cos(a), 100 - r * Math.sin(a)]
}

const needle = computed(() => {
  const [x, y] = pt(frac(props.value), R - 14)
  return { x, y }
})

const valuePath = computed(() => {
  const [x, y] = pt(frac(props.value))
  return `M 20 100 A ${R} ${R} 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}`
})

const ticks = computed(() =>
  Array.from({ length: 11 }, (_, i) => {
    const f = i / 10
    const major = i % 5 === 0
    const [x1, y1] = pt(f, R)
    const [x2, y2] = pt(f, R - (major ? 13 : 7))
    return { x1, y1, x2, y2, major }
  })
)

const markerPts = computed(() =>
  (props.markers ?? []).map((m) => {
    const [x, y] = pt(frac(m.value), R)
    const [ix, iy] = pt(frac(m.value), R - 14)
    return { x, y, ix, iy, color: m.color }
  })
)
</script>

<template>
  <div class="bg-[#1e1e1e] border border-gray-700 rounded-2xl p-5 flex flex-col">
    <div class="flex items-center justify-between mb-1">
      <span class="text-gray-400 tracking-widest text-xs font-bold">{{ label }}</span>
      <span class="text-gray-600 text-xs">{{ unit }}</span>
    </div>

    <svg viewBox="0 0 200 116" class="w-full">
      <!-- track -->
      <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#3a3a32" stroke-width="10" stroke-linecap="round" />
      <!-- filled value arc -->
      <path :d="valuePath" fill="none" :stroke="color" stroke-width="10" stroke-linecap="round" />
      <!-- ticks -->
      <line
        v-for="(t, i) in ticks"
        :key="i"
        :x1="t.x1" :y1="t.y1" :x2="t.x2" :y2="t.y2"
        :stroke="t.major ? '#6b6b60' : '#4a4a42'"
        :stroke-width="t.major ? 2 : 1"
      />
      <!-- markers (top 5% / best) -->
      <g v-for="(m, i) in markerPts" :key="'m' + i">
        <line :x1="m.x" :y1="m.y" :x2="m.ix" :y2="m.iy" :stroke="m.color" stroke-width="2.5" />
        <circle :cx="m.x" :cy="m.y" r="3" :fill="m.color" />
      </g>
      <!-- needle -->
      <line x1="100" y1="100" :x2="needle.x" :y2="needle.y" :stroke="color" stroke-width="3" stroke-linecap="round" />
      <circle cx="100" cy="100" r="6" :fill="color" />
      <circle cx="100" cy="100" r="2.5" fill="#1e1e1e" />
      <!-- center value -->
      <text x="100" y="86" text-anchor="middle" class="fill-white" style="font-size: 26px; font-weight: 800; font-family: 'Quantico', sans-serif">
        {{ value.toFixed(decimals) }}{{ valueSuffix }}
      </text>
    </svg>

    <slot />
  </div>
</template>
