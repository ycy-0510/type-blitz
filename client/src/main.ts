import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import { loadQuotes } from './quotes'

// Fetch the typing passages (/quotes.json) before mounting so components can use
// the `quotes` array synchronously.
loadQuotes().finally(() => {
  createApp(App).use(router).mount('#app')
})
