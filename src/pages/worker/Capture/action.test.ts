import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deleteTrimJob,
  deleteUploadSession,
  deleteVideoFromIndexedDb,
  getUploadSession,
  listPendingUploadSessions,
  listTrimJobs,
  queueTrimJob,
  saveTrimJob,
  saveUploadSession,
  saveVideoToIndexedDb,
} from './action'
import { openVideoDb, promisifyRequest } from './helper'
import { STORE_NAME } from './constant'
import type { TrimJob, UploadSession } from './model'

function makeSession(overrides: Partial<UploadSession> = {}): UploadSession {
  const now = Date.now()
  return {
    id: 'video-1',
    filename: 'clip.webm',
    mime: 'video/webm',
    size: 100,
    chunkSize: 50,
    chunkCount: 2,
    chunks: [
      { chunkNumber: 1, start: 0, end: 50, status: 'pending' },
      { chunkNumber: 2, start: 50, end: 100, status: 'pending' },
    ],
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

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

describe('upload session CRUD', () => {
  beforeEach(() => {
    indexedDB.deleteDatabase('safein5-videos')
  })

  it('saves and retrieves an upload session by id', async () => {
    const session = makeSession()
    await saveUploadSession(session)

    const found = await getUploadSession(session.id)
    expect(found).toEqual(session)
  })

  it('returns undefined for an unknown session id', async () => {
    await expect(getUploadSession('missing')).resolves.toBeUndefined()
  })

  it('deletes a previously saved session', async () => {
    const session = makeSession()
    await saveUploadSession(session)

    await deleteUploadSession(session.id)
    await expect(getUploadSession(session.id)).resolves.toBeUndefined()
  })

  it('lists only sessions that are not completed', async () => {
    await saveUploadSession(makeSession({ id: 'a', status: 'pending' }))
    await saveUploadSession(makeSession({ id: 'b', status: 'uploading' }))
    await saveUploadSession(makeSession({ id: 'c', status: 'completed' }))

    const pending = await listPendingUploadSessions()
    expect(pending.map((s) => s.id).sort()).toEqual(['a', 'b'])
  })

  it('upload-session helpers are no-ops/undefined when IndexedDB is unavailable', async () => {
    const original = globalThis.indexedDB
    globalThis.indexedDB = undefined as unknown as IDBFactory
    try {
      await expect(saveUploadSession(makeSession())).resolves.toBeUndefined()
      await expect(getUploadSession('x')).resolves.toBeUndefined()
      await expect(deleteUploadSession('x')).resolves.toBeUndefined()
      await expect(listPendingUploadSessions()).resolves.toEqual([])
    } finally {
      globalThis.indexedDB = original
    }
  })
})

function makeTrimJob(overrides: Partial<TrimJob> = {}): TrimJob {
  const now = Date.now()
  return {
    id: 'job-1',
    sourceBlob: new Blob(['source'], { type: 'video/webm' }),
    name: 'trimmed-1.webm',
    range: { start: 1, end: 5 },
    status: 'processing',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('trim job CRUD', () => {
  beforeEach(() => {
    indexedDB.deleteDatabase('safein5-videos')
  })

  it('saves and lists a trim job', async () => {
    const job = makeTrimJob()
    await saveTrimJob(job)

    const jobs = await listTrimJobs()
    expect(jobs).toHaveLength(1)
    expect(jobs[0].id).toBe(job.id)
    expect(jobs[0].status).toBe('processing')
  })

  it('deletes a previously saved trim job', async () => {
    const job = makeTrimJob()
    await saveTrimJob(job)
    expect(await listTrimJobs()).toHaveLength(1)

    await deleteTrimJob(job.id)
    expect(await listTrimJobs()).toHaveLength(0)
  })

  it('resolves without error when deleting an unknown trim job id', async () => {
    await expect(deleteTrimJob('does-not-exist')).resolves.toBeUndefined()
  })

  it('trim-job helpers are no-ops/empty when IndexedDB is unavailable', async () => {
    const original = globalThis.indexedDB
    globalThis.indexedDB = undefined as unknown as IDBFactory
    try {
      await expect(saveTrimJob(makeTrimJob())).resolves.toBeUndefined()
      await expect(deleteTrimJob('x')).resolves.toBeUndefined()
      await expect(listTrimJobs()).resolves.toEqual([])
    } finally {
      globalThis.indexedDB = original
    }
  })
})

describe('queueTrimJob', () => {
  beforeEach(() => {
    indexedDB.deleteDatabase('safein5-videos')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('saves a processing trim job carrying the source blob, name, and range', async () => {
    const sourceBlob = new Blob(['source'], { type: 'video/webm' })
    const stored = await queueTrimJob(sourceBlob, 'trimmed-1.webm', { start: 2, end: 8 })

    expect(stored.status).toBe('processing')
    expect(stored.name).toBe('trimmed-1.webm')
    expect(stored.range).toEqual({ start: 2, end: 8 })
    expect(stored.id).toMatch(/^\d+-\d+-\d+$/)

    const jobs = await listTrimJobs()
    expect(jobs).toHaveLength(1)
    expect(jobs[0].id).toBe(stored.id)
  })

  it('throws when IndexedDB is unavailable', async () => {
    const original = globalThis.indexedDB
    globalThis.indexedDB = undefined as unknown as IDBFactory
    try {
      await expect(queueTrimJob(new Blob(['x']), 'x.webm', { start: 0, end: 1 })).rejects.toThrow(
        'IndexedDB is not available in this browser.',
      )
    } finally {
      globalThis.indexedDB = original
    }
  })
})
