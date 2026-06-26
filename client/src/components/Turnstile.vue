<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const emit = defineEmits<{
  (e: 'verified', token: string): void
  (e: 'expired'): void
}>()

// Public site key — safe to expose. Injected at build time by Vite.
const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

const container = ref<HTMLElement | null>(null)
let widgetId: string | undefined

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js'

const loadScript = (): Promise<void> =>
  new Promise((resolve, reject) => {
    if ((window as any).turnstile) return resolve()
    const existing = document.querySelector(
      `script[src="${SCRIPT_SRC}"]`
    ) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('turnstile load failed')))
      return
    }
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('turnstile load failed'))
    document.head.appendChild(script)
  })

onMounted(async () => {
  // No site key configured => verification disabled (local/dev). Auto-pass.
  if (!siteKey) {
    emit('verified', '')
    return
  }
  try {
    await loadScript()
    const ts = (window as any).turnstile
    widgetId = ts.render(container.value, {
      sitekey: siteKey,
      theme: 'dark',
      callback: (token: string) => emit('verified', token),
      'expired-callback': () => emit('expired'),
      'error-callback': () => emit('expired'),
    })
  } catch {
    // If the widget can't load, don't lock the user out.
    emit('verified', '')
  }
})

onUnmounted(() => {
  const ts = (window as any).turnstile
  if (ts && widgetId !== undefined) {
    try {
      ts.remove(widgetId)
    } catch {
      /* ignore */
    }
  }
})

defineExpose({
  reset() {
    const ts = (window as any).turnstile
    if (ts && widgetId !== undefined) {
      try {
        ts.reset(widgetId)
      } catch {
        /* ignore */
      }
    }
  },
})
</script>

<template>
  <div v-if="siteKey" ref="container" class="flex justify-center my-4"></div>
</template>
