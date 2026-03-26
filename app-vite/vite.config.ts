import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
  server: {
    proxy: {
      // /nocodb-proxy/* → https://odtable.ptmind.ai/*
      // ブラウザの CORS を回避するために Vite dev server 経由でリクエストを転送
      '/nocodb-proxy': {
        target: 'https://odtable.ptmind.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/nocodb-proxy/, ''),
      },
    },
  },
})
