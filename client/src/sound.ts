// Shared Web-Audio sound engine (mechanical "thock" + countdown beeps)

let audioCtx: AudioContext | null = null

const getCtx = (): AudioContext | null => {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    if (audioCtx.state === 'suspended') audioCtx.resume()
    return audioCtx
  } catch {
    return null
  }
}

// Keystroke feedback: 'click' for correct, 'error' for wrong key.
export const playSound = (type: 'click' | 'error') => {
  const ctx = getCtx()
  if (!ctx) return

  const osc = ctx.createOscillator()
  const gainNode = ctx.createGain()
  const filter = ctx.createBiquadFilter()

  osc.connect(filter)
  filter.connect(gainNode)
  gainNode.connect(ctx.destination)

  const now = ctx.currentTime
  if (type === 'click') {
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(600, now)
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.04)
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(1200, now)
    gainNode.gain.setValueAtTime(0.5, now)
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.04)
    osc.start(now)
    osc.stop(now + 0.05)
  } else {
    osc.type = 'square'
    osc.frequency.setValueAtTime(150, now)
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.1)
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(400, now)
    gainNode.gain.setValueAtTime(0.3, now)
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
    osc.start(now)
    osc.stop(now + 0.15)
  }
}

// Finish-line fanfare: an engine zoom past the line + a short two-note horn.
// Played whenever a player's car reaches the finish.
export const playFinish = () => {
  const ctx = getCtx()
  if (!ctx) return

  const now = ctx.currentTime

  // Engine "zoom" — a sawtooth pitch sweep through a brightening lowpass.
  const eng = ctx.createOscillator()
  const eg = ctx.createGain()
  const ef = ctx.createBiquadFilter()
  eng.type = 'sawtooth'
  ef.type = 'lowpass'
  eng.frequency.setValueAtTime(160, now)
  eng.frequency.exponentialRampToValueAtTime(900, now + 0.45)
  ef.frequency.setValueAtTime(800, now)
  ef.frequency.exponentialRampToValueAtTime(3000, now + 0.45)
  eg.gain.setValueAtTime(0.0001, now)
  eg.gain.exponentialRampToValueAtTime(0.25, now + 0.05)
  eg.gain.exponentialRampToValueAtTime(0.0001, now + 0.55)
  eng.connect(ef)
  ef.connect(eg)
  eg.connect(ctx.destination)
  eng.start(now)
  eng.stop(now + 0.6)

  // Victory horn — two bright notes (a rising fifth, G5 -> D6).
  for (const [freq, at] of [[784, 0.42], [1175, 0.6]] as const) {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'square'
    o.frequency.setValueAtTime(freq, now + at)
    g.gain.setValueAtTime(0.0001, now + at)
    g.gain.exponentialRampToValueAtTime(0.3, now + at + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.3)
    o.connect(g)
    g.connect(ctx.destination)
    o.start(now + at)
    o.stop(now + at + 0.32)
  }
}

// Racing-style countdown beep. Short high "beep" for ticks, longer for GO.
export const playBeep = (type: 'tick' | 'go') => {
  const ctx = getCtx()
  if (!ctx) return

  const osc = ctx.createOscillator()
  const gainNode = ctx.createGain()

  osc.connect(gainNode)
  gainNode.connect(ctx.destination)

  const now = ctx.currentTime
  osc.type = 'sine'

  if (type === 'tick') {
    osc.frequency.setValueAtTime(700, now)
    gainNode.gain.setValueAtTime(0.0001, now)
    gainNode.gain.exponentialRampToValueAtTime(0.4, now + 0.01)
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
    osc.start(now)
    osc.stop(now + 0.2)
  } else {
    osc.frequency.setValueAtTime(1175, now)
    gainNode.gain.setValueAtTime(0.0001, now)
    gainNode.gain.exponentialRampToValueAtTime(0.45, now + 0.01)
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.6)
    osc.start(now)
    osc.stop(now + 0.65)
  }
}
