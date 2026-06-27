<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { store, socket } from '../store'
import { quotes } from '../quotes'
import { playBeep, playFinish } from '../sound'
import TypingArea from '../components/TypingArea.vue'
import Report from './Report.vue'

const router = useRouter()

const COUNTDOWN_MS = 10000
const countdown = ref(0)
let countdownRaf = 0
const roomStatus = ref<'playing' | 'finished'>('playing')
const isGameActive = ref(false)
// Whether the player is actively focused on the game. Losing window focus
// "unfocuses" the game (and, in solo, pauses the clock); a click resumes.
const focused = ref(true)
let pausedAt = 0

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
const myProgress = ref(0) // 0-100, this player's car position

// Hard time limit: the time it would take to type the whole quote at 20 WPM.
// 20 WPM => (len/5)/20 minutes => len * 600 ms. If unfinished by then, force stop.
const timeLimitMs = computed(() => Math.round(quote.value.text.length * 600))
const deadlineAt = ref(0)
const timeLeftMs = ref(0)
const timeLeftLabel = computed(() => {
  const total = Math.max(Math.ceil(timeLeftMs.value / 1000), 0)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
})

// Car colours assigned by room join order (mod 4): red, blue, green, yellow.
const CAR_COLORS = ['#ef4444', '#3b82f6', '#a6e22e', '#facc15']
const playerColor = (id: string) => {
  if (!store.room) return CAR_COLORS[2]
  const idx = Object.keys(store.room.players).indexOf(id)
  return CAR_COLORS[(idx < 0 ? 0 : idx) % 4]
}

// Cars are full size in solo. In multiplayer they shrink as the room fills
// (more players -> smaller), capping at the solo size for small rooms.
const carScale = computed(() => {
  if (store.isSinglePlayer || !store.room) return 1
  const n = Object.keys(store.room.players).length
  return Math.max(0.5, Math.min(1, 1 - (n - 2) * 0.015))
})
const carWidth = computed(() => Math.round(80 * carScale.value))
const carHeight = computed(() => Math.round(40 * carScale.value))

// Cars on screen: in single-player it's just you; in multiplayer the top players.
const raceRows = computed(() => {
  if (store.isSinglePlayer) {
    return [{ id: 'me', nickname: store.nickname || 'You', progress: myProgress.value, wpm: wpm.value, isMe: true, color: '#a6e22e' }]
  }
  return topPlayers.value.map(p => ({
    id: p.id,
    nickname: p.nickname,
    progress: p.progress,
    wpm: p.wpm,
    isMe: p.id === store.myId,
    color: playerColor(p.id),
  }))
})

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
  myProgress.value = 0
  deadlineAt.value = 0
  timeLeftMs.value = 0
  startTime.value = null
  roomStatus.value = 'playing'
  // Solo: restart immediately (no countdown); clock starts on first keystroke.
  startGame()
}

const onRoomUpdate = (room: { status: string }) => {
  if (room.status === 'finished') {
    roomStatus.value = 'finished'
  }
}

// The host started a new match without us opting into PLAY AGAIN — we've been
// removed from the group, so go back to the lobby.
const onRemoved = () => {
  store.reset(true)
  router.push('/')
}

onMounted(() => {
  if (!store.isSinglePlayer && !store.room) {
    router.push('/')
    return
  }

  if (store.isSinglePlayer) {
    // No traffic light: typing is active right away; clock starts on first key.
    startGame()
  } else {
    // Multiplayer uses the server's shared countdown anchor.
    const startAt = store.matchStartAt ? store.matchStartAt : Date.now() + COUNTDOWN_MS
    startCountdown(startAt)
  }

  socket.on('room_update', onRoomUpdate)
  socket.on('removed_from_room', onRemoved)

  window.addEventListener('blur', onBlur)
  document.addEventListener('visibilitychange', onVisibility)
})

onUnmounted(() => {
  cancelAnimationFrame(countdownRaf)
  clearInterval(timerInterval.value)
  // Remove ONLY this component's listener — passing no handler would also wipe
  // the global store.room sync registered in store.ts.
  socket.off('room_update', onRoomUpdate)
  socket.off('removed_from_room', onRemoved)

  window.removeEventListener('blur', onBlur)
  document.removeEventListener('visibilitychange', onVisibility)
})

const startGame = () => {
  isGameActive.value = true
  // Multiplayer starts the clock at the shared GO. Solo has no traffic light —
  // the clock starts on the first keystroke instead (see handleProgress).
  if (!store.isSinglePlayer) startClock()
}

const startClock = () => {
  if (startTime.value) return
  startTime.value = Date.now()
  deadlineAt.value = Date.now() + timeLimitMs.value
  timeLeftMs.value = timeLimitMs.value
  timerInterval.value = setInterval(updateStats, 200)
}

