<script setup lang="ts">
import { computed, ref } from 'vue'
import { store } from '../store'
import type { Language } from '../store'
import { byLanguage } from '../stats'

// Floating "match history" button + modal, shared by the dashboard and the
// play panel so both can open the raw record list.
const showRecords = ref(false)

// English (WPM) and Chinese (CPM) runs are listed separately — mixing the two
// scales in one table makes the numbers meaningless side by side.
const lang = ref<Language>(store.language)
const rows = computed(() => byLanguage(store.history, lang.value))
const counts = computed(() => ({
  en: byLanguage(store.history, 'en').length,
  zh: byLanguage(store.history, 'zh').length,
}))
</script>

<template>
  <!-- Records Button -->
  <button
    @click="showRecords = true"
    title="Match History"
    class="fixed bottom-8 right-8 bg-[#66d9ef] text-black font-bold p-4 rounded-full shadow-[0_0_20px_rgba(102,217,239,0.3)] hover:scale-110 hover:shadow-[0_0_30px_rgba(102,217,239,0.6)] transition-all z-30"
  >
    <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
  </button>

  <!-- Records Modal -->
  <div v-if="showRecords" class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
    <div class="bg-[#1e1e1e] p-8 rounded-xl border border-gray-700 w-full max-w-3xl h-[80vh] flex flex-col shadow-2xl relative" @click.stop>
      <button @click="showRecords = false" class="absolute top-4 right-4 text-gray-500 hover:text-white text-2xl">&times;</button>
      <h3 class="text-2xl font-bold mb-4 text-[#66d9ef] tracking-widest border-b border-gray-700 pb-4">MATCH HISTORY</h3>

      <!-- Language split -->
      <div class="flex items-center gap-1 bg-black/30 border border-gray-700 rounded-xl p-1 mb-4 self-start">
        <button
          v-for="opt in [{ id: 'en' as Language, label: 'ENGLISH', n: counts.en }, { id: 'zh' as Language, label: 'CHINESE', n: counts.zh }]"
          :key="opt.id"
          @click="lang = opt.id"
          class="px-4 py-1.5 rounded-lg text-xs font-bold tracking-widest transition-all"
          :class="lang === opt.id ? 'bg-[#66d9ef] text-black' : 'text-gray-400 hover:text-white'"
        >
          {{ opt.label }}
          <span class="ml-1 opacity-60 font-normal">{{ opt.n }}</span>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto pr-2">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="text-gray-500 border-b border-gray-800 text-sm">
              <th class="py-3 px-4 font-normal">DATE</th>
              <th class="py-3 px-4 font-normal">MODE</th>
              <th class="py-3 px-4 text-right font-normal">{{ lang === 'zh' ? 'CPM' : 'WPM' }}</th>
              <th class="py-3 px-4 text-right font-normal">ACCURACY</th>
              <th class="py-3 px-4 text-center font-normal">RANK</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in rows" :key="record.id" class="border-b border-gray-800 hover:bg-white/5 transition">
              <td class="py-3 px-4 text-gray-400 text-sm">{{ new Date(record.date).toLocaleString() }}</td>
              <td class="py-3 px-4">
                <span class="text-xs font-bold px-2 py-1 rounded" :class="record.mode === 'single' ? 'bg-[#a6e22e]/20 text-[#a6e22e]' : 'bg-[#f92672]/20 text-[#f92672]'">
                  {{ record.mode.toUpperCase() }}
                </span>
              </td>
              <td class="py-3 px-4 text-right font-bold text-white text-lg">{{ record.wpm }}</td>
              <td class="py-3 px-4 text-right text-gray-300">{{ record.accuracy }}%</td>
              <td class="py-3 px-4 text-center">
                <span v-if="record.mode === 'multi' && record.rank" class="text-gray-300">
                  <span class="text-white font-bold">#{{ record.rank }}</span> <span class="text-sm opacity-50">/ {{ record.totalPlayers }}</span>
                </span>
                <span v-else class="text-gray-600">-</span>
              </td>
            </tr>
            <tr v-if="rows.length === 0">
              <td colspan="5" class="py-12 text-center text-gray-500">
                No {{ lang === 'zh' ? 'Chinese' : 'English' }} match records yet. Play a game to see your history!
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
