import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'

const apiProxyTarget = process.env.CONFIG_STUDIO_API_PROXY_TARGET || 'http://127.0.0.1:3210'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '127.0.0.1',
    port: 5243,
    proxy: {
      '/api': apiProxyTarget,
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 4243,
  },
  build: {
    outDir: resolve(__dirname, '../../dist/config-studio'),
    emptyOutDir: true,
  },
})
