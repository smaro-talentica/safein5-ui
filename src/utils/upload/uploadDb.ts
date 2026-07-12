/**
 * IndexedDB persistence for upload jobs.
 *
 * Jobs (including the raw video Blob) are stored here so that an upload can be
 * resumed after the app is closed and reopened — the single source of truth for
 * the resume-on-open behavior. Per-part ETags are persisted as each part lands,
 * so a completed part is never re-uploaded.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { UploadJob } from './types'

const DB_NAME = 'safein5-uploads'
const DB_VERSION = 1
const STORE = 'jobs'

interface UploadDbSchema extends DBSchema {
  jobs: {
    key: string
    value: UploadJob
    indexes: { 'by-status': string }
  }
}

let dbPromise: Promise<IDBPDatabase<UploadDbSchema>> | null = null

function getDb(): Promise<IDBPDatabase<UploadDbSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<UploadDbSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('by-status', 'status')
      },
    })
  }
  return dbPromise
}

export async function putJob(job: UploadJob): Promise<void> {
  const db = await getDb()
  await db.put(STORE, { ...job, updatedAt: Date.now() })
}

export async function getJob(id: string): Promise<UploadJob | undefined> {
  const db = await getDb()
  return db.get(STORE, id)
}

export async function getAllJobs(): Promise<UploadJob[]> {
  const db = await getDb()
  const jobs = await db.getAll(STORE)
  return jobs.sort((a, b) => a.createdAt - b.createdAt)
}

/** Jobs that should be resumed automatically on app open. */
export async function getResumableJobs(): Promise<UploadJob[]> {
  const jobs = await getAllJobs()
  return jobs.filter(
    (j) => j.status === 'uploading' || j.status === 'paused' || j.status === 'completing',
  )
}

export async function deleteJob(id: string): Promise<void> {
  const db = await getDb()
  await db.delete(STORE, id)
}

/** For tests. */
export async function clearAllJobs(): Promise<void> {
  const db = await getDb()
  await db.clear(STORE)
}
