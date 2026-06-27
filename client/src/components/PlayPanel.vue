<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { store, socket } from '../store'
import Turnstile from './Turnstile.vue'

// `showClose` is set when this panel is shown as a slide-down overlay on top of
// the dashboard, so the user can dismiss it and return to their stats.
defineProps<{ showClose?: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const router = useRouter()
const nickname = ref(store.nickname)
const showModal = ref(false)
const showRecords = ref(false)
const modalAction = ref<'create' | ''>('')

// Cloudflare Turnstile token (empty string = verification disabled/passed)
const turnstileToken = ref<string | null>(null)
const onVerified = (token: string) => { turnstileToken.value = token }
const onExpired = () => { turnstileToken.value = null }

const creating = ref(false)
const createError = ref('')

const handleSinglePlayer = () => {
  store.reset()
  store.isSinglePlayer = true
  router.push('/play')
}

const promptCreate = () => {
  modalAction.value = 'create'
  turnstileToken.value = null
  creating.value = false
  createError.value = ''
  showModal.value = true
}

const submitNickname = async () => {
  if (!nickname.value.trim()) return
  if (turnstileToken.value === null) return // wait for human verification
  if (creating.value) return // already in flight — avoid double submits

  creating.value = true
  createError.value = ''
  store.reset()
  store.saveNickname(nickname.value.trim())

  // Make sure we're actually connected before emitting, otherwise the
  // create_room packet can be sent on a half-open socket and silently lost
  // (you'd land in a room with nobody in it).
  try {
    await store.connectAndWait()
  } catch {
    creating.value = false
    createError.value = 'Connection failed. Please try again.'
    return
  }

  const onCreated = (id: string) => {
    cleanup()
    store.roomId = id
    store.isHost = true
    creating.value = false
    router.push(`/room/${id}`)
  }
  const onError = (msg: string) => {
    cleanup()
    creating.value = false
    createError.value = msg || 'Failed to create room.'
    // The Turnstile token is single-use; force a re-verify before retrying.
    turnstileToken.value = null
  }
  const cleanup = () => {
    socket.off('room_created', onCreated)
    socket.off('room_error', onError)
  }
  socket.on('room_created', onCreated)
  socket.on('room_error', onError)

  socket.emit('create_room', { nickname: store.nickname, token: turnstileToken.value })
}

const closeModal = () => {
  showModal.value = false
}
</script>

<template>
  <div class="h-full w-full overflow-y-auto relative bg-[#272822]">
    <!-- Slide-down handle: dismiss the play panel and return to the dashboard. -->
    <button
      v-if="showClose"
      @click="emit('close')"
      title="Back to dashboard"
      class="fixed top-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center text-gray-500 hover:text-white transition-colors"
    >
      <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" /></svg>
      <span class="text-[10px] tracking-widest">DASHBOARD</span>
    </button>

    <!-- min-h-full centers the content when it fits, but lets it grow and
         scroll on short screens (e.g. mobile) instead of being clipped. -->
    <div class="min-h-full flex flex-col items-center justify-center gap-10 p-4">
      <!-- Brand -->
      <div class="flex items-center gap-4 select-none">
        <img src="/favicon.svg" alt="TypeBlitz logo" class="w-14 h-14 md:w-16 md:h-16 drop-shadow-[0_0_14px_rgba(166,226,46,0.3)]" />
        <h1 class="text-4xl md:text-5xl font-black tracking-tight" style="font-family: 'Quantico', sans-serif">
          <span class="text-[#a6e22e]">Type</span><span class="text-[#f92672]">Blitz</span>
        </h1>
      </div>

      <div class="flex flex-col md:flex-row gap-8 w-full max-w-5xl">
        <!-- Single Player Card -->
        <div
          @click="handleSinglePlayer"
          class="flex-1 flex flex-col items-center justify-center cursor-pointer transition-transform duration-300 hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(166,226,46,0.2)] bg-[#1e1e1e] border border-gray-700 rounded-2xl p-12 min-h-[400px]"
        >
          <svg class="w-24 h-24 mb-6 text-[#a6e22e]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
          </svg>
          <h2 class="text-3xl font-bold tracking-widest text-[#a6e22e]">SINGLE PLAYER</h2>
          <p class="mt-4 text-gray-400 text-center">Practice your typing speed solo.</p>
        </div>

        <!-- Multiplayer Card -->
        <div
          @click="promptCreate"
          class="flex-1 flex flex-col items-center justify-center cursor-pointer transition-transform duration-300 hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(249,38,114,0.2)] bg-[#1e1e1e] border border-gray-700 rounded-2xl p-12 min-h-[400px]"
        >
          <svg class="w-24 h-24 mb-6 text-[#f92672]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
          </svg>
          <h2 class="text-3xl font-bold tracking-widest text-[#f92672]">MULTIPLAYER</h2>
          <p class="mt-4 text-gray-400 text-center">Create a group (2-40 players) and race with friends.</p>
        </div>
      </div>
    </div>

    <!-- Text attribution (Wikipedia, CC BY-SA 4.0) -->
    <a
      href="/quotes-credits.html"
      target="_blank"
      rel="noopener"
      class="fixed bottom-3 left-4 text-gray-600 hover:text-gray-300 text-xs z-10"
    >
      Texts: Wikipedia · CC BY-SA 4.0
    </a>

    <!-- Records Button -->
    <button
      @click="showRecords = true"
      title="Match History"
      class="fixed bottom-8 right-8 bg-[#66d9ef] text-black font-bold p-4 rounded-full shadow-[0_0_20px_rgba(102,217,239,0.3)] hover:scale-110 hover:shadow-[0_0_30px_rgba(102,217,239,0.6)] transition-all z-10"
    >
      <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
    </button>

    <!-- Records Modal -->
    <div v-if="showRecords" class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div class="bg-[#1e1e1e] p-8 rounded-xl border border-gray-700 w-full max-w-3xl h-[80vh] flex flex-col shadow-2xl relative" @click.stop>
        <button @click="showRecords = false" class="absolute top-4 right-4 text-gray-500 hover:text-white text-2xl">&times;</button>
        <h3 class="text-2xl font-bold mb-6 text-[#66d9ef] tracking-widest border-b border-gray-700 pb-4">MATCH HISTORY</h3>

        <div class="flex-1 overflow-y-auto pr-2">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="text-gray-500 border-b border-gray-800 text-sm">
                <th class="py-3 px-4 font-normal">DATE</th>
                <th class="py-3 px-4 font-normal">MODE</th>
                <th class="py-3 px-4 text-right font-normal">WPM</th>
                <th class="py-3 px-4 text-right font-normal">ACCURACY</th>
                <th class="py-3 px-4 text-center font-normal">RANK</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="record in store.history" :key="record.id" class="border-b border-gray-800 hover:bg-white/5 transition">
                <td class="py-3 px-4 text-gray-400 text-sm">{{ new Date(record.date).toLocaleString() }}</td>
                <td class="py-3 px-4">
                  <span class="text-xs font-bold px-2 py-1 rounded" :class="record.mode === 'single' ? 'bg-[#a6e22e]/20 text-[#a6e22e]' : 'bg-[#f92672]/20 text-[#f92672]'">
                    {{ record.mode.toUpperCase() }}
                  </span>
                </td>
                <td class="py-3 px-4 text-right font-bold text-white text-lg">{{ record.wpm }}</td>
                <td class="py-3 px-4 text-right text-gray-300">{{ record.accuracy }}%</td>
                <td class="py-3 px-4 text-center">
                  <span v-if="record.mode === 'multi' && record.rank" class="text-gray-300">
                    <span class="text-white font-bold">#{{ record.rank }}</span> <span class="text-sm opacity-50">/ {{ record.totalPlayers }}</span>
                  </span>
                  <span v-else class="text-gray-600">-</span>
                </td>
              </tr>
              <tr v-if="store.history.length === 0">
                <td colspan="5" class="py-12 text-center text-gray-500">No match records yet. Play a game to see your history!</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Nickname Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div class="bg-[#1e1e1e] p-8 rounded-xl border border-gray-700 w-full max-w-md shadow-2xl relative" @click.stop>
        <button @click="closeModal" class="absolute top-4 right-4 text-gray-500 hover:text-white text-2xl">&times;</button>
        <h3 class="text-2xl font-bold mb-6 text-center text-[#f8f8f2]">ENTER NICKNAME</h3>
        <input
          v-model="nickname"
          @keyup.enter="submitNickname"
          type="text"
          class="w-full bg-black text-white px-4 py-3 rounded border border-gray-600 text-center focus:outline-none focus:border-[#a6e22e] text-xl"
          placeholder="Your name..."
          maxlength="12"
          autofocus
        >
        <Turnstile @verified="onVerified" @expired="onExpired" />
        <p v-if="createError" class="mt-3 text-center text-[#f92672] text-sm">{{ createError }}</p>
        <button
          @click="submitNickname"
          :disabled="!nickname.trim() || turnstileToken === null || creating"
          class="w-full mt-6 bg-[#f92672] text-white font-bold py-3 rounded hover:opacity-80 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ creating ? 'CREATING…' : (turnstileToken === null ? 'VERIFYING…' : 'CREATE GROUP') }}
        </button>
      </div>
    </div>
  </div>
</template>
