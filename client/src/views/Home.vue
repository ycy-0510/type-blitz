<script setup lang="ts">
import { ref, computed } from 'vue'
import { store } from '../store'
import Dashboard from './Dashboard.vue'
import PlayPanel from '../components/PlayPanel.vue'

// No history yet -> drop the user straight onto the play page (the original
// home). Once there are races to summarise, show the racing dashboard and let
// the user slide the play page down from the START button.
const hasHistory = computed(() => store.history.length > 0)
const showPlay = ref(false)
</script>

<template>
  <PlayPanel v-if="!hasHistory" />
  <div v-else class="relative h-full w-full overflow-hidden">
    <Dashboard @start="showPlay = true" />
    <Transition name="slide-in">
      <div v-if="showPlay" class="absolute inset-0 z-40">
        <PlayPanel show-close @close="showPlay = false" />
      </div>
    </Transition>
  </div>
</template>

<style>
.slide-in-enter-active,
.slide-in-leave-active {
  transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;
}
.slide-in-enter-from,
.slide-in-leave-to {
  transform: translateY(-100%);
}
</style>
