import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import './assets/main.css'
import './assets/tournament.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

const getHashRoute = () => {
  if (typeof window === 'undefined') {
    return ''
  }

  const hashRoute = window.location.hash.slice(1)
  return hashRoute.startsWith('/') ? hashRoute : ''
}

const syncRouterWithHash = () => {
  const hashRoute = getHashRoute()
  if (!hashRoute || router.currentRoute.value.fullPath === hashRoute) {
    return
  }

  router.replace(hashRoute).catch(() => {})
}

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    window.setTimeout(syncRouterWithHash, 0)
  })
}

router.isReady().then(() => {
  syncRouterWithHash()
  app.mount('#app')
})
