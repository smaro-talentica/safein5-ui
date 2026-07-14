/// <reference lib="webworker" />
/**
 * Custom service worker (injectManifest mode).
 *
 * Precaches the app shell (Workbox manifest injected at build time) so the PWA
 * is installable and works offline. Kept as a custom SW (rather than the
 * generated one) so app-specific behavior can be added here later.
 */
import { precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

// Allow the app to trigger an immediate SW update.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
