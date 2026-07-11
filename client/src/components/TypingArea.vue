<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { playSound } from '../sound'

// Input model: a tiny invisible native <input> follows the caret position and
// receives all typing. Committed text (for Chinese, whatever the IME commits on
// selection; for English, plain keystrokes) is consumed unit-by-unit against the
// target — a fully matched unit is eaten and cleared from the box, anything else
// stays in the box (backspace works natively) and is parked on the current unit
// for the error popover. The rendered line is entirely our own spans, so the
// interface is identical to the old keydown-driven version.

const props = withDefaults(defineProps<{
  quote: string
  isActive: boolean
  language?: 'en' | 'zh'
}>(), { language: 'en' })

const emit = defineEmits<{
  // strokes = committed chars in this event (an IME commit can carry several)
  (e: 'progress', data: { correctCount: number; strokes: number }): void
  (e: 'finish'): void
}>()

interface WordState {
  original: string
  typed: string
  state: 'untyped' | 'current' | 'correct' | 'incorrect'
}

const words = ref<WordState[]>([])
const currentIndex = ref(0)
const finished = ref(false)
const composing = ref(false)
const inputEl = ref<HTMLInputElement | null>(null)
const areaEl = ref<HTMLElement | null>(null)
// Committed-but-unconsumed length after the previous input event, used to tell
// additions from deletions for sounds/stroke counting.
let lastBoxLen = 0

// The zhuyin-annotated font is a reading aid for players who can't touch-type
// Chinese yet; toggled with Cmd/Ctrl+/ and remembered across sessions.
const ZH_FONT_KEY = 'typeblitz_zh_font'
const zhuyinFont = ref(localStorage.getItem(ZH_FONT_KEY) === 'zhuyin')
const toggleZhFont = () => {
  zhuyinFont.value = !zhuyinFont.value
  localStorage.setItem(ZH_FONT_KEY, zhuyinFont.value ? 'zhuyin' : 'standard')
}
const fontClass = computed(() => {
  if (props.language !== 'zh') return 'font-mono'
  return zhuyinFont.value ? 'font-zh-zhuyin' : 'font-zh'
})

// --- Character normalisation -------------------------------------------------
// Full-width and half-width forms compare equal, so a ，。！ in the passage can
// be typed as , . ! (and vice versa) regardless of the IME's punctuation mode.
const NORM_MAP: Record<string, string> = {
  '。': '.', '、': ',', '「': '"', '」': '"', '『': '"', '』': '"',
  '·': '.', '‧': '.', '．': '.', '　': ' ', '…': '.', '—': '-',
}
const normChar = (ch: string): string => {
  const mapped = NORM_MAP[ch]
  if (mapped) return mapped
  const code = ch.charCodeAt(0)
  // Full-width ASCII block (！＂＃… U+FF01–FF5E) → its half-width counterpart
  if (code >= 0xff01 && code <= 0xff5e) return String.fromCharCode(code - 0xfee0)
  return ch
}
const normEq = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (normChar(a[i]) !== normChar(b[i])) return false
  }
  return true
}

// Preprocess quote into typing units.
watch(() => [props.quote, props.language] as const, ([newQuote, language]) => {
  let matchWords: string[]
  if (language === 'zh') {
    // Chinese: every character (including punctuation) is its own unit — there
    // are no multi-char "words" to complete, and no spaces.
    matchWords = Array.from(newQuote)
  } else {
    // Normalize string so everything is typeable on a standard English keyboard
    const normalized = newQuote
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents: é -> e, ò -> o
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[—–]/g, '-')

    // Split into units:
    //   - a word: letters/digits/apostrophes, keeping internal hyphens
    //   - whitespace runs
    //   - any other single character on its own (e.g. "," "." '"')
    matchWords = normalized.match(/[\w']+(?:-[\w']+)*|\s+|[^\w\s]/g) || []
  }

  words.value = matchWords.map((w, i) => ({
    original: w,
    typed: '',
    state: i === 0 ? 'current' : 'untyped'
  }))
  currentIndex.value = 0
  finished.value = false
  lastBoxLen = 0
  if (inputEl.value) inputEl.value.value = ''
  // Lambda, not a direct reference: this watcher fires immediately during
  // setup, before positionInput's declaration below is reached.
  nextTick(() => positionInput())
}, { immediate: true })

