import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'crazygames' ? './' : '/',
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
  },
  esbuild: {
    // Automatically drop console.logs and debuggers in the minified production build
    drop: ['console', 'debugger'],
  },
}))