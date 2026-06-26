import { reactive } from 'vue'
import { io } from 'socket.io-client'

interface Player {
  id: string
  nickname: string
  progress: number
  wpm: number
  isReady: boolean
  isHost: boolean
  finished: boolean
  accuracy?: number
}

interface RoomState {
  id: string
  players: Record<string, Player>
  status: 'waiting' | 'playing' | 'finished'
  quoteIndex: number
}

// Connect same-origin: Socket.IO talks to /socket.io on whatever host serves
// the page. In Docker that's nginx -> server:3001; in `vite dev` the Vite
// server proxies /socket.io to localhost:3001 (see vite.config.ts).
export const socket = io({
  autoConnect: false
})

export interface MatchRecord {
  id: string
  date: string
  mode: 'single' | 'multi'
  wpm: number
  accuracy: number
  rank?: number | null
  totalPlayers?: number
}

const loadHistory = (): MatchRecord[] => {
  try {
    const data = localStorage.getItem('typeblitz_history')
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export const store = reactive({
  nickname: localStorage.getItem('typeblitz_nickname') || '',
  roomId: '',
  isHost: false,
  room: null as RoomState | null,
  myId: '',
  isSinglePlayer: false,
  matchStartAt: 0, // server-provided countdown anchor (epoch ms) for multiplayer
  history: loadHistory(),
  
  saveNickname(name: string) {
    this.nickname = name
    localStorage.setItem('typeblitz_nickname', name)
  },

  saveRecord(record: Omit<MatchRecord, 'id' | 'date'>) {
    const newRecord: MatchRecord = {
      ...record,
      id: Math.random().toString(36).substring(2, 9),
      date: new Date().toISOString()
    }
    this.history.unshift(newRecord)
    if (this.history.length > 50) this.history.pop()
    localStorage.setItem('typeblitz_history', JSON.stringify(this.history))
  },

  connect() {
    if (!socket.connected) {
      socket.connect()
    }
  },

  // Resolve only once the socket is actually connected, so emits aren't fired
  // (and possibly dropped) on a half-open connection. Rejects on error/timeout.
  connectAndWait(timeoutMs = 8000): Promise<void> {
    if (socket.connected) return Promise.resolve()
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer)
        socket.off('connect', onConnect)
        socket.off('connect_error', onError)
      }
      const onConnect = () => { cleanup(); resolve() }
      const onError = (err: Error) => { cleanup(); reject(err) }
      const timer = setTimeout(() => { cleanup(); reject(new Error('timeout')) }, timeoutMs)
      socket.on('connect', onConnect)
      socket.on('connect_error', onError)
      socket.connect()
    })
  },
  
  reset(disconnect = false) {
    this.roomId = ''
    this.isHost = false
    this.room = null
    this.isSinglePlayer = false
    if (disconnect && socket.connected) {
      socket.disconnect()
    }
  }
})

// Global socket listeners
socket.on('connect', () => {
  store.myId = socket.id || ''
})

socket.on('room_update', (roomState: RoomState) => {
  store.room = roomState
})

socket.on('room_error', (msg: string) => {
  // Create/join views surface this inline; keep a console fallback for anything else.
  console.warn('room_error:', msg)
})
