import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteVideoFromIndexedDb, saveVideoToIndexedDb } from './action'
import { openVideoDb, promisifyRequest } from './helper'
import { STORE_NAME } from './constant'

async function readAll() {
  const db = await openVideoDb()
  try {
    const tx = db.transaction(STORE_NAME, 'readonly')
    return await promisifyRequest(tx.objectStore(STORE_NAME).getAll())
  } finally {
    db.close()
  }
}

describe('saveVideoToIndexedDb', () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase('safein5-videos')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('persists a StoredVideo carrying the blob metadata', async () => {
    const blob = new Blob(['hello world'], { type: 'video/webm' })
    const stored = await saveVideoToIndexedDb(blob, 'clip.webm')

    expect(stored.name).toBe('clip.webm')
    expect(stored.size).toBe(blob.size)
    expect(stored.type).toBe('video/webm')
    expect(typeof stored.createdAt).toBe('number')
    expect(stored.id).toMatch(/^\d+-\d+-\d+$/)

    const rows = await readAll()
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe(stored.id)
  })

  it('throws when IndexedDB is unavailable', async () => {
    const original = globalThis.indexedDB
    globalThis.indexedDB = undefined as unknown as IDBFactory
    try {
      await expect(saveVideoToIndexedDb(new Blob(['x']), 'x.webm')).rejects.toThrow(
        'IndexedDB is not available in this browser.',
      )
    } finally {
      globalThis.indexedDB = original
    }
  })
})

describe('deleteVideoFromIndexedDb', () => {
  beforeEach(() => {
    indexedDB.deleteDatabase('safein5-videos')
  })

  it('removes a previously stored record', async () => {
    const stored = await saveVideoToIndexedDb(new Blob(['data'], { type: 'video/mp4' }), 'a.mp4')
    expect(await readAll()).toHaveLength(1)

    await deleteVideoFromIndexedDb(stored.id)
    expect(await readAll()).toHaveLength(0)
  })

  it('resolves without error when deleting an unknown id', async () => {
    await saveVideoToIndexedDb(new Blob(['data']), 'a.mp4')
    await expect(deleteVideoFromIndexedDb('does-not-exist')).resolves.toBeUndefined()
    expect(await readAll()).toHaveLength(1)
  })

  it('is a no-op when IndexedDB is unavailable', async () => {
    const original = globalThis.indexedDB
    globalThis.indexedDB = undefined as unknown as IDBFactory
    try {
      await expect(deleteVideoFromIndexedDb('anything')).resolves.toBeUndefined()
    } finally {
      globalThis.indexedDB = original
    }
  })
})
