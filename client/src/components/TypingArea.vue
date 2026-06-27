<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { playSound } from '../sound'

const props = defineProps<{
  quote: string
  isActive: boolean
}>()

const emit = defineEmits<{
  (e: 'progress', data: { correctCount: number }): void
  (e: 'finish'): void
}>()

interface WordState {
  original: string
  typed: string
  state: 'untyped' | 'current' | 'correct' | 'incorrect'
}

const words = ref<WordState[]>([])
const currentIndex = ref(0)
const totalCorrectChars = ref(0)
// True while a non-English input source (IME / non-Latin keyboard) is detected
const imeActive = ref(false)

// Preprocess quote: split into words, punctuation, and spaces as separate units
watch(() => props.quote, (newQuote) => {
  // Normalize string so everything is typeable on a standard English keyboard
  const normalized = newQuote
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents: é -> e, ò -> o
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, '-')

  // Split into units:
  //   - a word: letters/digits/apostrophes, keeping internal hyphens (e.g. "aaa-bbb", "well-being's")
  //   - whitespace runs
  //   - any other single character on its own (e.g. "," "." '"' and a standalone "-")
  const matchWords = normalized.match(/[\w']+(?:-[\w']+)*|\s+|[^\w\s]/g) || []
  
  words.value = matchWords.map((w, i) => ({
    original: w,
    typed: '',
    state: i === 0 ? 'current' : 'untyped'
  }))
  currentIndex.value = 0
  totalCorrectChars.value = 0
}, { immediate: true })

const handleKeydown = (e: KeyboardEvent) => {
  if (!props.isActive) {
    // Prevent default so space/enter doesn't click buttons on the modal
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
    }
    return
  }
  
  if (e.ctrlKey || e.metaKey || e.altKey) return

  // Detect a non-English input source (IME composition or a non-ASCII key)
  if (e.isComposing || (e as any).keyCode === 229) {
    imeActive.value = true
    e.preventDefault()
    return
  }
  if (e.key.length === 1 && e.key.charCodeAt(0) > 127) {
    imeActive.value = true
    e.preventDefault()
    return
  }
  // A normal Latin keystroke means the input source is fine again
  if (e.key.length === 1) {
    imeActive.value = false
  }

  if (e.key.length !== 1 && e.key !== 'Backspace') return

  e.preventDefault()
  
  if (e.key === 'Backspace') {
    if (words.value[currentIndex.value].typed.length > 0) {
      words.value[currentIndex.value].typed = words.value[currentIndex.value].typed.slice(0, -1)
      updateCurrentWordState()
      playSound('click')
    } else if (currentIndex.value > 0) {
      words.value[currentIndex.value].state = 'untyped'
      currentIndex.value--
      words.value[currentIndex.value].state = 'current'
      words.value[currentIndex.value].typed = words.value[currentIndex.value].typed.slice(0, -1)
      updateCurrentWordState()
      playSound('click')
    }
    emitProgress()
    return
  }

  if (currentIndex.value < words.value.length) {
    const cur = words.value[currentIndex.value]

    // Allow typing past the word length so the full (wrong) input is captured
    // for the popover. The line itself only ever renders the ORIGINAL word, so
    // it never grows or shifts; a generous cap just prevents runaway input.
    if (cur.typed.length < cur.original.length + 20) {
      cur.typed += e.key
      const expectedChar = cur.original[cur.typed.length - 1]
      playSound(e.key === expectedChar ? 'click' : 'error')
      updateCurrentWordState()
      emitProgress()
      
      if (cur.state === 'correct' && cur.typed === cur.original) {
        currentIndex.value++
        if (currentIndex.value < words.value.length) {
          words.value[currentIndex.value].state = 'current'
        } else {
          emit('finish')
        }
      }
    }
  }
}

// Index of the first character that doesn't match the original (or where the
// typed string runs past it). -1 means everything typed so far is a correct
// prefix. Characters from here onward render in the error colour.
const firstError = (w: WordState): number => {
  const n = Math.min(w.typed.length, w.original.length)
  for (let i = 0; i < n; i++) {
    if (w.typed[i] !== w.original[i]) return i
  }
  return w.typed.length > w.original.length ? w.original.length : -1
}

const updateCurrentWordState = () => {
  const cur = words.value[currentIndex.value]
  if (cur.typed === '') {
    cur.state = 'current'
  } else if (cur.original.startsWith(cur.typed)) {
    cur.state = cur.typed === cur.original ? 'correct' : 'current'
  } else {
    cur.state = 'incorrect'
  }
}

const emitProgress = () => {
  let count = 0
  for (let i = 0; i < words.value.length; i++) {
    const w = words.value[i]
    if (i < currentIndex.value) {
      count += w.original.length
    } else if (i === currentIndex.value && w.state === 'current') {
      count += w.typed.length
    }
  }
  totalCorrectChars.value = count
  emit('progress', { correctCount: count })
}

// compositionstart is the most reliable cross-browser signal that an IME is on
const handleCompositionStart = () => {
  if (props.isActive) imeActive.value = true
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown, { capture: true })
  window.addEventListener('compositionstart', handleCompositionStart, { capture: true })
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown, { capture: true })
  window.removeEventListener('compositionstart', handleCompositionStart, { capture: true })
})
</script>

<template>
  <div class="relative text-[1.5rem] leading-[4rem] tracking-wider break-words mt-12 mb-6 whitespace-pre-wrap font-mono">
    <!-- Non-English input source hint -->
    <div v-if="imeActive" class="absolute -top-10 left-0 right-0 text-center text-[#f92672] text-base font-bold animate-pulse z-20">
      ⚠ Mind the input source
    </div>

    <span
      v-for="(wordObj, idx) in words"
      :key="idx" 
      class="relative inline-block"
      :class="{
        'text-[#75715e]': wordObj.state === 'untyped',
        'text-[#a6e22e]': wordObj.state === 'correct'
      }"
    >
      <!-- If typing this word currently -->
      <template v-if="wordObj.state === 'current' || wordObj.state === 'incorrect'">
        <span
          v-for="(char, cIdx) in wordObj.original"
          :key="cIdx"
          class="relative"
          :class="firstError(wordObj) !== -1 && cIdx >= firstError(wordObj)
            ? 'text-[#f92672] bg-[#f92672]/20'
            : 'text-[#f8f8f2]'"
        ><!-- Blinking underline cursor UNDER the next character to type --><span v-if="cIdx === wordObj.typed.length" class="absolute left-0 right-0 -bottom-1 h-[3px] bg-[#f8f8f2] animate-pulse z-10"></span>{{ char }}</span>

        <!-- Popover showing what was actually mistyped (full input) -->
        <div v-if="wordObj.state === 'incorrect' && wordObj.original.trim().length > 0" class="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-[#f92672] text-white text-base px-3 py-1 rounded shadow-lg whitespace-nowrap z-50">
          {{ wordObj.typed }}
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
