<script setup lang="ts">
import { computed } from 'vue'
import { store } from '../store'
import { metricStats, dayStreak, wpmGrowth } from '../stats'
import Gauge from '../components/Gauge.vue'

defineEmits<{ (e: 'start'): void }>()

const wpm = computed(() => metricStats(store.history.map((r) => r.wpm)))
const acc = computed(() => metricStats(store.history.map((r) => r.accuracy)))
const streak = computed(() => dayStreak(store.history))
const growth = computed(() => wpmGrowth(store.history))

// Round the gauge ceiling up to a tidy number a little above the best run.
const wpmMax = computed(() => Math.max(120, Math.ceil((wpm.value.top + 10) / 20) * 20))

const r1 = (n: number) => Math.round(n * 10) / 10

function trend(pct: number | null) {
  if (pct === null) return { text: '—', color: 'text-gray-600', bar: '#4a4a42', label: 'No data', w: 0 }
  const stable = Math.abs(pct) < 2
  const color = stable ? 'text-gray-300' : pct > 0 ? 'text-[#a6e22e]' : 'text-[#f92672]'
  const bar = stable ? '#9ca3af' : pct > 0 ? '#a6e22e' : '#f92672'
  const label = stable ? 'Stable' : pct > 0 ? 'Grow' : 'Drop'
  const w = Math.min(100, Math.abs(pct)) // bar width capped at 100%
  const sign = pct > 0 ? '+' : ''
  return { text: `${sign}${pct.toFixed(1)}%`, color, bar, label, w }
}
</script>

<template>
  <div class="h-full w-full overflow-y-auto">
    <div class="min-h-full max-w-6xl mx-auto px-4 md:px-8 py-6 flex flex-col gap-6">
      <!-- Header -->
      <header class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-3 select-none">
          <img src="/favicon.svg" alt="TypeBlitz logo" class="w-10 h-10 md:w-12 md:h-12 drop-shadow-[0_0_14px_rgba(166,226,46,0.3)]" />
          <h1 class="text-2xl md:text-3xl font-black tracking-tight" style="font-family: 'Quantico', sans-serif">
            <span class="text-[#a6e22e]">Type</span><span class="text-[#f92672]">Blitz</span>
          </h1>
        </div>
        <button
          @click="$emit('start')"
          class="group flex items-center gap-2 bg-[#a6e22e] text-black font-black tracking-widest px-6 md:px-8 py-3 rounded-xl shadow-[0_0_24px_rgba(166,226,46,0.35)] hover:shadow-[0_0_36px_rgba(166,226,46,0.6)] hover:-translate-y-0.5 active:translate-y-0 transition-all"
        >
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          <span>START</span>
        </button>
      </header>

      <p class="text-gray-500 text-sm -mt-2">
        {{ wpm.count }} race{{ wpm.count === 1 ? '' : 's' }} recorded. Hit START to race again.
      </p>

      <!-- Gauges -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Gauge
          label="WPM"
          unit="words / min"
          :value="wpm.avg"
          :min="0"
          :max="wpmMax"
          color="#66d9ef"
          :markers="[
            { value: wpm.top5, color: '#facc15' },
            { value: wpm.top, color: '#f92672' },
          ]"
        >
          <div class="grid grid-cols-3 gap-2 mt-2 text-center">
            <div><div class="text-[#66d9ef] text-xl font-bold">{{ r1(wpm.avg) }}</div><div class="text-gray-500 text-[10px] tracking-widest">AVG</div></div>
            <div><div class="text-[#facc15] text-xl font-bold">{{ r1(wpm.top5) }}</div><div class="text-gray-500 text-[10px] tracking-widest">TOP 5%</div></div>
            <div><div class="text-[#f92672] text-xl font-bold">{{ r1(wpm.top) }}</div><div class="text-gray-500 text-[10px] tracking-widest">BEST</div></div>
          </div>
        </Gauge>

        <Gauge
          label="ACCURACY"
          unit="percent"
          :value="acc.avg"
          :min="50"
          :max="100"
          value-suffix="%"
          color="#a6e22e"
          :markers="[
            { value: acc.top5, color: '#facc15' },
            { value: acc.top, color: '#66d9ef' },
          ]"
        >
          <div class="grid grid-cols-3 gap-2 mt-2 text-center">
            <div><div class="text-[#a6e22e] text-xl font-bold">{{ r1(acc.avg) }}%</div><div class="text-gray-500 text-[10px] tracking-widest">AVG</div></div>
            <div><div class="text-[#facc15] text-xl font-bold">{{ r1(acc.top5) }}%</div><div class="text-gray-500 text-[10px] tracking-widest">TOP 5%</div></div>
            <div><div class="text-[#66d9ef] text-xl font-bold">{{ r1(acc.top) }}%</div><div class="text-gray-500 text-[10px] tracking-widest">BEST</div></div>
          </div>
        </Gauge>
      </div>

      <!-- Streak + Growth -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- Streak -->
        <div class="bg-[#1e1e1e] border border-gray-700 rounded-2xl p-5 flex flex-col items-center justify-center text-center">
          <span class="text-gray-400 tracking-widest text-xs font-bold self-start mb-2">STREAK</span>
          <div class="flex items-center gap-2">
            <svg class="w-9 h-9 text-[#f92672]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2c1 3-1 5-2 6-1.5 1.5-2 3-2 4a6 6 0 0012 0c0-2-1-4-2-5 0 1-1 2-2 2 .5-2 .5-4-2-7z" /></svg>
            <span class="text-5xl font-black text-white" style="font-family: 'Quantico', sans-serif">{{ streak.current }}</span>
          </div>
          <div class="text-gray-400 mt-1">day{{ streak.current === 1 ? '' : 's' }} in a row</div>
          <div class="text-gray-600 text-xs mt-2">{{ streak.activeDays }} active day{{ streak.activeDays === 1 ? '' : 's' }} total</div>
        </div>

        <!-- Stable & Grow -->
        <div class="bg-[#1e1e1e] border border-gray-700 rounded-2xl p-5 md:col-span-2">
          <div class="flex items-center justify-between mb-4">
            <span class="text-gray-400 tracking-widest text-xs font-bold">STABLE &amp; GROW</span>
            <span class="text-gray-600 text-xs">WPM trend vs previous period</span>
          </div>
          <div class="flex flex-col gap-3">
            <div v-for="g in growth" :key="g.days" class="flex items-center gap-3">
              <span class="w-12 text-gray-400 text-sm font-bold shrink-0">{{ g.days }}d</span>
              <div class="flex-1 h-2.5 rounded-full bg-[#3a3a32] overflow-hidden">
                <div class="h-full rounded-full transition-all" :style="{ width: trend(g.pct).w + '%', background: trend(g.pct).bar }"></div>
              </div>
              <span class="w-20 text-right text-sm font-bold tabular-nums" :class="trend(g.pct).color">{{ trend(g.pct).text }}</span>
              <span class="w-14 text-right text-xs text-gray-500 hidden sm:inline">{{ trend(g.pct).label }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
