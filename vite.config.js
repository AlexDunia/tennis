import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// GitHub Pages config for repo: tennis
export default defineConfig({
  plugins: [vue()],
  base: '/tennis/', // 👈 MUST match your repo name exactly
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
