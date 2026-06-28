<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { playSound } from './sound'

// "Thock" when clicking interactive UI (buttons, links, role=button, and the
// clickable cards which are plain divs marked with `cursor-pointer`). Keystroke
// sounds are handled only inside the typing game (see TypingArea.vue).
const onGlobalPointer = (e: PointerEvent) => {
  const el = e.target as HTMLElement | null
  if (el?.closest('button, a, [role="button"], .cursor-pointer')) {
    playSound('click')
  }
}

onMounted(() => window.addEventListener('pointerdown', onGlobalPointer, { capture: true }))
onUnmounted(() => window.removeEventListener('pointerdown', onGlobalPointer, { capture: true }))
</script>

<template>
  <div class="h-screen w-screen bg-[#272822] text-[#f8f8f2] font-mono overflow-hidden">
    <router-view></router-view>
  </div>
</template>
