<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { store } from '../store'
import { BUILD, WHATS_NEW_REV } from '../version'

// "What's New" announcement styled like a US highway guide sign: a 4:3 green
// board (white border, uppercase white text — MUTCD style) cantilevered off the
// right edge of the screen on two horizontal support arms (no vertical pole).
//
// It does NOT auto-dismiss. It reappears only when the announcement actually
// changes: closing it remembers the current WHATS_NEW_REV in localStorage, so it
// stays hidden until that revision is bumped — NOT on every BUILD (which changes
// on every deploy). See version.ts for the distinction.

const STORAGE_KEY = 'typeblitz_whatsnew'

// Recent highlights, in US-sign ALL CAPS.
const highlights = [
  'CHINESE TYPING RACE',
  'IME + ZHUYIN FONT (CTRL+/)',
  'SMOOTHER TYPING ENGINE',
]

const dismissed = ref(localStorage.getItem(STORAGE_KEY) === WHATS_NEW_REV)
// Drives the slide-in: starts off-screen (to the right) then animates in.
const mounted = ref(false)

const serverBuild = computed(() => store.serverBuild)

onMounted(() => {
  // Next frame so the initial off-screen transform is committed before we slide.
  requestAnimationFrame(() => { mounted.value = true })
})

const close = () => {
  mounted.value = false
  localStorage.setItem(STORAGE_KEY, WHATS_NEW_REV)
  // Let the slide-out finish before unmounting.
  setTimeout(() => { dismissed.value = true }, 400)
}
</script>

<template>
  <div
    v-if="!dismissed"
    class="fixed top-24 right-0 z-50 flex items-stretch select-none transition-transform duration-500 ease-out"
    :class="mounted ? 'translate-x-0' : 'translate-x-full'"
    style="font-family: 'Quantico', sans-serif"
  >
    <!-- 4:3 guide sign board -->
    <div class="relative w-60 aspect-[4/3] bg-[#006b3c] rounded-md shadow-[0_10px_30px_rgba(0,0,0,0.6)] ring-1 ring-black/40">
      <!-- White rounded frame, classic US guide-sign inset border -->
      <div class="absolute inset-2 border-2 border-white rounded-[4px] flex flex-col px-3 py-2 text-white">
        <!-- Close (no auto-dismiss) -->
        <button
          @click="close"
          title="Dismiss"
          class="absolute top-1 right-1 w-6 h-6 flex items-center justify-center text-white/70 hover:text-white text-lg leading-none"
        >&times;</button>

        <div class="text-center font-black tracking-[0.15em] text-lg">WHAT'S NEW</div>
        <div class="h-[2px] bg-white/80 my-1.5"></div>

        <ul class="flex-1 flex flex-col justify-center gap-1.5 font-bold tracking-wide text-[13px]">
          <li v-for="item in highlights" :key="item" class="flex items-start gap-1.5">
            <span class="mt-[1px]">&#9656;</span>
            <span>{{ item }}</span>
          </li>
        </ul>

        <div class="text-center font-bold tracking-wider text-[10px] text-white/85 mt-1">
          CLIENT {{ BUILD }}<span v-if="serverBuild"> &middot; SERVER {{ serverBuild }}</span>
        </div>
      </div>
    </div>

    <!-- Two horizontal support arms anchoring the sign to the right edge -->
    <div class="flex flex-col justify-evenly py-4 -ml-px">
      <div
        v-for="n in 2"
        :key="n"
        class="relative h-2.5 w-9 rounded-r-sm bg-gradient-to-b from-gray-400 via-gray-500 to-gray-700 shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
      >
        <!-- Bolt where the arm meets the sign -->
        <span class="absolute left-0.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-gray-300 ring-1 ring-gray-700"></span>
      </div>
    </div>
  </div>
</template>