const updateStats = () => {
  if (!deadlineAt.value) return
  timeLeftMs.value = Math.max(deadlineAt.value - Date.now(), 0)
  if (timeLeftMs.value <= 0) {
    // Ran out the 20-WPM clock without finishing — force stop, car stays put.
    endGame(true)
  }
}

// Losing window focus unfocuses the game. In solo we also pause the clock by
// freezing the timer; the multiplayer race can't pause, so its clock keeps
// running (only typing is blocked until the player clicks back).
const onBlur = () => {
  if (!isGameActive.value || !focused.value) return
  focused.value = false
  if (store.isSinglePlayer && startTime.value) {
    pausedAt = Date.now()
    clearInterval(timerInterval.value)
  }
}

const onVisibility = () => { if (document.hidden) onBlur() }

// Clicking the focus overlay resumes. In solo, shift the clock forward by the
// paused duration so elapsed time and the deadline are preserved.
const resumeFocus = () => {
  if (focused.value) return
  if (store.isSinglePlayer && pausedAt && startTime.value) {
    const delta = Date.now() - pausedAt
    startTime.value += delta
    deadlineAt.value += delta
    timerInterval.value = setInterval(updateStats, 200)
  }
  pausedAt = 0
  focused.value = true
}

const handleProgress = ({ correctCount }: { correctCount: number }) => {
  if (!isGameActive.value) return
  // Solo: begin timing on the first keystroke (no countdown).
  if (!startTime.value) startClock()

  totalKeystrokes.value++

  const elapsed = (Date.now() - (startTime.value ?? Date.now())) / 60000 // minutes
  const safeTime = Math.max(elapsed, 0.01)

  wpm.value = Math.round((correctCount / 5) / safeTime)
  accuracy.value = Math.round((correctCount / totalKeystrokes.value) * 100)

  const progressPercent = (correctCount / quote.value.text.length) * 100
  myProgress.value = Math.min(progressPercent, 100)

  if (!store.isSinglePlayer && socket.connected) {
    socket.emit('progress', { roomId: store.roomId, progress: progressPercent, wpm: wpm.value })
  }
}

const endGame = (forced: boolean) => {
  if (!isGameActive.value) return // already stopped (e.g. timeout + finish race)
  isGameActive.value = false
  clearInterval(timerInterval.value)
  if (!store.isSinglePlayer) {
    // 'finish' = completed the quote (car -> 100%); 'force_stop' = timed out,
    // server keeps the car at its last position.
    socket.emit(forced ? 'force_stop' : 'finish', {
      roomId: store.roomId,
      wpm: wpm.value,
      accuracy: accuracy.value,
    })
  }
  roomStatus.value = 'finished'
}

// Natural completion (TypingArea emitted 'finish') — the car crossed the line.
const handleFinish = () => {
  endGame(false)
  playFinish()
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
      <!-- Time remaining — only once the clock is running (solo: after first key) -->
      <div v-if="startTime" class="flex items-center gap-2">
        <span class="opacity-50 text-sm">TIME</span>
        <span class="font-mono font-bold text-2xl tabular-nums" :class="timeLeftMs <= 10000 ? 'text-[#f92672] animate-pulse' : 'text-white'">
          {{ timeLeftLabel }}
        </span>
      </div>
    </header>

    <!-- Progress Tracks (cars) — shown in both single-player and multiplayer -->
    <div class="w-full max-w-4xl px-8 flex flex-col gap-6 mb-8">
      <div v-for="(p, index) in raceRows" :key="p.id" class="flex items-center gap-4">
        <span class="text-xs w-20 font-bold tracking-wider text-right truncate" :style="{ color: p.color }">
          {{ index + 1 }}. {{ p.nickname }}
        </span>
        <div class="relative flex-1 h-10 border-b-2 border-gray-700">
          <div class="absolute bottom-0 transition-all duration-300" :style="{ left: Math.min(p.progress, 100) + '%', color: p.color }">
            <svg viewBox="0 0 20 10" :width="carWidth" :height="carHeight" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
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
          :isActive="isGameActive && focused"
          @progress="handleProgress"
          @finish="handleFinish"
        />

        <div class="text-right text-gray-500 italic text-sm mt-4">
          — {{ quote.source }}
        </div>

        <!-- Click-to-focus overlay: shown when the game lost focus. In solo the
             clock is paused; clicking anywhere here resumes. -->
        <div
          v-if="isGameActive && !focused"
          @click="resumeFocus"
          class="absolute inset-0 z-40 flex flex-col items-center justify-center gap-2 bg-[#272822]/85 backdrop-blur-sm cursor-pointer rounded-lg select-none"
        >
          <div class="text-[#a6e22e] text-3xl font-bold animate-pulse">⏸ Click to focus</div>
          <div class="text-gray-400 text-sm">
            {{ store.isSinglePlayer ? 'Timer paused — click and keep typing' : 'Click to resume typing' }}
          </div>
        </div>
      </template>
    </main>
  </div>
</template>
