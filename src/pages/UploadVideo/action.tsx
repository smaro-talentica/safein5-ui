import { MAX_STORED_VIDEOS, STORE_NAME } from './constant'
import {
  awaitTransaction,
  isIndexedDbAvailable,
  makeVideoId,
  openVideoDb,
  pickIdsToEvict,
  promisifyRequest,
} from './helper'
import type { StoredVideo } from './model'

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
