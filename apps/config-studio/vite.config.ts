import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const apiProxyTarget = process.env.CONFIG_STUDIO_API_PROXY_TARGET || 'http://127.0.0.1:3210'

export default defineConfig({
  plugins: [react()],
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
