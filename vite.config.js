import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'crazygames' ? './' : '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('node_modules/firebase/auth') || id.includes('node_modules/@firebase/auth')) return 'firebase-auth'
          if (id.includes('node_modules/firebase/firestore') || id.includes('node_modules/@firebase/firestore')) return 'firebase-firestore'
          if (id.includes('node_modules/firebase/database') || id.includes('node_modules/@firebase/database')) return 'firebase-rtdb'
          if (id.includes('node_modules/firebase/app') || id.includes('node_modules/@firebase/app')) return 'firebase-core'
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) return 'firebase-shared'
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'react-vendor'
          if (id.includes('node_modules/i18next')) return 'i18n'
          if (id.includes('node_modules/lucide-react')) return 'icons'
          return 'vendor'
        },
      },
    },
  },
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
