import { notifyUploadPending } from '@/components/feature/VideoUploader/helper'
import {
  DEFAULT_CHUNK_SIZE,
  MAX_STORED_VIDEOS,
  STORE_NAME,
  UPLOAD_SESSIONS_STORE_NAME,
} from './constant'
import {
  awaitTransaction,
  buildChunks,
  clampChunkSize,
  isIndexedDbAvailable,
  makeVideoId,
  openVideoDb,
  pickIdsToEvict,
  promisifyRequest,
} from './helper'
import type { StoredVideo, UploadSession } from './model'

export async function saveVideoToIndexedDb(blob: Blob, name: string): Promise<StoredVideo> {
  if (!isIndexedDbAvailable()) {
    throw new Error('IndexedDB is not available in this browser.')
  }

  const record: StoredVideo = {
    id: makeVideoId(blob.size),
    blob,
    name,
    size: blob.size,
    type: blob.type,
    createdAt: Date.now(),
  }

  const db = await openVideoDb()
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    await promisifyRequest(store.put(record))
    const all = await promisifyRequest(store.getAll() as IDBRequest<StoredVideo[]>)
    for (const id of pickIdsToEvict(all, MAX_STORED_VIDEOS)) {
      await promisifyRequest(store.delete(id))
    }
    await awaitTransaction(tx)
    return record
  } finally {
    db.close()
  }
}

export async function listVideosFromIndexedDb(): Promise<StoredVideo[]> {
  if (!isIndexedDbAvailable()) return []

  const db = await openVideoDb()
  try {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const all = await promisifyRequest(
      tx.objectStore(STORE_NAME).getAll() as IDBRequest<StoredVideo[]>,
    )
    return all
  } finally {
    db.close()
  }
}

export async function deleteVideoFromIndexedDb(id: string): Promise<void> {
  if (!isIndexedDbAvailable()) return

  const db = await openVideoDb()
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    await promisifyRequest(tx.objectStore(STORE_NAME).delete(id))
    await awaitTransaction(tx)
  } finally {
    db.close()
  }
}

export async function saveUploadSession(session: UploadSession): Promise<void> {
  if (!isIndexedDbAvailable()) return

  const db = await openVideoDb()
  try {
    const tx = db.transaction(UPLOAD_SESSIONS_STORE_NAME, 'readwrite')
    await promisifyRequest(tx.objectStore(UPLOAD_SESSIONS_STORE_NAME).put(session))
    await awaitTransaction(tx)
  } finally {
    db.close()
  }
}

export async function getUploadSession(id: string): Promise<UploadSession | undefined> {
  if (!isIndexedDbAvailable()) return undefined

  const db = await openVideoDb()
  try {
    const tx = db.transaction(UPLOAD_SESSIONS_STORE_NAME, 'readonly')
    return await promisifyRequest(
      tx.objectStore(UPLOAD_SESSIONS_STORE_NAME).get(id) as IDBRequest<UploadSession | undefined>,
    )
  } finally {
    db.close()
  }
}

export async function deleteUploadSession(id: string): Promise<void> {
  if (!isIndexedDbAvailable()) return

  const db = await openVideoDb()
  try {
    const tx = db.transaction(UPLOAD_SESSIONS_STORE_NAME, 'readwrite')
    await promisifyRequest(tx.objectStore(UPLOAD_SESSIONS_STORE_NAME).delete(id))
    await awaitTransaction(tx)
  } finally {
    db.close()
  }
}

export async function listPendingUploadSessions(): Promise<UploadSession[]> {
  if (!isIndexedDbAvailable()) return []

  const db = await openVideoDb()
  try {
    const tx = db.transaction(UPLOAD_SESSIONS_STORE_NAME, 'readonly')
    const all = await promisifyRequest(
      tx.objectStore(UPLOAD_SESSIONS_STORE_NAME).getAll() as IDBRequest<UploadSession[]>,
    )
    return all.filter((session) => session.status !== 'completed')
  } finally {
    db.close()
  }
}

export async function saveVideoAndQueueUpload(blob: Blob, name: string): Promise<StoredVideo> {
  const stored = await saveVideoToIndexedDb(blob, name)

  const chunkSize = clampChunkSize(DEFAULT_CHUNK_SIZE, stored.size)
  const chunks = buildChunks(stored.size, chunkSize)
  const now = Date.now()
  const session: UploadSession = {
    id: stored.id,
    filename: stored.name,
    mime: stored.type,
    size: stored.size,
    chunkSize,
    chunkCount: chunks.length,
    chunks,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  }
  await saveUploadSession(session)
  notifyUploadPending()

  return stored
}
