import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/dist/',  // Добавьте эту строку!
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  server: {
    host: true,
    port: 3333,
    strictPort: true,
    allowedHosts: ['mytwit.com', 'localhost', '127.0.0.1'],
    proxy: {
      '/api': {
        target: 'http://mytwit.com',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
})