// --- Input processing ----------------------------------------------------------
const process = () => {
  const el = inputEl.value
  if (!el || finished.value) return
  if (!props.isActive) { el.value = ''; lastBoxLen = 0; return }

  let box = el.value
  let consumed = 0

  // Eat fully matching units off the head of the box. A single IME commit can
  // complete several units (e.g. 「你好。」 = three Chinese units at once).
  while (currentIndex.value < words.value.length) {
    const cur = words.value[currentIndex.value]
    const tlen = cur.original.length
    if (box.length >= tlen && normEq(box.slice(0, tlen), cur.original)) {
      cur.typed = cur.original
      cur.state = 'correct'
      box = box.slice(tlen)
      consumed += tlen
      currentIndex.value++
      if (currentIndex.value < words.value.length) {
        words.value[currentIndex.value].state = 'current'
      }
    } else {
      break
    }
  }

  // Park the remainder on the current unit (drives the error popover). Cap it
  // so runaway input can't grow unbounded — same headroom as before.
  const cur = words.value[currentIndex.value]
  if (cur) {
    if (box.length > cur.original.length + 20) box = box.slice(0, cur.original.length + 20)
    cur.typed = box
    updateCurrentWordState()
  } else {
    box = ''
  }
  if (el.value !== box) el.value = box

  const effectiveLen = consumed + box.length
  const delta = effectiveLen - lastBoxLen
  lastBoxLen = box.length

  if (delta > 0) {
    playSound(cur && cur.state === 'incorrect' ? 'error' : 'click')
  } else if (delta < 0) {
    playSound('click') // deletion
  }

  emitProgress(Math.abs(delta) || 1)

  if (currentIndex.value >= words.value.length && !finished.value) {
    finished.value = true
    emit('finish')
  }
  nextTick(positionInput)
}

const onInput = (e: Event) => {
  // Composition text (zhuyin/pinyin in progress) isn't committed yet — wait for
  // compositionend. Order of the final input vs compositionend varies across
  // browsers, so both paths call process(); reprocessing the same box is a no-op.
  if (composing.value || (e as InputEvent).isComposing) return
  process()
}
const onCompositionEnd = () => {
  composing.value = false
  process()
}

// English mode never needs an IME — surface the old "mind the input source"
// warning when one is composing or has committed non-ASCII characters.
const imeActive = computed(() => {
  if (props.language !== 'en' || !props.isActive) return false
  if (composing.value) return true
  const typed = words.value[currentIndex.value]?.typed ?? ''
  return /[^\x00-\x7f]/.test(typed)
})

// A typed character is wrong if it doesn't match the original at that position,
// or it runs past the end of the original word.
const isTypedCharWrong = (w: WordState, i: number): boolean =>
  i >= w.original.length || !normEq(w.typed[i], w.original[i])

const charTypedCorrect = (w: WordState, i: number): boolean =>
  i < w.typed.length && normEq(w.typed[i], w.original[i])
const charTypedWrong = (w: WordState, i: number): boolean =>
  i < w.typed.length && !normEq(w.typed[i], w.original[i])

// Render whitespace visibly in the popover, otherwise a mistyped space is invisible.
const displayChar = (ch: string): string => (/\s/.test(ch) ? '␣' : ch)

const updateCurrentWordState = () => {
  const cur = words.value[currentIndex.value]
  if (!cur) return
  if (cur.typed === '') {
    cur.state = 'current'
  } else if (normEq(cur.typed, cur.original.slice(0, cur.typed.length))) {
    cur.state = 'current' // full match is consumed in process(), so always partial here
  } else {
    cur.state = 'incorrect'
  }
}

const emitProgress = (strokes: number) => {
  let count = 0
  for (let i = 0; i < words.value.length; i++) {
    const w = words.value[i]
    if (i < currentIndex.value) {
      count += w.original.length
    } else if (i === currentIndex.value && w.state === 'current') {
      count += w.typed.length
    }
  }
  emit('progress', { correctCount: count, strokes })
}

// --- Focus & caret placement ---------------------------------------------------
// The IME candidate window is anchored to the hidden input's caret, so the input
// tracks the on-screen cursor position — candidates pop up right where you look.
const positionInput = () => {
  const area = areaEl.value
  const el = inputEl.value
  if (!area || !el) return
  const anchor = area.querySelector('.cursor-anchor') as HTMLElement | null
  // The cursor underline sits inside the current char's span — that span has
  // the actual glyph metrics. Fall back to the current unit if it's missing
  // (e.g. the parked input has overrun the unit).
  const target = anchor?.parentElement ??
    (area.querySelector('.unit-current') as HTMLElement | null)
  if (!target) return
  const ar = area.getBoundingClientRect()
  const tr = target.getBoundingClientRect()
  el.style.left = `${tr.left - ar.left}px`
  // Sit just BELOW the char being typed (the 4rem line-height leaves a wide
  // gap between lines), so in-flight composition text never covers the quote.
  el.style.top = `${tr.bottom - ar.top + 4}px`
}

