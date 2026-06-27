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
  rematch?: boolean
}

interface RoomState {
  id: string
  players: Record<string, Player>
  status: 'waiting' | 'playing' | 'finished'
  // -1 = the special custom quote (special-version); otherwise an index into quotes.
  quoteIndex: number
  customQuote?: { text: string; source: string }
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
    const all: MatchRecord[] = data ? JSON.parse(data) : []
    // Drop 0-WPM results (no real attempt) and re-persist the cleaned list so
    // any previously-saved 0-WPM records are removed automatically.
    const cleaned = all.filter((r) => (r.wpm ?? 0) > 0)
    if (cleaned.length !== all.length) {
      localStorage.setItem('typeblitz_history', JSON.stringify(cleaned))
    }
    return cleaned
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
    // Skip 0-WPM results — a timed-out run with nothing typed isn't meaningful.
    if (!record.wpm || record.wpm <= 0) return
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
  // Keep host flag in sync with the server (host can be reassigned on rematch
  // or when the previous host leaves).
  const me = store.myId ? roomState.players[store.myId] : undefined
  if (me) store.isHost = me.isHost
})

socket.on('room_error', (msg: string) => {
  // Create/join views surface this inline; keep a console fallback for anything else.
  console.warn('room_error:', msg)
})
