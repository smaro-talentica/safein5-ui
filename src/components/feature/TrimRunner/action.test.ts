import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TrimJob } from '@/pages/worker/Capture/model'

const deleteTrimJob = vi.fn()
const saveTrimJob = vi.fn()
const saveVideoAndQueueUpload = vi.fn()

vi.mock('@/pages/worker/Capture/action', () => ({
  deleteTrimJob: (...args: unknown[]) => deleteTrimJob(...args),
  saveTrimJob: (...args: unknown[]) => saveTrimJob(...args),
  saveVideoAndQueueUpload: (...args: unknown[]) => saveVideoAndQueueUpload(...args),
}))

const recordTrimmedRange = vi.fn()

vi.mock('@/components/feature/VideoTrimmer/helper', () => ({
  recordTrimmedRange: (...args: unknown[]) => recordTrimmedRange(...args),
}))

import { runTrimJob } from './action'

function makeJob(overrides: Partial<TrimJob> = {}): TrimJob {
  const now = Date.now()
  return {
    id: 'job-1',
    sourceBlob: new Blob(['source']),
    name: 'trimmed-1.webm',
    range: { start: 1, end: 5 },
    status: 'processing',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('runTrimJob', () => {
  beforeEach(() => {
    deleteTrimJob.mockClear()
    saveTrimJob.mockClear()
    saveVideoAndQueueUpload.mockClear()
    recordTrimmedRange.mockClear()
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('trims, saves the video, queues its upload, and removes the job on success', async () => {
    const job = makeJob()
    const trimmedBlob = new Blob(['trimmed'])
    recordTrimmedRange.mockResolvedValue(trimmedBlob)

    const videoElement = document.createElement('video')
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValueOnce(videoElement)
    queueMicrotask(() => videoElement.onloadeddata?.(new Event('loadeddata')))

    await runTrimJob(job)

    expect(recordTrimmedRange).toHaveBeenCalledWith(videoElement, job.sourceBlob, job.range)
    expect(saveVideoAndQueueUpload).toHaveBeenCalledWith(trimmedBlob, job.name)
    expect(deleteTrimJob).toHaveBeenCalledWith(job.id)
    expect(saveTrimJob).not.toHaveBeenCalled()

    createElementSpy.mockRestore()
  })

  it('marks the job as errored and rethrows when trimming fails', async () => {
    const job = makeJob()
    recordTrimmedRange.mockRejectedValue(new Error('boom'))

    const videoElement = document.createElement('video')
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValueOnce(videoElement)
    queueMicrotask(() => videoElement.onloadeddata?.(new Event('loadeddata')))

    await expect(runTrimJob(job)).rejects.toThrow('boom')

    expect(saveTrimJob).toHaveBeenCalledWith(
      expect.objectContaining({ id: job.id, status: 'error', error: 'boom' }),
    )
    expect(saveVideoAndQueueUpload).not.toHaveBeenCalled()
    expect(deleteTrimJob).not.toHaveBeenCalled()

    createElementSpy.mockRestore()
  })
})
