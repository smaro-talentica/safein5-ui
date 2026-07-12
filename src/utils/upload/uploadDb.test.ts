import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearAllJobs, deleteJob, getJob, getResumableJobs, putJob } from './uploadDb'
import { buildParts } from './chunk'
import type { UploadJob, UploadJobStatus } from './types'

function makeJob(id: string, status: UploadJobStatus): UploadJob {
  const size = 14 * 1024 * 1024
  const partSize = 6 * 1024 * 1024
  return {
    id,
    blob: new Blob([new Uint8Array(8)], { type: 'video/mp4' }),
    filename: `${id}.mp4`,
    mime: 'video/mp4',
    size,
    durationSec: 12,
    partSize,
    parts: buildParts(size, partSize),
    status,
    createdAt: 1,
    updatedAt: 1,
  }
}

describe('uploadDb', () => {
  beforeEach(async () => {
    await clearAllJobs()
  })

  it('persists and reads back a job (including the blob)', async () => {
    await putJob(makeJob('a', 'uploading'))
    const read = await getJob('a')
    expect(read?.id).toBe('a')
    // The blob field round-trips (fake-indexeddb's structured clone doesn't
    // rehydrate jsdom Blobs as real Blob instances, so we only assert presence;
    // real browsers store Blobs natively).
    expect(read?.blob).toBeDefined()
    expect(read?.parts).toHaveLength(3)
  })

  it('returns only resumable jobs for auto-resume on open', async () => {
    await putJob(makeJob('uploading', 'uploading'))
    await putJob(makeJob('paused', 'paused'))
    await putJob(makeJob('completing', 'completing'))
    await putJob(makeJob('completed', 'completed'))
    await putJob(makeJob('error', 'error'))
    await putJob(makeJob('queued', 'queued'))

    const resumable = await getResumableJobs()
    expect(resumable.map((j) => j.id).sort()).toEqual(['completing', 'paused', 'uploading'])
  })

  it('preserves per-part ETags across a save/load cycle (resume never re-uploads done parts)', async () => {
    const job = makeJob('etags', 'paused')
    job.parts[0].status = 'done'
    job.parts[0].eTag = '"abc"'
    await putJob(job)

    const read = await getJob('etags')
    expect(read?.parts[0].status).toBe('done')
    expect(read?.parts[0].eTag).toBe('"abc"')
    expect(read?.parts[1].status).toBe('pending')
  })

  it('deletes a job', async () => {
    await putJob(makeJob('gone', 'uploading'))
    await deleteJob('gone')
    expect(await getJob('gone')).toBeUndefined()
  })
})
