import { STORE_NAME } from './constant'
import {
  awaitTransaction,
  isIndexedDbAvailable,
  makeVideoId,
  openVideoDb,
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
    await promisifyRequest(tx.objectStore(STORE_NAME).put(record))
    await awaitTransaction(tx)
    return record
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