const focusInput = () => {
  inputEl.value?.focus({ preventScroll: true })
}
// While the game is live the hidden input must own focus, or keystrokes vanish.
const onInputBlur = () => {
  if (props.isActive && !finished.value) setTimeout(() => {
    if (props.isActive && !finished.value) focusInput()
  }, 0)
}

watch(() => props.isActive, (active) => {
  if (active) {
    nextTick(() => { positionInput(); focusInput() })
  } else if (inputEl.value) {
    // Drop anything typed while inactive (e.g. during the countdown).
    inputEl.value.value = ''
    lastBoxLen = 0
  }
})

const handleWindowKeydown = (e: KeyboardEvent) => {
  // Cmd/Ctrl+/ swaps in the zhuyin-annotated font (backup for players who
  // don't know a key's zhuyin yet). Only meaningful in Chinese mode.
  if ((e.metaKey || e.ctrlKey) && e.key === '/') {
    if (props.language === 'zh') {
      e.preventDefault()
      toggleZhFont()
    }
    return
  }
  if (!props.isActive) {
    // Prevent default so space/enter doesn't click buttons on the modal
    if (e.key === ' ' || e.key === 'Enter') e.preventDefault()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleWindowKeydown, { capture: true })
  if (props.isActive) nextTick(() => { positionInput(); focusInput() })
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleWindowKeydown, { capture: true })
})
</script>

<template>
  <div
    ref="areaEl"
    @click="focusInput"
    class="relative text-[1.5rem] leading-[4rem] tracking-wider break-words mt-12 mb-6 whitespace-pre-wrap"
    :class="fontClass"
  >
    <!-- Non-English input source hint (English mode only) -->
    <div v-if="imeActive" class="absolute -top-10 left-0 right-0 text-center text-[#f92672] text-base font-bold animate-pulse z-20">
      ⚠ Mind the input source
    </div>

    <!-- The input that owns keyboard focus. It rides along under the caret so
         the IME candidate window anchors at the typing position. It must stay
         VISIBLE (opacity 0 makes macOS IMEs refuse to show the candidate
         window): the text is transparent normally and only shown while an IME
         composition is in progress, so in-flight zhuyin/pinyin appears inline
         right where you're typing. -->
    <input
      ref="inputEl"
      type="text"
      class="absolute w-56 h-8 p-0 m-0 border-none outline-none pointer-events-none z-30 text-lg leading-none"
      :class="composing ? 'text-[#e6db74] bg-[#1e1e1e]/90 rounded px-1' : 'text-transparent bg-transparent'"
      style="font-family: inherit; caret-color: transparent"
      autocapitalize="off"
      autocomplete="off"
      autocorrect="off"
      spellcheck="false"
      tabindex="-1"
      @input="onInput"
      @compositionstart="composing = true"
      @compositionend="onCompositionEnd"
      @blur="onInputBlur"
      @paste.prevent
    />

    <span
      v-for="(wordObj, idx) in words"
      :key="idx"
      class="relative inline-block"
      :class="{
        'text-[#75715e]': wordObj.state === 'untyped',
        'text-[#a6e22e]': wordObj.state === 'correct',
        'unit-current': wordObj.state === 'current' || wordObj.state === 'incorrect'
      }"
    >
      <!-- If typing this word currently -->
      <template v-if="wordObj.state === 'current' || wordObj.state === 'incorrect'">
        <span
          v-for="(char, cIdx) in wordObj.original"
          :key="cIdx"
          class="relative"
          :class="{
            'text-[#f8f8f2]': charTypedCorrect(wordObj, cIdx),
            'text-[#f92672] bg-[#f92672]/20': charTypedWrong(wordObj, cIdx),
            'text-[#75715e]': cIdx >= wordObj.typed.length
          }"
        ><!-- Blinking underline cursor UNDER the next character to type --><span v-if="cIdx === wordObj.typed.length" class="cursor-anchor absolute left-0 right-0 -bottom-1 h-[3px] bg-[#f8f8f2] animate-pulse z-10"></span>{{ char }}</span>

        <!-- Popover showing what was actually mistyped (full input), spaces as ␣,
             wavy underline under the wrong characters. -->
        <div v-if="wordObj.state === 'incorrect' && wordObj.original.trim().length > 0" class="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-[#f92672] text-white text-base px-3 py-1 rounded shadow-lg whitespace-nowrap z-50">
          <span
            v-for="(ch, i) in wordObj.typed"
            :key="i"
            :class="{ 'underline decoration-wavy decoration-2 underline-offset-2': isTypedCharWrong(wordObj, i) }"
          >{{ displayChar(ch) }}</span>
          <div class="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-[#f92672] rotate-45"></div>
        </div>
      </template>

      <!-- Untyped or Fully Correct Word -->
      <template v-else>
        {{ wordObj.original }}
      </template>
    </span>
  </div>
</template>
