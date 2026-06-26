<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { store, socket } from '../store'
import { quotes } from '../quotes'
import { playBeep } from '../sound'
import TypingArea from '../components/TypingArea.vue'
import Report from './Report.vue'

const router = useRouter()

const COUNTDOWN_MS = 10000
const countdown = ref(0)
let countdownRaf = 0
const roomStatus = ref<'playing' | 'finished'>('playing')
const isGameActive = ref(false)

const startTime = ref<number | null>(null)
const timerInterval = ref<any>(null)

// Single-player quote index — a stable ref so the quote doesn't change on
// unrelated re-renders, and can be deliberately re-rolled on "play again".
const singleQuoteIndex = ref(Math.floor(Math.random() * quotes.length))
const quote = computed(() => {
  if (store.room) return quotes[store.room.quoteIndex]
  if (store.isSinglePlayer) return quotes[singleQuoteIndex.value]
  return quotes[0]
})

const wpm = ref(0)
const accuracy = ref(100)
const totalKeystrokes = ref(0)

const topPlayers = computed(() => {
  if (store.isSinglePlayer) return []
  if (!store.room) return []
  
  const players = Object.values(store.room.players)
  const sorted = [...players].sort((a, b) => b.progress - a.progress || b.wpm - a.wpm)
  
  // Get top 3
  const top3 = sorted.slice(0, 3)
  // Ensure myself is included if not in top 3
  if (!top3.find(p => p.id === store.myId)) {
    const me = players.find(p => p.id === store.myId)
    if (me) top3.push(me)
  }
  return top3
})

// Countdown driven by requestAnimationFrame against a fixed end time (startAt).
// Anchoring to a timestamp keeps the displayed seconds accurate (no setInterval
// drift) and — using the server-provided startAt in multiplayer — makes every
// client hit GO at the same moment. rAF also avoids background-tab 1s throttling.
const startCountdown = (startAt: number) => {
  cancelAnimationFrame(countdownRaf)
  let lastWhole = Math.max(Math.ceil((startAt - Date.now()) / 1000), 0)
  countdown.value = lastWhole

  const tick = () => {
    const remaining = startAt - Date.now()
    const whole = Math.max(Math.ceil(remaining / 1000), 0)
    if (whole !== lastWhole) {
      lastWhole = whole
      countdown.value = whole
      // Racing-style countdown: ticks on the last 3 seconds, a longer tone on GO
      if (whole > 0 && whole <= 3) playBeep('tick')
      else if (whole === 0) playBeep('go')
    }
    if (remaining <= 0) {
      startGame()
      return
    }
    countdownRaf = requestAnimationFrame(tick)
  }
  countdownRaf = requestAnimationFrame(tick)
}

// Single-player "play again": reset state in place with a fresh quote.
const restartSingle = () => {
  clearInterval(timerInterval.value)
  cancelAnimationFrame(countdownRaf)
  singleQuoteIndex.value = Math.floor(Math.random() * quotes.length)
  wpm.value = 0
  accuracy.value = 100
  totalKeystrokes.value = 0
  startTime.value = null
  isGameActive.value = false
  roomStatus.value = 'playing'
  startCountdown(Date.now() + COUNTDOWN_MS)
}

onMounted(() => {
  if (!store.isSinglePlayer && !store.room) {
    router.push('/')
    return
  }

  // Multiplayer uses the server's shared anchor; single-player counts locally.
  const startAt = store.room && store.matchStartAt ? store.matchStartAt : Date.now() + COUNTDOWN_MS
  startCountdown(startAt)

  socket.on('room_update', (room) => {
    if (room.status === 'finished') {
      roomStatus.value = 'finished'
    }
  })
})

onUnmounted(() => {
  cancelAnimationFrame(countdownRaf)
  clearInterval(timerInterval.value)
  socket.off('room_update')
})

const startGame = () => {
  isGameActive.value = true
  startTime.value = Date.now()
  timerInterval.value = setInterval(updateStats, 200)
}

const updateStats = () => {
  // Stats update logic handled via TypingArea events mostly,
  // but time affects WPM so we recalc here if needed
}

