import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StoredVideo, UploadSession } from '@/pages/worker/Capture/model'

const saveUploadSession = vi.fn()
const deleteUploadSession = vi.fn()
const deleteVideoFromIndexedDb = vi.fn()

vi.mock('@/pages/worker/Capture/action', () => ({
  saveUploadSession: (...args: unknown[]) => saveUploadSession(...args),
  deleteUploadSession: (...args: unknown[]) => deleteUploadSession(...args),
  deleteVideoFromIndexedDb: (...args: unknown[]) => deleteVideoFromIndexedDb(...args),
}))

vi.mock('@/auth/store', () => ({
  getToken: () => 'test-token',
}))

vi.mock('@/utils/env', () => ({
  env: { apiBaseUrl: 'https://api.test' },
}))

import { requestNextChunkUrl, runUploadSession, uploadChunkToS3 } from './action'

function makeVideo(size = 100): StoredVideo {
  return {
    id: 'video-1',
    blob: new Blob([new Uint8Array(size)]),
    name: 'clip.webm',
    size,
    type: 'video/webm',
    createdAt: Date.now(),
  }
}

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

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
}

function putResponse(eTag: string | null, ok = true) {
  const headers = new Headers()
  if (eTag) headers.set('ETag', eTag)
  return new Response(null, { status: ok ? 200 : 500, headers })
}

describe('requestNextChunkUrl', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('posts to the uploads/next endpoint with an auth header and returns the parsed body', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ sessionId: 's1', status: 'in_progress', nextChunkNumber: 1, url: 'u' }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const result = await requestNextChunkUrl({ filename: 'a' })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/uploads/next',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      }),
    )
    expect(result).toEqual({ sessionId: 's1', status: 'in_progress', nextChunkNumber: 1, url: 'u' })
  })

  it('throws when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })))
    await expect(requestNextChunkUrl({})).rejects.toThrow('status 500')
  })
})

describe('uploadChunkToS3', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the ETag header on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(putResponse('"abc"')))
    await expect(uploadChunkToS3('https://s3.test/part1', new Blob(['x']))).resolves.toBe('"abc"')
  })

  it('throws when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(putResponse(null, false)))
    await expect(uploadChunkToS3('https://s3.test/part1', new Blob(['x']))).rejects.toThrow(
      'status 500',
    )
  })

  it('throws when no ETag header is present', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(putResponse(null)))
    await expect(uploadChunkToS3('https://s3.test/part1', new Blob(['x']))).rejects.toThrow('ETag')
  })
})

describe('runUploadSession', () => {
  beforeEach(() => {
    saveUploadSession.mockClear()
    deleteUploadSession.mockClear()
    deleteVideoFromIndexedDb.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('drives the lockstep loop chunk by chunk to completion', async () => {
    const video = makeVideo()
    const session = makeSession()

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          sessionId: 'sess-1',
          status: 'in_progress',
          nextChunkNumber: 1,
          url: 'https://s3.test/1',
        }),
      )
      .mockResolvedValueOnce(putResponse('"etag-1"'))
      .mockResolvedValueOnce(
        jsonResponse({
          sessionId: 'sess-1',
          status: 'in_progress',
          nextChunkNumber: 2,
          url: 'https://s3.test/2',
        }),
      )
      .mockResolvedValueOnce(putResponse('"etag-2"'))
      .mockResolvedValueOnce(
        jsonResponse({ sessionId: 'sess-1', status: 'completed', videoId: 'vid-1' }),
      )
    vi.stubGlobal('fetch', fetchMock)

    await runUploadSession(video, session, new AbortController().signal)

    expect(fetchMock).toHaveBeenCalledTimes(5)
    expect(deleteUploadSession).toHaveBeenCalledWith('video-1')
    expect(deleteVideoFromIndexedDb).toHaveBeenCalledWith('video-1')

    const finalSave = saveUploadSession.mock.calls.at(-1)?.[0] as UploadSession
    expect(finalSave.status).toBe('completed')
  })

  it('retries a failed chunk upload with backoff before succeeding', async () => {
    vi.useFakeTimers()
    const video = makeVideo()
    const session = makeSession()

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          sessionId: 'sess-1',
          status: 'in_progress',
          nextChunkNumber: 1,
          url: 'https://s3.test/1',
        }),
      )
      .mockResolvedValueOnce(putResponse(null, false))
      .mockResolvedValueOnce(putResponse('"etag-1"'))
      .mockResolvedValueOnce(
        jsonResponse({
          sessionId: 'sess-1',
          status: 'in_progress',
          nextChunkNumber: 2,
          url: 'https://s3.test/2',
        }),
      )
      .mockResolvedValueOnce(putResponse('"etag-2"'))
      .mockResolvedValueOnce(
        jsonResponse({ sessionId: 'sess-1', status: 'completed', videoId: 'vid-1' }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const promise = runUploadSession(video, session, new AbortController().signal)
    await vi.runAllTimersAsync()
    await promise

    expect(deleteVideoFromIndexedDb).toHaveBeenCalledWith('video-1')
  })

  it('persists an error status and rethrows after exhausting retries', async () => {
    vi.useFakeTimers()
    const video = makeVideo()
    const session = makeSession()

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          sessionId: 'sess-1',
          status: 'in_progress',
          nextChunkNumber: 1,
          url: 'https://s3.test/1',
        }),
      )
      .mockResolvedValue(putResponse(null, false))
    vi.stubGlobal('fetch', fetchMock)

    const promise = runUploadSession(video, session, new AbortController().signal)
    const assertion = expect(promise).rejects.toThrow('status 500')
    await vi.runAllTimersAsync()
    await assertion

    const finalSave = saveUploadSession.mock.calls.at(-1)?.[0] as UploadSession
    expect(finalSave.status).toBe('error')
    expect(deleteVideoFromIndexedDb).not.toHaveBeenCalled()
  })

  it('discards the video and session instead of erroring when the signal is already aborted', async () => {
    const video = makeVideo()
    const session = makeSession()
    const controller = new AbortController()
    controller.abort()

    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        sessionId: 'sess-1',
        status: 'in_progress',
        nextChunkNumber: 1,
        url: 'https://s3.test/1',
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(runUploadSession(video, session, controller.signal)).resolves.toBeUndefined()

    expect(deleteUploadSession).toHaveBeenCalledWith('video-1')
    expect(deleteVideoFromIndexedDb).toHaveBeenCalledWith('video-1')
    expect(saveUploadSession.mock.calls.at(-1)?.[0].status).not.toBe('error')
  })

  it('cancels mid-loop: stops after the in-flight chunk and discards without erroring', async () => {
    const video = makeVideo()
    const session = makeSession()
    const controller = new AbortController()

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          sessionId: 'sess-1',
          status: 'in_progress',
          nextChunkNumber: 1,
          url: 'https://s3.test/1',
        }),
      )
      .mockImplementationOnce(async () => {
        controller.abort()
        return putResponse('"etag-1"')
      })
    vi.stubGlobal('fetch', fetchMock)

    await expect(runUploadSession(video, session, controller.signal)).resolves.toBeUndefined()

    // Only the init call + the one in-flight chunk PUT happen; no further /uploads/next call.
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(deleteUploadSession).toHaveBeenCalledWith('video-1')
    expect(deleteVideoFromIndexedDb).toHaveBeenCalledWith('video-1')
  })
})
