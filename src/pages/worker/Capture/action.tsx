import { notifyUploadPending } from '@/components/feature/VideoUploader/helper'
import { notifyAudioUploadPending } from '@/components/feature/AudioUploader/helper'
import {
  AUDIO_STORE_NAME,
  AUDIO_UPLOAD_RECORDS_STORE_NAME,
  DEFAULT_CHUNK_SIZE,
  MAX_STORED_AUDIO,
  MAX_STORED_TEXT_ENTRIES,
  MAX_STORED_VIDEOS,
  STORE_NAME,
  TEXT_ENTRIES_STORE_NAME,
  UPLOAD_SESSIONS_STORE_NAME,
} from './constant'
import {
  awaitTransaction,
  buildChunks,
  clampChunkSize,
  isIndexedDbAvailable,
  makeAudioId,
  makeTextEntryId,
  makeVideoId,
  openVideoDb,
  pickIdsToEvict,
  promisifyRequest,
} from './helper'
import type {
  AudioUploadRecord,
  StoredAudio,
  StoredTextEntry,
  StoredVideo,
  UploadSession,
} from './model'

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

export async function saveAudioToIndexedDb(blob: Blob, name: string): Promise<StoredAudio> {
  if (!isIndexedDbAvailable()) {
    throw new Error('IndexedDB is not available in this browser.')
  }

  const record: StoredAudio = {
    id: makeAudioId(blob.size),
    blob,
    name,
    size: blob.size,
    type: blob.type,
    createdAt: Date.now(),
  }

  const db = await openVideoDb()
  try {
    const tx = db.transaction(AUDIO_STORE_NAME, 'readwrite')
    const store = tx.objectStore(AUDIO_STORE_NAME)
    await promisifyRequest(store.put(record))
    const all = await promisifyRequest(store.getAll() as IDBRequest<StoredAudio[]>)
    for (const id of pickIdsToEvict(all, MAX_STORED_AUDIO)) {
      await promisifyRequest(store.delete(id))
    }
    await awaitTransaction(tx)
    return record
  } finally {
    db.close()
  }
}

export async function listAudioFromIndexedDb(): Promise<StoredAudio[]> {
  if (!isIndexedDbAvailable()) return []

  const db = await openVideoDb()
  try {
    const tx = db.transaction(AUDIO_STORE_NAME, 'readonly')
    return await promisifyRequest(
      tx.objectStore(AUDIO_STORE_NAME).getAll() as IDBRequest<StoredAudio[]>,
    )
  } finally {
    db.close()
  }
}

export async function deleteAudioFromIndexedDb(id: string): Promise<void> {
  if (!isIndexedDbAvailable()) return

  const db = await openVideoDb()
  try {
    const tx = db.transaction(AUDIO_STORE_NAME, 'readwrite')
    await promisifyRequest(tx.objectStore(AUDIO_STORE_NAME).delete(id))
    await awaitTransaction(tx)
  } finally {
    db.close()
  }
}

export async function saveAudioUploadRecord(record: AudioUploadRecord): Promise<void> {
  if (!isIndexedDbAvailable()) return

  const db = await openVideoDb()
  try {
    const tx = db.transaction(AUDIO_UPLOAD_RECORDS_STORE_NAME, 'readwrite')
    await promisifyRequest(tx.objectStore(AUDIO_UPLOAD_RECORDS_STORE_NAME).put(record))
    await awaitTransaction(tx)
  } finally {
    db.close()
  }
}

export async function getAudioUploadRecord(id: string): Promise<AudioUploadRecord | undefined> {
  if (!isIndexedDbAvailable()) return undefined

  const db = await openVideoDb()
  try {
    const tx = db.transaction(AUDIO_UPLOAD_RECORDS_STORE_NAME, 'readonly')
    return await promisifyRequest(
      tx.objectStore(AUDIO_UPLOAD_RECORDS_STORE_NAME).get(id) as IDBRequest<
        AudioUploadRecord | undefined
      >,
    )
  } finally {
    db.close()
  }
}

export async function deleteAudioUploadRecord(id: string): Promise<void> {
  if (!isIndexedDbAvailable()) return

  const db = await openVideoDb()
  try {
    const tx = db.transaction(AUDIO_UPLOAD_RECORDS_STORE_NAME, 'readwrite')
    await promisifyRequest(tx.objectStore(AUDIO_UPLOAD_RECORDS_STORE_NAME).delete(id))
    await awaitTransaction(tx)
  } finally {
    db.close()
  }
}

export async function listPendingAudioUploadRecords(): Promise<AudioUploadRecord[]> {
  if (!isIndexedDbAvailable()) return []

  const db = await openVideoDb()
  try {
    const tx = db.transaction(AUDIO_UPLOAD_RECORDS_STORE_NAME, 'readonly')
    const all = await promisifyRequest(
      tx.objectStore(AUDIO_UPLOAD_RECORDS_STORE_NAME).getAll() as IDBRequest<AudioUploadRecord[]>,
    )
    return all.filter((record) => record.status !== 'completed')
  } finally {
    db.close()
  }
}

export async function saveAudioAndQueueUpload(blob: Blob, name: string): Promise<StoredAudio> {
  const stored = await saveAudioToIndexedDb(blob, name)

  const now = Date.now()
  const record: AudioUploadRecord = {
    id: stored.id,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  }
  await saveAudioUploadRecord(record)
  notifyAudioUploadPending()

  return stored
}

/**
 * Saves a Capture "Text" tab entry (written directly, or confirmed from a transcribed voice
 * memo — the source audio is never passed in here, only the resulting text). Local-only for
 * now: no S3 upload, no backend call, no background uploader — see StoredTextEntry's doc comment.
 */
export async function saveTextEntry(
  text: string,
  source: StoredTextEntry['source'],
): Promise<StoredTextEntry> {
  if (!isIndexedDbAvailable()) {
    throw new Error('IndexedDB is not available in this browser.')
  }

  const record: StoredTextEntry = {
    id: makeTextEntryId(),
    text,
    source,
    createdAt: Date.now(),
  }

  const db = await openVideoDb()
  try {
    const tx = db.transaction(TEXT_ENTRIES_STORE_NAME, 'readwrite')
    const store = tx.objectStore(TEXT_ENTRIES_STORE_NAME)
    await promisifyRequest(store.put(record))
    const all = await promisifyRequest(store.getAll() as IDBRequest<StoredTextEntry[]>)
    for (const id of pickIdsToEvict(all, MAX_STORED_TEXT_ENTRIES)) {
      await promisifyRequest(store.delete(id))
    }
    await awaitTransaction(tx)
    return record
  } finally {
    db.close()
  }
}

export async function listTextEntriesFromIndexedDb(): Promise<StoredTextEntry[]> {
  if (!isIndexedDbAvailable()) return []

  const db = await openVideoDb()
  try {
    const tx = db.transaction(TEXT_ENTRIES_STORE_NAME, 'readonly')
    return await promisifyRequest(
      tx.objectStore(TEXT_ENTRIES_STORE_NAME).getAll() as IDBRequest<StoredTextEntry[]>,
    )
  } finally {
    db.close()
  }
}

export async function deleteTextEntryFromIndexedDb(id: string): Promise<void> {
  if (!isIndexedDbAvailable()) return

  const db = await openVideoDb()
  try {
    const tx = db.transaction(TEXT_ENTRIES_STORE_NAME, 'readwrite')
    await promisifyRequest(tx.objectStore(TEXT_ENTRIES_STORE_NAME).delete(id))
    await awaitTransaction(tx)
  } finally {
    db.close()
  }
}
