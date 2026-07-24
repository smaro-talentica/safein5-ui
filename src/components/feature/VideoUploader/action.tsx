import { getToken } from '@/auth/store'
import {
  deleteUploadSession,
  deleteVideoFromIndexedDb,
  saveUploadSession,
} from '@/pages/worker/Capture/action'
import { MAX_CHUNK_RETRIES } from '@/pages/worker/Capture/constant'
import { nextRetryDelay } from '@/pages/worker/Capture/helper'
import type { NextChunkResponse, StoredVideo, UploadSession } from '@/pages/worker/Capture/model'
import { env } from '@/utils/env'

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function requestNextChunkUrl(payload: object): Promise<NextChunkResponse> {
  const response = await fetch(`${env.apiBaseUrl}/uploads/next`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`Upload session request failed with status ${response.status}`)
  }

  return (await response.json()) as NextChunkResponse
}

export async function uploadChunkToS3(url: string, blob: Blob): Promise<string> {
  const response = await fetch(url, { method: 'PUT', body: blob })
  if (!response.ok) {
    throw new Error(`Chunk upload failed with status ${response.status}`)
  }

  const eTag = response.headers.get('ETag')
  if (!eTag) {
    throw new Error('S3 response did not include an ETag header.')
  }
  return eTag
}

async function uploadChunkWithRetry(url: string, blob: Blob, signal: AbortSignal): Promise<string> {
  let attempt = 0
  for (;;) {
    if (signal.aborted) throw new DOMException('Upload canceled', 'AbortError')
    try {
      return await uploadChunkToS3(url, blob)
    } catch (err) {
      if (attempt >= MAX_CHUNK_RETRIES) throw err
      await delay(nextRetryDelay(attempt))
      attempt += 1
    }
  }
}

function lastDoneChunk(session: UploadSession) {
  return [...session.chunks].reverse().find((chunk) => chunk.status === 'done')
}

/**
 * Asks the backend for the next signed URL. On a fresh session this is the "init" call;
 * on resume (sessionId already set) it re-sends the last confirmed chunk's confirmation,
 * which the backend must treat idempotently and simply return the next URL again.
 */
async function fetchNextChunk(session: UploadSession): Promise<NextChunkResponse> {
  if (!session.sessionId) {
    return requestNextChunkUrl({
      filename: session.filename,
      mime: session.mime,
      size: session.size,
      chunkSize: session.chunkSize,
      chunkCount: session.chunkCount,
    })
  }

  const last = lastDoneChunk(session)
  return requestNextChunkUrl({
    sessionId: session.sessionId,
    chunkNumber: last?.chunkNumber ?? 0,
    eTag: last?.eTag,
  })
}

async function discardSession(video: StoredVideo, session: UploadSession): Promise<void> {
  await deleteUploadSession(session.id)
  await deleteVideoFromIndexedDb(video.id)
}

export async function runUploadSession(
  video: StoredVideo,
  session: UploadSession,
  signal: AbortSignal,
): Promise<void> {
  let current: UploadSession = { ...session, status: 'uploading' }
  await saveUploadSession(current)

  try {
    let response = await fetchNextChunk(current)

    for (;;) {
      if (signal.aborted) {
        await discardSession(video, current)
        return
      }

      const chunkResponse = response
      if (chunkResponse.status === 'completed') {
        current = { ...current, status: 'completed', sessionId: chunkResponse.sessionId }
        await saveUploadSession(current)
        await deleteUploadSession(current.id)
        await deleteVideoFromIndexedDb(video.id)
        return
      }

      const chunk = current.chunks.find((c) => c.chunkNumber === chunkResponse.nextChunkNumber)
      if (!chunk) {
        throw new Error(`No local chunk matches chunkNumber ${chunkResponse.nextChunkNumber}`)
      }

      const chunkBlob = video.blob.slice(chunk.start, chunk.end)
      const eTag = await uploadChunkWithRetry(chunkResponse.url, chunkBlob, signal)

      current = {
        ...current,
        sessionId: response.sessionId,
        chunks: current.chunks.map((c) =>
          c.chunkNumber === chunk.chunkNumber ? { ...c, status: 'done', eTag } : c,
        ),
        updatedAt: Date.now(),
      }
      await saveUploadSession(current)

      if (signal.aborted) {
        await discardSession(video, current)
        return
      }

      response = await requestNextChunkUrl({
        sessionId: response.sessionId,
        chunkNumber: chunk.chunkNumber,
        eTag,
      })
    }
  } catch (err) {
    if (signal.aborted) {
      await discardSession(video, current)
      return
    }
    current = {
      ...current,
      status: 'error',
      error: err instanceof Error ? err.message : 'Upload failed.',
      updatedAt: Date.now(),
    }
    await saveUploadSession(current)
    throw err
  }
}
