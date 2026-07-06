/// <reference lib="webworker" />
/**
 * Custom service worker (injectManifest mode).
 *
 * Two jobs:
 *  1. Precache the app shell (Workbox manifest injected at build time).
 *  2. Continue video-part uploads while the PWA is closed, using the
 *     Background Fetch API where available (Chrome/Android). iOS Safari does
 *     not support Background Fetch or background JS at all — there, uploads
 *     resume when the app is reopened (handled by the in-page upload manager).
 *
 * Background Fetch limitation: the SW cannot run our full orchestration
 * (re-presigning expired URLs, calling /uploads/complete) mid-flight. It uploads
 * the parts whose presigned URLs are still valid and records their success in
 * IndexedDB. When the app is reopened, the upload manager reconciles state and
 * runs the final /uploads/complete step.
 */
import { precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

// --- Background Fetch (Chrome/Android) -------------------------------------
// These events only fire on browsers that support Background Fetch. The record
// id is the upload job id; the request URLs are the presigned S3 part PUTs.

interface BackgroundFetchEvent extends ExtendableEvent {
  readonly registration: {
    readonly id: string
    matchAll: () => Promise<
      Array<{ readonly request: Request; responseReady: Promise<Response | undefined> }>
    >
  }
  updateUI?: (options: { title?: string }) => Promise<void>
}

async function markPartsUploaded(jobId: string, urls: string[]): Promise<void> {
  // Open the same DB the app uses and flag parts (matched by presigned URL) as
  // done. ETags aren't readable from Background Fetch responses, so the manager
  // will verify/complete on reopen. We store the URL set that succeeded.
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('safein5-uploads', 1)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('jobs', 'readwrite')
    const store = tx.objectStore('jobs')
    const getReq = store.get(jobId)
    getReq.onsuccess = () => {
      const job = getReq.result
      if (job) {
        const done = new Set(urls)
        for (const part of job.parts) {
          if (part.url && done.has(part.url)) {
            part.status = 'done'
            part.bgUploaded = true
          }
        }
        job.updatedAt = Date.now()
        store.put(job)
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

self.addEventListener('backgroundfetchsuccess', (event: Event) => {
  const bgEvent = event as BackgroundFetchEvent
  bgEvent.waitUntil(
    (async () => {
      const records = await bgEvent.registration.matchAll()
      const succeeded: string[] = []
      for (const rec of records) {
        const res = await rec.responseReady
        if (res && res.ok) succeeded.push(rec.request.url)
      }
      await markPartsUploaded(bgEvent.registration.id, succeeded)
      await bgEvent.updateUI?.({ title: 'Video uploaded' })
      // Nudge any open clients to run the completion step.
      const clients = await self.clients.matchAll()
      for (const client of clients) client.postMessage({ type: 'bg-upload-progress' })
    })(),
  )
})

self.addEventListener('backgroundfetchfail', (event: Event) => {
  const bgEvent = event as BackgroundFetchEvent
  bgEvent.waitUntil(
    (async () => {
      const records = await bgEvent.registration.matchAll()
      const succeeded: string[] = []
      for (const rec of records) {
        const res = await rec.responseReady
        if (res && res.ok) succeeded.push(rec.request.url)
      }
      // Persist whatever parts did succeed so reopen resumes from there.
      await markPartsUploaded(bgEvent.registration.id, succeeded)
    })(),
  )
})

// Allow the app to trigger an immediate SW update.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
