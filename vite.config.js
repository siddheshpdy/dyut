import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const stripUnselectedAdLoader = (isCrazyGamesBuild, adsEnabled) => ({
  name: 'strip-unselected-ad-loader',
  transformIndexHtml(html) {
    const loaderId = isCrazyGamesBuild ? 'dyut-google-h5-ads-loader' : 'dyut-crazygames-sdk-loader';
    return html
      .replaceAll('__DYUT_CRAZYGAMES_BUILD__', String(isCrazyGamesBuild))
      .replaceAll('__DYUT_CG_ENABLE_ADS__', String(adsEnabled))
      .replace(new RegExp(`\\s*<script id="${loaderId}">[\\s\\S]*?<\\/script>\\s*`, 'g'), '\n');
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isCrazyGamesBuild = process.env.VITE_CRAZYGAMES_BUILD !== undefined
    ? process.env.VITE_CRAZYGAMES_BUILD === 'true'
    : env.VITE_CRAZYGAMES_BUILD === 'true';
  const adsEnabled = env.VITE_CG_ENABLE_ADS === 'true';

  return {
    plugins: [react(), stripUnselectedAdLoader(isCrazyGamesBuild, adsEnabled)],
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
  };
})
