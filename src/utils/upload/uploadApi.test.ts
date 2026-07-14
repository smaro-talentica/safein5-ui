import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  abortUpload,
  completeUpload,
  initUpload,
  isRetryable,
  isUploadHttpError,
  makeUploadError,
  putPart,
  represignParts,
} from './uploadApi'

/** Minimal Response-like stub for the two shapes fetch callers read. */
function jsonResponse(body: unknown, init?: { ok?: boolean; status?: number }): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: 'stubbed',
    json: () => Promise.resolve(body),
    headers: new Headers(),
  } as unknown as Response
}

describe('makeUploadError', () => {
  it('builds an Error carrying name, status and code', () => {
    const err = makeUploadError(500, 'BOOM', 'server exploded')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('UploadHttpError')
    expect(err.message).toBe('server exploded')
    expect(err.status).toBe(500)
    expect(err.code).toBe('BOOM')
  })

  it('leaves code undefined when not provided', () => {
    expect(makeUploadError(404, undefined, 'nope').code).toBeUndefined()
  })
})

describe('isUploadHttpError', () => {
  it('is true for an error made by makeUploadError', () => {
    expect(isUploadHttpError(makeUploadError(500, undefined, 'x'))).toBe(true)
  })

  it('is false for a plain Error without a numeric status', () => {
    expect(isUploadHttpError(new Error('plain'))).toBe(false)
  })

  it('is false for non-Error values', () => {
    expect(isUploadHttpError('nope')).toBe(false)
    expect(isUploadHttpError(null)).toBe(false)
    expect(isUploadHttpError({ status: 500 })).toBe(false)
  })
})

describe('isRetryable', () => {
  it('treats network/unknown (non-HTTP) errors as retryable', () => {
    expect(isRetryable(new Error('network down'))).toBe(true)
    expect(isRetryable('weird')).toBe(true)
  })

  it('never retries a NO_ETAG (CORS) error', () => {
    expect(isRetryable(makeUploadError(0, 'NO_ETAG', 'cors'))).toBe(false)
  })

  it('retries 5xx, 429 and 403', () => {
    expect(isRetryable(makeUploadError(500, undefined, 'x'))).toBe(true)
    expect(isRetryable(makeUploadError(503, undefined, 'x'))).toBe(true)
    expect(isRetryable(makeUploadError(429, undefined, 'x'))).toBe(true)
    expect(isRetryable(makeUploadError(403, undefined, 'x'))).toBe(true)
  })

  it('does not retry other 4xx errors', () => {
    expect(isRetryable(makeUploadError(400, undefined, 'x'))).toBe(false)
    expect(isRetryable(makeUploadError(404, undefined, 'x'))).toBe(false)
  })
})

describe('postJson-backed endpoints', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })

  it('initUpload POSTs JSON to /uploads/init and returns the parsed body', async () => {
    const resp = {
      uploadId: 'u1',
      key: 'k1',
      partSize: 6,
      partCount: 1,
      parts: [],
      urlExpiresInSec: 900,
    }
    fetchMock.mockResolvedValue(jsonResponse(resp))
    const body = { filename: 'v.mp4', size: 10, mime: 'video/mp4', partSize: 6, durationSec: 5 }

    await expect(initUpload(body)).resolves.toEqual(resp)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('/uploads/init')
    expect(opts.method).toBe('POST')
    expect(opts.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(opts.body)).toEqual(body)
  })

  it('represignParts hits /uploads/parts', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ parts: [], urlExpiresInSec: 900 }))
    await represignParts({ uploadId: 'u1', key: 'k1', partNumbers: [1, 2] })
    expect(fetchMock.mock.calls[0][0]).toBe('/uploads/parts')
  })

  it('completeUpload hits /uploads/complete', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ videoId: 'v1', key: 'k1', status: 'completed' }))
    await completeUpload({ uploadId: 'u1', key: 'k1', parts: [{ partNumber: 1, eTag: 'e1' }] })
    expect(fetchMock.mock.calls[0][0]).toBe('/uploads/complete')
  })

  it('abortUpload hits /uploads/abort', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'aborted' }))
    await expect(abortUpload({ uploadId: 'u1', key: 'k1' })).resolves.toEqual({ status: 'aborted' })
    expect(fetchMock.mock.calls[0][0]).toBe('/uploads/abort')
  })

  it('throws an UploadHttpError with code+message from a JSON error body', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ code: 'BAD_INPUT', message: 'bad size' }, { ok: false, status: 400 }),
    )
    await expect(
      initUpload({ filename: 'v', size: 1, mime: 'video/mp4', partSize: 6, durationSec: 5 }),
    ).rejects.toMatchObject({ status: 400, code: 'BAD_INPUT', message: 'bad size' })
  })

  it('falls back to statusText when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      json: () => Promise.reject(new Error('not json')),
      headers: new Headers(),
    } as unknown as Response)
    await expect(abortUpload({ uploadId: 'u1', key: 'k1' })).rejects.toMatchObject({
      status: 502,
      message: 'Bad Gateway',
    })
  })

  it('keeps statusText as the message when the JSON error body omits message', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ code: 'RATE_LIMIT' }, { ok: false, status: 429 }))
    // json() resolves but has no `message`, so the `?? statusText` fallback runs.
    await expect(abortUpload({ uploadId: 'u1', key: 'k1' })).rejects.toMatchObject({
      status: 429,
      code: 'RATE_LIMIT',
      message: 'stubbed',
    })
  })

  it('forwards an AbortSignal to fetch', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'aborted' }))
    const controller = new AbortController()
    await abortUpload({ uploadId: 'u1', key: 'k1' }, controller.signal)
    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal)
  })
})

describe('putPart', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })

  it('PUTs the blob and returns the ETag header', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ ETag: '"etag-123"' }),
    } as unknown as Response)
    const blob = new Blob(['bytes'])

    await expect(putPart('https://s3/part-1', blob)).resolves.toBe('"etag-123"')

    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('https://s3/part-1')
    expect(opts.method).toBe('PUT')
    expect(opts.body).toBe(blob)
  })

  it('throws an UploadHttpError carrying the HTTP status on a failed PUT', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      headers: new Headers(),
    } as unknown as Response)
    await expect(putPart('https://s3/part-1', new Blob(['x']))).rejects.toMatchObject({
      status: 403,
    })
  })

  it('throws NO_ETAG when the response has no ETag header (CORS misconfig)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
    } as unknown as Response)
    await expect(putPart('https://s3/part-1', new Blob(['x']))).rejects.toMatchObject({
      code: 'NO_ETAG',
    })
  })
})
