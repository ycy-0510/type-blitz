<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { store, socket } from '../store'
import Turnstile from './Turnstile.vue'
import MatchHistory from './MatchHistory.vue'

// `showClose` is set when this panel is shown as a slide-down overlay on top of
// the dashboard, so the user can dismiss it and return to their stats.
defineProps<{ showClose?: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const router = useRouter()
const nickname = ref(store.nickname)
const showModal = ref(false)
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

    <!-- Match history (floating button + modal) -->
    <MatchHistory />

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
