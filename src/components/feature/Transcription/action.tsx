import { MOCK_TRANSCRIBE_DELAY_MS, MOCK_TRANSCRIPT } from './constant'
import type { TranscribeOptions, TranscriptionClient, TranscriptionResult } from './model'

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Mock client used while no STT backend exists. Returns a fixed placeholder transcript after a
 * short delay so the UI's loading/result states can be built and tested end to end.
 */
// const mockTranscribe: TranscriptionClient['transcribe'] = async () => {
//   await delay(MOCK_TRANSCRIBE_DELAY_MS)
//   return { text: MOCK_TRANSCRIPT }
// }

// Real backend calls — see docs/BACKEND_SPEECH_TO_TEXT_SPEC.md for the endpoint contracts these
// expect. AWS Transcribe works on audio already sitting in S3 (StartTranscriptionJob), not on
// raw bytes in a request — so this is a 3-step flow, not a single POST-and-get-text-back call:
//   1. Upload the clip to S3 via a presigned URL (same pattern as AudioUploader).
//   2. Ask the backend to start an AWS Transcribe job against that S3 object.
//   3. Poll the backend for the job's status until it completes (or fails).
// Uncomment once VITE_STT_ENDPOINT_URL points at a live service, and flip `activeTranscribe`
// below from `mockTranscribe` to `remoteTranscribe`.
//
// Note: the transcript text itself (once the worker reviews/edits and approves it) is saved
// locally via `saveTextEntry` in `@/pages/worker/Capture/action` — this module's job is only to
// produce a transcript, not to persist anything. The Capture "Text" tab does not upload the
// source audio anywhere; only the resulting text is kept, per the current local-storage-only
// scope (see StoredTextEntry's doc comment in `@/pages/worker/Capture/model`).
//
import { getToken } from '@/auth/store'
import { env } from '@/utils/env'
import type { AudioPresignResponse, TranscriptionJobResponse } from '@/pages/worker/Capture/model'
import { TRANSCRIPTION_JOB_POLL_INTERVAL_MS, TRANSCRIPTION_JOB_POLL_TIMEOUT_MS } from './constant'

async function requestPresignedUrl(audio: Blob): Promise<AudioPresignResponse> {
  const response = await fetch(`${env.sttEndpointUrl}/presign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ mime: audio.type, size: audio.size }),
  })

  if (!response.ok) {
    throw new Error(`Presign request failed with status ${response.status}`)
  }

  return (await response.json()) as AudioPresignResponse
}

async function uploadToS3(presigned: AudioPresignResponse, audio: Blob): Promise<void> {
  const response = await fetch(presigned.url, {
    method: 'PUT',
    headers: { 'Content-Type': audio.type },
    body: audio,
  })

  if (!response.ok) {
    throw new Error(`S3 upload failed with status ${response.status}`)
  }
}

async function startTranscriptionJob(
  s3Key: string,
  options?: TranscribeOptions,
): Promise<TranscriptionJobResponse> {
  const response = await fetch(`${env.sttEndpointUrl}/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ s3Key, language: options?.languageHint }),
  })

  if (!response.ok) {
    throw new Error(`Start-transcription request failed with status ${response.status}`)
  }

  return (await response.json()) as TranscriptionJobResponse
}

async function getTranscriptionJob(jobId: string): Promise<TranscriptionJobResponse> {
  const response = await fetch(`${env.sttEndpointUrl}/jobs/${jobId}`, {
    // headers: { Authorization: `Bearer ${getToken()}` },
  })

  if (!response.ok) {
    throw new Error(`Job status request failed with status ${response.status}`)
  }

  return (await response.json()) as TranscriptionJobResponse
}

async function pollTranscriptionJob(jobId: string): Promise<TranscriptionResult> {
  const deadline = Date.now() + TRANSCRIPTION_JOB_POLL_TIMEOUT_MS
  for (;;) {
    const job = await getTranscriptionJob(jobId)
    if (job.status === 'completed') return { text: job.text ?? '' }
    if (job.status === 'failed') throw new Error(job.error ?? 'Transcription job failed.')
    if (Date.now() > deadline) throw new Error('Timed out waiting for transcription.')
    await delay(TRANSCRIPTION_JOB_POLL_INTERVAL_MS)
  }
}

async function remoteTranscribe(
  audio: Blob,
  options?: TranscribeOptions,
): Promise<TranscriptionResult> {
  if (!env.sttEndpointUrl) {
    throw new Error('VITE_STT_ENDPOINT_URL is not configured.')
  }

  const presigned = await requestPresignedUrl(audio)
  await uploadToS3(presigned, audio)
  const job = await startTranscriptionJob(presigned.s3Key, options)
  return pollTranscriptionJob(job.jobId)
}

const activeTranscribe = remoteTranscribe

export const transcriptionClient: TranscriptionClient = {
  transcribe: activeTranscribe,
}

export async function transcribeAudio(
  audio: Blob,
  options?: TranscribeOptions,
): Promise<TranscriptionResult> {
  return transcriptionClient.transcribe(audio, options)
}
