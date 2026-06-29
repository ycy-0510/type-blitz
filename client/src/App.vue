<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { playSound } from './sound'
import WhatsNew from './components/WhatsNew.vue'
import { BUILD } from './version'

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
    <WhatsNew />
    <!-- Persistent build label (the What's New billboard can be dismissed). -->
    <div class="fixed bottom-3 left-1/2 -translate-x-1/2 text-gray-600 text-[10px] tracking-widest z-10 pointer-events-none">
      BUILD {{ BUILD }}
    </div>
  </div>
</template>
