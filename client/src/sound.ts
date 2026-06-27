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

// 16-bit chiptune "Happy Birthday" — played once when finishing the special
// custom quote. Square-wave lead (the classic console pulse) over a soft bass.
let birthdayPlaying = false
export const playHappyBirthday = () => {
  const ctx = getCtx()
  if (!ctx || birthdayPlaying) return
  birthdayPlaying = true

  // Note frequencies (Hz)
  const N: Record<string, number> = {
    G4: 392.0, A4: 440.0, B4: 493.88, C5: 523.25,
    D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99,
  }
  // [note, beats] — the four phrases of Happy Birthday
  const beat = 0.32
  const melody: [string, number][] = [
    ['G4', 0.75], ['G4', 0.25], ['A4', 1], ['G4', 1], ['C5', 1], ['B4', 2],
    ['G4', 0.75], ['G4', 0.25], ['A4', 1], ['G4', 1], ['D5', 1], ['C5', 2],
    ['G4', 0.75], ['G4', 0.25], ['G5', 1], ['E5', 1], ['C5', 1], ['B4', 1], ['A4', 2],
    ['F5', 0.75], ['F5', 0.25], ['E5', 1], ['C5', 1], ['D5', 1], ['C5', 2],
  ]

  let t = ctx.currentTime + 0.05
  for (const [note, beats] of melody) {
    const dur = beats * beat
    const freq = N[note]

    // Pulse-wave lead
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(freq, t)
    osc.connect(gain)
    gain.connect(ctx.destination)
    const peak = 0.22
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.02)
    gain.gain.setValueAtTime(peak, t + dur * 0.7)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.95)
    osc.start(t)
    osc.stop(t + dur)

    // Soft bass one octave down for a fuller chip sound
    const bass = ctx.createOscillator()
    const bgain = ctx.createGain()
    bass.type = 'triangle'
    bass.frequency.setValueAtTime(freq / 2, t)
    bass.connect(bgain)
    bgain.connect(ctx.destination)
    bgain.gain.setValueAtTime(0.0001, t)
    bgain.gain.exponentialRampToValueAtTime(0.12, t + 0.02)
    bgain.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.9)
    bass.start(t)
    bass.stop(t + dur)

    t += dur
  }

  // Allow replaying after the tune ends (e.g. a later special match)
  const totalMs = (t - ctx.currentTime) * 1000
  setTimeout(() => { birthdayPlaying = false }, totalMs + 200)
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
