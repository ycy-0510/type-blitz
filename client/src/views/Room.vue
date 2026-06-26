<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { store, socket } from '../store'
import Turnstile from '../components/Turnstile.vue'

const route = useRoute()
const router = useRouter()
const roomId = route.params.id as string

const nickname = ref(store.nickname)
const requireNickname = ref(false)

// Cloudflare Turnstile token (empty string = verification disabled/passed)
const turnstileToken = ref<string | null>(null)
const onVerified = (token: string) => { turnstileToken.value = token }
const onExpired = () => { turnstileToken.value = null }
const inviteLink = ref(`${window.location.origin}/room/${roomId}`)
const copied = ref(false)

onMounted(() => {
  if (store.roomId === roomId && store.nickname) {
    // Already in room (created by this host)
    requireNickname.value = false
  } else {
    // Navigated via link
    requireNickname.value = true
  }

  socket.on('match_starting', () => {
    router.push('/play')
  })
})

onUnmounted(() => {
  socket.off('match_starting')
})

const joinRoom = () => {
  if (!nickname.value.trim()) return
  if (turnstileToken.value === null) return // wait for human verification
  store.reset()
  store.saveNickname(nickname.value.trim())
  store.roomId = roomId
  store.connect()

  socket.emit('join_room', { roomId, nickname: store.nickname, token: turnstileToken.value })

  socket.once('room_joined', () => {
    requireNickname.value = false
  })
}

const copyLink = async () => {
  try {
    await navigator.clipboard.writeText(inviteLink.value)
    copied.value = true
    setTimeout(() => copied.value = false, 2000)
  } catch (err) {
    console.error('Failed to copy', err)
  }
}

const startMatch = () => {
  if (canStart.value) {
    socket.emit('host_start', roomId)
  }
}

const playersList = computed(() => {
  if (!store.room) return []
  return Object.values(store.room.players)
})

const canStart = computed(() => {
  return store.isHost && playersList.value.length >= 2
})

const leaveRoom = () => {
  if (socket.connected) {
    socket.emit('leave_room', roomId)
  }
  store.reset(true)
  router.push('/')
}
</script>

<template>
  <div class="h-full w-full flex items-center justify-center relative p-4">
    
    <!-- Nickname Input for joining via link -->
    <div v-if="requireNickname" class="bg-[#1e1e1e] p-8 rounded-xl border border-gray-700 w-full max-w-md shadow-2xl">
      <h3 class="text-2xl font-bold mb-6 text-center text-[#f8f8f2]">JOIN GROUP</h3>
      <input 
        v-model="nickname" 
        @keyup.enter="joinRoom"
        type="text" 
        class="w-full bg-black text-white px-4 py-3 rounded border border-gray-600 text-center focus:outline-none focus:border-[#a6e22e] text-xl" 
        placeholder="Enter nickname..." 
        maxlength="12"
        autofocus
      >
      <Turnstile @verified="onVerified" @expired="onExpired" />
      <button
        @click="joinRoom"
        :disabled="!nickname.trim() || turnstileToken === null"
        class="w-full mt-6 bg-[#a6e22e] text-black font-bold py-3 rounded hover:opacity-80 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        JOIN
      </button>
      <button @click="router.push('/')" class="w-full mt-2 text-gray-500 hover:text-white py-2 text-sm">Cancel</button>
    </div>

    <!-- Room View -->
    <div v-else class="w-full max-w-4xl h-[80vh] bg-[#1e1e1e] rounded-xl border border-gray-700 p-6 flex flex-col shadow-2xl">
      <div class="flex justify-between items-center border-b border-gray-700 pb-4 mb-4">
        <div>
          <h2 class="text-2xl font-bold text-white tracking-wider">ROOM <span class="text-[#f92672]">{{ roomId }}</span></h2>
          <p class="text-gray-400 text-sm mt-1">Players: {{ playersList.length }} / 40</p>
        </div>
        <button @click="leaveRoom" class="border border-gray-600 text-gray-400 px-4 py-2 rounded hover:bg-gray-800 hover:text-white transition">Leave</button>
      </div>

      <div class="flex-1 overflow-y-auto mb-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 auto-rows-max content-start">
        <div v-for="p in playersList" :key="p.id" class="bg-black p-4 rounded border border-gray-800 flex justify-between items-center">
          <span class="font-bold text-lg" :class="p.id === store.myId ? 'text-[#a6e22e]' : 'text-gray-300'">
            {{ p.nickname }}
            <span v-if="p.id === store.myId" class="text-xs ml-1">(You)</span>
          </span>
          <span v-if="p.isHost" class="text-xs bg-[#f92672] text-white px-2 py-1 rounded">HOST</span>
        </div>
      </div>

      <div class="pt-4 border-t border-gray-700 flex flex-col md:flex-row gap-4 items-center">
        <!-- Host Controls -->
        <template v-if="store.isHost">
          <button @click="copyLink" class="flex-1 bg-gray-800 text-white font-bold py-3 px-4 rounded hover:bg-gray-700 transition flex items-center justify-center gap-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
            {{ copied ? 'COPIED!' : 'COPY INVITATION LINK' }}
          </button>
          <button 
            @click="startMatch" 
            :disabled="!canStart"
            class="flex-1 font-bold py-3 px-4 rounded transition text-lg"
            :class="canStart ? 'bg-[#f92672] text-white hover:opacity-80' : 'bg-gray-700 text-gray-500 cursor-not-allowed'"
          >
            START MATCH
          </button>
        </template>
        <!-- Guest Message -->
        <template v-else>
          <div class="flex-1 text-center text-[#a6e22e] text-lg font-bold animate-pulse">
            Waiting for Host to start...
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
