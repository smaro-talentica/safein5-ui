import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import checker from 'vite-plugin-checker'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import mkcert from 'vite-plugin-mkcert'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    command === 'serve' ? mkcert() : null,
    react(),
    tailwindcss(),
    checker({ typescript: true }),
    VitePWA({
      registerType: 'autoUpdate',
      // Custom SW (src/sw.ts) so we can add Background Fetch upload handling
      // on top of Workbox precaching.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'Fast in 5',
        short_name: 'Fast in 5',
        description: 'Fast in 5 PWA',
        theme_color: '#e0f2fe',
        background_color: '#e0f2fe',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      // Run the service worker + manifest in `npm run dev` too, so PWA
      // installability can be tested without a production build. `type: 'module'`
      // matches our TS service worker. Without this, vite-plugin-pwa disables the
      // SW in dev and the browser never treats the app as installable.
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
}))
