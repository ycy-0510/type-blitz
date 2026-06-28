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

// Cached white-noise buffer (used for the crowd cheer in the finish sound).
let noiseBuffer: AudioBuffer | null = null
const getNoise = (ctx: AudioContext): AudioBuffer => {
  if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
    const len = Math.floor(ctx.sampleRate * 5)
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  }
  return noiseBuffer
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

// Finish line (~4s): a race car roars up, blasts past with a Doppler drop, the
// crowd cheers, and a victory fanfare hits the moment it crosses. Played
// whenever a player's car reaches the finish.
let finishPlaying = false
export const playFinish = () => {
  const ctx = getCtx()
  if (!ctx || finishPlaying) return
  finishPlaying = true

  const now = ctx.currentTime
  const PASS = 2.0   // the instant the car crosses the line
  const END = 4.3

  const master = ctx.createGain()
  master.gain.value = 0.9
  master.connect(ctx.destination)

  // --- Engine: two detuned saws + a square sub through a sweeping lowpass ---
  const engGain = ctx.createGain()
  const engFilter = ctx.createBiquadFilter()
  engFilter.type = 'lowpass'
  engFilter.connect(engGain)
  engGain.connect(master)

  const o1 = ctx.createOscillator(); o1.type = 'sawtooth'
  const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.detune.value = 14
  const sub = ctx.createOscillator(); sub.type = 'square'
  const subGain = ctx.createGain(); subGain.gain.value = 0.4
  o1.connect(engFilter); o2.connect(engFilter)
  sub.connect(subGain); subGain.connect(engFilter)

  // Doppler pitch: revs climb as it approaches, drop as it screams past.
  for (const [osc, mul] of [[o1, 1], [o2, 1], [sub, 0.5]] as const) {
    osc.frequency.setValueAtTime(70 * mul, now)
    osc.frequency.exponentialRampToValueAtTime(300 * mul, now + PASS)
    osc.frequency.exponentialRampToValueAtTime(90 * mul, now + PASS + 1.6)
  }

  // Filter opens up at the pass (bright, in-your-face), then closes as it recedes.
  engFilter.frequency.setValueAtTime(300, now)
  engFilter.frequency.exponentialRampToValueAtTime(4000, now + PASS)
  engFilter.frequency.exponentialRampToValueAtTime(500, now + END)

  // Engine volume: approaches, loudest at the pass, fades into the distance.
  engGain.gain.setValueAtTime(0.0001, now)
  engGain.gain.exponentialRampToValueAtTime(0.3, now + PASS)
  engGain.gain.exponentialRampToValueAtTime(0.2, now + PASS + 0.6)
  engGain.gain.exponentialRampToValueAtTime(0.0001, now + END)

  // Engine "chug" rumble — an LFO on the engine gain, faster as revs rise.
  const lfo = ctx.createOscillator(); lfo.type = 'sine'
  const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.07
  lfo.frequency.setValueAtTime(16, now)
  lfo.frequency.exponentialRampToValueAtTime(48, now + PASS)
  lfo.frequency.exponentialRampToValueAtTime(20, now + END)
  lfo.connect(lfoGain); lfoGain.connect(engGain.gain)

  for (const osc of [o1, o2, sub, lfo]) { osc.start(now); osc.stop(now + END) }

  // --- Crowd cheer: band-passed noise that swells as the car flies past ---
  const noise = ctx.createBufferSource(); noise.buffer = getNoise(ctx)
  const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 2200; nf.Q.value = 0.6
  const ng = ctx.createGain()
  noise.connect(nf); nf.connect(ng); ng.connect(master)
  ng.gain.setValueAtTime(0.0001, now)
  ng.gain.exponentialRampToValueAtTime(0.14, now + PASS + 0.1)
  ng.gain.setValueAtTime(0.14, now + PASS + 1.0)
  ng.gain.exponentialRampToValueAtTime(0.0001, now + END)
  noise.start(now); noise.stop(now + END)

  // --- Victory fanfare at the pass: a rising brass triad, last note held ---
  const fanfare: [number, number, number][] = [
    [784, PASS, 0.2],          // G5
    [1047, PASS + 0.2, 0.2],   // C6
    [1319, PASS + 0.4, 0.9],   // E6 (held)
  ]
  for (const [freq, at, dur] of fanfare) {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    const f = ctx.createBiquadFilter()
    o.type = 'sawtooth'
    f.type = 'lowpass'; f.frequency.value = 2600
    o.frequency.setValueAtTime(freq, now + at)
    g.gain.setValueAtTime(0.0001, now + at)
    g.gain.exponentialRampToValueAtTime(0.22, now + at + 0.03)
    g.gain.setValueAtTime(0.22, now + at + dur * 0.6)
    g.gain.exponentialRampToValueAtTime(0.0001, now + at + dur)
    o.connect(f); f.connect(g); g.connect(master)
    o.start(now + at); o.stop(now + at + dur + 0.05)
  }

  setTimeout(() => { finishPlaying = false }, END * 1000 + 200)
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
