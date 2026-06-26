<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { store, socket } from '../store'

const props = defineProps<{
  wpm: number
  accuracy: number
}>()

const router = useRouter()
const showButtons = ref(false)

const performanceMessage = computed(() => {
  const pastHistory = store.history.slice(1) // exclude current match
  if (pastHistory.length === 0) return ''
  
  const pastMax = Math.max(...pastHistory.map(r => r.wpm))
  const pastAvg = Math.round(pastHistory.reduce((acc, r) => acc + r.wpm, 0) / pastHistory.length)
  
  if (props.wpm > pastMax) {
    return `🎉 New Personal Best! Beat your previous record of ${pastMax} WPM!`
  } else if (props.wpm > pastAvg) {
    return `📈 Great job! You scored above your average of ${pastAvg} WPM!`
  }
  return ''
})

const stopKeys = (e: KeyboardEvent) => {
  // Prevent all keys from triggering background buttons or anything else
  e.stopPropagation()
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault()
  }
}

onMounted(() => {
  window.addEventListener('keydown', stopKeys, { capture: true })
  setTimeout(() => {
    showButtons.value = true
  }, 500)
  
  store.saveRecord({
    mode: store.isSinglePlayer ? 'single' : 'multi',
    wpm: props.wpm,
    accuracy: props.accuracy,
    rank: ranking.value,
    totalPlayers: store.room ? Object.keys(store.room.players).length : 1
  })
})

onUnmounted(() => {
  window.removeEventListener('keydown', stopKeys, { capture: true })
})

const ranking = computed(() => {
  if (store.isSinglePlayer) return null
  if (!store.room) return null
  
  const players = Object.values(store.room.players)
  const sorted = [...players].sort((a, b) => b.progress - a.progress || b.wpm - a.wpm)
  
  const myIndex = sorted.findIndex(p => p.id === store.myId)
  return myIndex !== -1 ? myIndex + 1 : null
})

const handlePlayAgain = () => {
  if (store.isSinglePlayer) {
    store.reset()
    store.isSinglePlayer = true
    router.push('/play')
  } else {
    // Only host can trigger server play_again, but we navigate ourselves to the room anyway
    if (store.isHost) {
      socket.emit('play_again', store.roomId)
    }
    router.push(`/room/${store.roomId}`)
  }
}

const handleLeave = () => {
  if (!store.isSinglePlayer) {
    socket.emit('leave_room', store.roomId)
  }
  store.reset(true)
  router.push('/')
}
</script>

<template>
  <div class="w-full flex items-center justify-center py-4">
    <div class="bg-[#1e1e1e] p-8 rounded-xl border border-gray-700 w-full max-w-md shadow-2xl flex flex-col items-center animate-pop relative">
      <h2 class="text-3xl font-bold mb-6 text-[#a6e22e] tracking-widest">MATCH FINISHED</h2>
      
      <div class="w-full bg-black rounded p-6 mb-6 text-center border border-gray-800 relative">
        <div v-if="ranking" class="text-xl mb-4 text-[#f8f8f2]">Rank: <span class="text-[#f92672] font-bold text-2xl">#{{ ranking }}</span></div>
        <div class="flex justify-around">
          <div>
            <div class="text-gray-500 text-sm">WPM</div>
            <div class="text-4xl font-bold text-white">{{ wpm }}</div>
          </div>
          <div>
            <div class="text-gray-500 text-sm">ACCURACY</div>
            <div class="text-4xl font-bold text-white">{{ accuracy }}%</div>
          </div>
        </div>
        
        <div v-if="performanceMessage" class="mt-4 pt-4 border-t border-gray-800 text-[#a6e22e] text-sm font-bold">
          {{ performanceMessage }}
        </div>
      </div>

      <div class="w-full flex flex-col gap-3" v-if="showButtons">
        <button 
          @click="handlePlayAgain"
          class="w-full bg-[#f92672] text-white font-bold py-3 rounded hover:opacity-80 transition"
        >
          {{ store.isSinglePlayer ? 'PLAY AGAIN' : 'RETURN TO ROOM' }}
        </button>

        <button 
          @click="handleLeave"
          class="w-full border border-gray-600 text-gray-400 font-bold py-3 rounded hover:bg-gray-800 hover:text-white transition"
        >
          LEAVE
        </button>
      </div>
    </div>
  </div>
</template>
