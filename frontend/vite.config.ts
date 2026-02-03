
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    rollupOptions: {
      input: {
        extension: resolve(__dirname, 'extension.html'),
        mock_app: resolve(__dirname, 'mock_app.html'),
      },
    },
    outDir: '../mock_app/static',
    emptyOutDir: true,
  },
})
