import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const stripUnselectedAdLoader = (isCrazyGamesBuild) => ({
  name: 'strip-unselected-ad-loader',
  transformIndexHtml(html) {
    const loaderId = isCrazyGamesBuild ? 'dyut-google-h5-ads-loader' : 'dyut-crazygames-sdk-loader';
    return html.replace(new RegExp(`\\s*<script id="${loaderId}">[\\s\\S]*?<\\/script>\\s*`, 'g'), '\n');
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isCrazyGamesBuild = process.env.VITE_CRAZYGAMES_BUILD !== undefined
    ? process.env.VITE_CRAZYGAMES_BUILD === 'true'
    : env.VITE_CRAZYGAMES_BUILD === 'true';

  return {
    plugins: [react(), stripUnselectedAdLoader(isCrazyGamesBuild)],
    base: mode === 'crazygames' ? './' : '/',
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined
            // Firebase's modular packages have internal circular imports (for
            // example app <-> util/component). Splitting those internals into
            // firebase-core and firebase-shared creates a cross-chunk TDZ
            // failure in browsers serving the production bundle. Keep the
            // Firebase graph together and only split unrelated vendor groups.
            if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) return 'firebase'
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
