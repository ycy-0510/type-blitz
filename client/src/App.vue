<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { playSound, isTypingCapture } from './sound'

// App-wide keystroke "thock" on every key press. The race typing field plays
// its own correct/error sounds, so we defer to it (isTypingCapture) to avoid
// doubling. Modifier-only keys, shortcuts and IME composition are ignored.
const onGlobalKey = (e: KeyboardEvent) => {
  if (isTypingCapture()) return
  if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return
  if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter') {
    playSound('click')
  }
}

onMounted(() => window.addEventListener('keydown', onGlobalKey, { capture: true }))
onUnmounted(() => window.removeEventListener('keydown', onGlobalKey, { capture: true }))
</script>

<template>
  <div class="h-screen w-screen bg-[#272822] text-[#f8f8f2] font-mono overflow-hidden">
    <router-view></router-view>
  </div>
</template>
