<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { store, socket } from '../store'
import Turnstile from '../components/Turnstile.vue'

const router = useRouter()
const nickname = ref(store.nickname)
const showModal = ref(false)
const showRecords = ref(false)
const modalAction = ref<'create'|''>('')

// Cloudflare Turnstile token (empty string = verification disabled/passed)
const turnstileToken = ref<string | null>(null)
const onVerified = (token: string) => { turnstileToken.value = token }
const onExpired = () => { turnstileToken.value = null }

const handleSinglePlayer = () => {
  store.reset()
  store.isSinglePlayer = true
  router.push('/play')
}

const promptCreate = () => {
  modalAction.value = 'create'
  turnstileToken.value = null
  showModal.value = true
}

const submitNickname = () => {
  if (!nickname.value.trim()) return
  if (turnstileToken.value === null) return // wait for human verification

  store.reset()
  store.saveNickname(nickname.value.trim())
  store.connect()

  socket.emit('create_room', { nickname: store.nickname, token: turnstileToken.value })

  socket.once('room_created', (id: string) => {
    store.roomId = id
    store.isHost = true
    router.push(`/room/${id}`)
  })
}

const closeModal = () => {
  showModal.value = false
}
</script>

<template>
  <div class="h-full w-full flex items-center justify-center p-4 relative">
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

    <!-- Records Button -->
    <button 
      @click="showRecords = true"
      title="Match History"
      class="absolute bottom-8 right-8 bg-[#66d9ef] text-black font-bold p-4 rounded-full shadow-[0_0_20px_rgba(102,217,239,0.3)] hover:scale-110 hover:shadow-[0_0_30px_rgba(102,217,239,0.6)] transition-all z-10"
    >
      <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
    </button>

    <!-- Records Modal -->
    <div v-if="showRecords" class="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
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
    <div v-if="showModal" class="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
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
        <button
          @click="submitNickname"
          :disabled="!nickname.trim() || turnstileToken === null"
          class="w-full mt-6 bg-[#f92672] text-white font-bold py-3 rounded hover:opacity-80 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          CREATE GROUP
        </button>
      </div>
    </div>
  </div>
</template>
