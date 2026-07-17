import { DB_NAME, DB_VERSION, STORE_NAME } from './constant'
import type { StoredVideo } from './model'

export function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

export function openVideoDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
  })
}

export function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

export function awaitTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
  })
}

export function makeVideoId(size: number): string {
  return `${Date.now()}-${size}-${Math.round(Math.random() * 1e9)}`
}

export function pickIdsToEvict(
  videos: Pick<StoredVideo, 'id' | 'createdAt'>[],
  limit: number,
): string[] {
  if (videos.length <= limit) return []
  return [...videos]
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, videos.length - limit)
    .map((video) => video.id)
}
