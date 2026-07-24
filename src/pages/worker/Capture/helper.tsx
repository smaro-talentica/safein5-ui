import {
  CHUNK_RETRY_BASE_DELAY_MS,
  DB_NAME,
  DB_VERSION,
  MIN_CHUNK_SIZE,
  STORE_NAME,
  UPLOAD_SESSIONS_STORE_NAME,
} from './constant'
import type { StoredVideo, UploadChunk } from './model'

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
      if (!db.objectStoreNames.contains(UPLOAD_SESSIONS_STORE_NAME)) {
        db.createObjectStore(UPLOAD_SESSIONS_STORE_NAME, { keyPath: 'id' })
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

/**
 * Split `size` bytes into chunk descriptors of `chunkSize` bytes each.
 * S3 multipart rules: every chunk except the last must be >= 5 MiB, max 10,000 chunks.
 * A size smaller than one chunk becomes a single chunk, which is valid. Chunk numbers
 * are 1-based (S3 requirement).
 */
export function buildChunks(size: number, chunkSize: number): UploadChunk[] {
  if (size <= 0) return []
  if (chunkSize <= 0) throw new Error('chunkSize must be > 0')

  const chunks: UploadChunk[] = []
  let start = 0
  let chunkNumber = 1
  while (start < size) {
    const end = Math.min(start + chunkSize, size)
    chunks.push({ chunkNumber, start, end, status: 'pending' })
    start = end
    chunkNumber += 1
  }
  return chunks
}

/**
 * Enforces the S3 5 MB floor for non-final chunks. If `requested` would produce more
 * than one chunk smaller than MIN_CHUNK_SIZE, fall back to a single chunk covering the
 * whole file.
 */
export function clampChunkSize(requested: number, size: number): number {
  if (size <= MIN_CHUNK_SIZE || requested >= size) return size
  return Math.max(requested, MIN_CHUNK_SIZE)
}

export function nextRetryDelay(attempt: number): number {
  return CHUNK_RETRY_BASE_DELAY_MS * 2 ** attempt
}