const handleProgress = ({ correctCount }: { correctCount: number }) => {
  if (!startTime.value) return
  
  totalKeystrokes.value++
  
  const elapsed = (Date.now() - startTime.value) / 60000 // minutes
  const safeTime = Math.max(elapsed, 0.01)
  
  wpm.value = Math.round((correctCount / 5) / safeTime)
  accuracy.value = Math.round((correctCount / totalKeystrokes.value) * 100)
  
  const progressPercent = (correctCount / quote.value.text.length) * 100
  
  if (!store.isSinglePlayer && socket.connected) {
    socket.emit('progress', { roomId: store.roomId, progress: progressPercent, wpm: wpm.value })
  }
}

const handleFinish = () => {
  isGameActive.value = false
  clearInterval(timerInterval.value)
  if (store.isSinglePlayer) {
    roomStatus.value = 'finished'
  } else {
    socket.emit('finish', { roomId: store.roomId, wpm: wpm.value, accuracy: accuracy.value })
    // Wait for room to finish or just show our report
    roomStatus.value = 'finished'
  }
}
</script>

<template>
  <div class="h-full w-full flex flex-col items-center py-8 relative">
    
    <!-- Countdown Traffic Light -->
    <div v-if="countdown > 0" class="absolute top-24 left-1/2 transform -translate-x-1/2 z-40 flex flex-col items-center gap-4 bg-[#1e1e1e] border-2 border-gray-700 p-6 rounded-2xl shadow-2xl">
      <div class="flex gap-4 mb-2 bg-black p-4 rounded-xl border border-gray-800">
        <div class="w-12 h-12 rounded-full transition-all duration-300" :class="countdown > 3 ? 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.8)]' : 'bg-gray-800'"></div>
        <div class="w-12 h-12 rounded-full transition-all duration-300" :class="(countdown <= 3 && countdown > 0) ? 'bg-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.8)]' : 'bg-gray-800'"></div>
        <div class="w-12 h-12 rounded-full transition-all duration-300 bg-gray-800"></div>
      </div>
      <div class="text-4xl font-mono text-white font-bold tracking-widest">{{ countdown }}</div>
    </div>

    <!-- Header Stats -->
    <header class="w-full max-w-5xl flex justify-between items-center px-8 text-gray-400 text-lg mb-8">
      <div class="flex gap-6">
        <div><span class="opacity-50">WPM:</span> <span class="font-bold text-white">{{ wpm }}</span></div>
        <div><span class="opacity-50">ACC:</span> <span class="font-bold text-white">{{ accuracy }}%</span></div>
      </div>
    </header>

    <!-- Multiplayer Progress Tracks -->
    <div v-if="!store.isSinglePlayer" class="w-full max-w-4xl px-8 flex flex-col gap-4 mb-8">
      <div v-for="(p, index) in topPlayers" :key="p.id" class="flex items-center gap-4">
        <span class="text-xs w-20 font-bold tracking-wider text-right truncate" :class="p.id === store.myId ? 'text-[#a6e22e]' : 'text-gray-400'">
          {{ index + 1 }}. {{ p.nickname }}
        </span>
        <div class="relative flex-1 h-8 border-b-2 border-gray-700">
          <div class="absolute top-0 transition-all duration-300 transform -translate-y-1" :style="{ left: Math.min(p.progress, 100) + '%' }" :class="p.id === store.myId ? 'text-[#a6e22e]' : 'text-gray-400'">
            <svg viewBox="0 0 20 10" width="40" height="20" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
              <path d="M 4 2 H 12 V 4 H 16 V 5 H 18 V 8 H 2 V 5 H 4 Z" fill="currentColor" />
              <path d="M 5 3 H 8 V 4 H 5 Z" fill="#fff" opacity="0.8" />
              <path d="M 9 3 H 11 V 4 H 9 Z" fill="#fff" opacity="0.8" />
            </svg>
          </div>
        </div>
        <span class="text-xs text-gray-400 w-10 text-right font-mono">{{ p.wpm }}</span>
      </div>
    </div>

    <!-- Typing Area (replaced in-place by the result once finished) -->
    <main class="w-full max-w-4xl px-8 focus:outline-none relative">
      <!-- Inline result, shown where the text used to be (keeps the race progress above visible) -->
      <Report
        v-if="roomStatus === 'finished'"
        :wpm="wpm"
        :accuracy="accuracy"
        @again="restartSingle"
      />

      <template v-else-if="quote">
        <TypingArea
          :quote="quote.text"
          :isActive="isGameActive"
          @progress="handleProgress"
          @finish="handleFinish"
        />

        <div class="text-right text-gray-500 italic text-sm mt-4">
          — {{ quote.source }}
        </div>
      </template>
    </main>
  </div>
</template>
