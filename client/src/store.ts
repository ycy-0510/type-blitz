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

export const socket = io(window.location.hostname === 'localhost' ? 'http://localhost:3001' : '/', {
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
  alert(msg)
})
