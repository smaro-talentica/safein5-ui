import {
  deleteAudioFromIndexedDb,
  deleteAudioUploadRecord,
  saveAudioUploadRecord,
} from '@/pages/worker/Capture/action'
import { MAX_AUDIO_UPLOAD_RETRIES } from '@/pages/worker/Capture/constant'
import { nextAudioUploadRetryDelay } from '@/pages/worker/Capture/helper'
import type {
  AudioPresignResponse,
  AudioUploadRecord,
  StoredAudio,
} from '@/pages/worker/Capture/model'

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Real backend + S3 calls — see docs/BACKEND_AUDIO_UPLOAD_SPEC.md for the endpoint contract this
// expects. `getToken` (`@/auth/store`) is needed again once a live backend exists and the
// Authorization header below is uncommented.

import { env } from '@/utils/env'

async function requestPresignedUrl(audio: StoredAudio): Promise<AudioPresignResponse> {
  const response = await fetch(`${env.apiBaseUrl}/audio-clips/presign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ filename: audio.name, mime: audio.type, size: audio.size }),
  })

  if (!response.ok) {
    throw new Error(`Presign request failed with status ${response.status}`)
  }

  return (await response.json()) as AudioPresignResponse
}

async function presignAndUploadToS3(
  audio: StoredAudio,
  signal: AbortSignal,
): Promise<AudioPresignResponse> {
  const presigned = await requestPresignedUrl(audio)

  const response = await fetch(presigned.url, {
    method: 'PUT',
    headers: { 'Content-Type': audio.type },
    body: audio.blob,
    signal,
  })

  if (!response.ok) {
    throw new Error(`S3 upload failed with status ${response.status}`)
  }

  return presigned
}

async function uploadWithRetry(
  audio: StoredAudio,
  signal: AbortSignal,
): Promise<AudioPresignResponse> {
  let attempt = 0
  for (;;) {
    if (signal.aborted) throw new DOMException('Upload canceled', 'AbortError')
    try {
      return await presignAndUploadToS3(audio, signal)
    } catch (err) {
      if (signal.aborted || attempt >= MAX_AUDIO_UPLOAD_RETRIES) throw err
      await delay(nextAudioUploadRetryDelay(attempt))
      attempt += 1
    }
  }
}

export async function runAudioUpload(
  audio: StoredAudio,
  record: AudioUploadRecord,
  signal: AbortSignal,
): Promise<void> {
  let current: AudioUploadRecord = { ...record, status: 'uploading', updatedAt: Date.now() }
  await saveAudioUploadRecord(current)

  try {
    const presigned = await uploadWithRetry(audio, signal)

    if (signal.aborted) {
      await deleteAudioUploadRecord(current.id)
      await deleteAudioFromIndexedDb(audio.id)
      return
    }

    current = {
      ...current,
      status: 'completed',
      s3Key: presigned.s3Key,
      updatedAt: Date.now(),
    }
    await saveAudioUploadRecord(current)
    await deleteAudioUploadRecord(current.id)
    await deleteAudioFromIndexedDb(audio.id)
  } catch (err) {
    if (signal.aborted) {
      await deleteAudioUploadRecord(current.id)
      await deleteAudioFromIndexedDb(audio.id)
      return
    }
    current = {
      ...current,
      status: 'error',
      error: err instanceof Error ? err.message : 'Upload failed.',
      updatedAt: Date.now(),
    }
    await saveAudioUploadRecord(current)
    throw err
  }
}
