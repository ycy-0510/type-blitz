import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { execSync } from 'node:child_process'

// Build id, format YYMMDD.NN (NN = number of commits on that day). Derived from
// git so a given commit always produces the same id — and CI passes the very
// same value to the server image, so client and server agree. Honour an explicit
// VITE_BUILD (set by CI/Docker, where .git isn't in the build context); otherwise
// compute it from the local repo, falling back to today's date for non-git builds.
function buildId(): string {
  if (process.env.VITE_BUILD) return process.env.VITE_BUILD
  try {
    const day = execSync('git show -s --format=%cd --date=format:%y%m%d HEAD').toString().trim()
    const full = execSync('git show -s --format=%cd --date=format:%Y-%m-%d HEAD').toString().trim()
    const n = execSync('git log --pretty=%cd --date=format:%Y-%m-%d').toString().trim()
      .split('\n').filter((d) => d === full).length
    return `${day}.${String(n).padStart(2, '0')}`
  } catch {
    const d = new Date()
    const day = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
    return `${day}.00` // .00 = local/unstamped build (no git history available)
  }
}

// Expose to the client bundle via import.meta.env.VITE_BUILD (Vite inlines VITE_*).
process.env.VITE_BUILD = buildId()

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      // Forward Socket.IO (WebSocket + polling) to the backend during dev,
      // so the client connects same-origin just like it does in production.
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
