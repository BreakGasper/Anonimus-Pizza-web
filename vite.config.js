import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Firebase Hosting sirve desde la raíz del dominio, así que base = '/'.
export default defineConfig({
  plugins: [vue()],
  base: '/',
  build: { outDir: 'dist', sourcemap: false },
})
