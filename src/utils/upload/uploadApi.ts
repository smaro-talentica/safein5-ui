/**
 * Thin client for the backend upload endpoints defined in
 * docs/BACKEND_UPLOAD_SPEC.md, plus the direct-to-S3 part PUT.
 */
import { env } from '@/utils/env'
import type { CompleteResponse, InitResponse, PartsResponse } from './types'

/** An Error carrying the HTTP status and an optional machine-readable code. */
export interface UploadHttpError extends Error {
  status: number
  code?: string
}

/** Build an upload error (plain Error augmented with status/code — no class). */
export function makeUploadError(
  status: number,
  code: string | undefined,
  message: string,
): UploadHttpError {
  const err = new Error(message) as UploadHttpError
  err.name = 'UploadHttpError'
  err.status = status
  err.code = code
  return err
}

/** Type guard: is this one of our HTTP errors (has a numeric status)? */
export function isUploadHttpError(e: unknown): e is UploadHttpError {
  return e instanceof Error && typeof (e as UploadHttpError).status === 'number'
}

/** 5xx and 429 are transient; part PUT 403 is a likely-expired presigned URL. */
export function isRetryable(e: unknown): boolean {
  if (!isUploadHttpError(e)) return true // network / unknown errors are retryable
  if (e.code === 'NO_ETAG') return false // CORS misconfig — retrying won't help
  return e.status >= 500 || e.status === 429 || e.status === 403
}

function apiUrl(path: string): string {
  const base = (env.apiBaseUrl ?? '').replace(/\/$/, '')
  return `${base}${path}`
}

async function postJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) {
    let code: string | undefined
    let message = res.statusText
    try {
      const err = await res.json()
      code = err.code
      message = err.message ?? message
    } catch {
      // non-JSON error body — keep statusText
    }
    throw makeUploadError(res.status, code, message)
  }
  return res.json() as Promise<T>
}

export function initUpload(
  body: {
    filename: string
    size: number
    mime: string
    partSize: number
    durationSec: number
  },
  signal?: AbortSignal,
): Promise<InitResponse> {
  return postJson<InitResponse>('/uploads/init', body, signal)
}

export function represignParts(
  body: { uploadId: string; key: string; partNumbers: number[] },
  signal?: AbortSignal,
): Promise<PartsResponse> {
  return postJson<PartsResponse>('/uploads/parts', body, signal)
}

export function completeUpload(
  body: {
    uploadId: string
    key: string
    parts: Array<{ partNumber: number; eTag: string }>
  },
  signal?: AbortSignal,
): Promise<CompleteResponse> {
  return postJson<CompleteResponse>('/uploads/complete', body, signal)
}

export function abortUpload(
  body: { uploadId: string; key: string },
  signal?: AbortSignal,
): Promise<{ status: 'aborted' }> {
  return postJson<{ status: 'aborted' }>('/uploads/abort', body, signal)
}

/**
 * PUT a single part's bytes directly to its presigned S3 URL and return the ETag.
 * The bucket must expose the `ETag` response header via CORS (see the spec) or
 * this returns null and the upload cannot complete.
 */
export async function putPart(url: string, body: Blob, signal?: AbortSignal): Promise<string> {
  const res = await fetch(url, { method: 'PUT', body, signal })
  if (!res.ok) {
    throw makeUploadError(res.status, undefined, `Part PUT failed: ${res.status}`)
  }
  const eTag = res.headers.get('ETag')
  if (!eTag) {
    throw makeUploadError(
      0,
      'NO_ETAG',
      'S3 did not return an ETag header — check bucket CORS ExposeHeaders: ["ETag"].',
    )
  }
  return eTag
}
