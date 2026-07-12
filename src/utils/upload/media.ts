/**
 * Media helpers: read a video file's duration from its metadata and validate it
 * against the max-duration limit before an upload is created.
 */
import { env } from '@/utils/env'

/** Read duration (seconds) of a video Blob/File via a hidden <video> element. */
export function probeDurationSec(source: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(source)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true

    const cleanup = () => {
      URL.revokeObjectURL(url)
      video.removeAttribute('src')
      video.load()
    }

    video.onloadedmetadata = () => {
      const { duration } = video
      cleanup()
      // Some browsers report Infinity for MediaRecorder blobs until seeked.
      if (!Number.isFinite(duration)) {
        resolve(Number.POSITIVE_INFINITY)
      } else {
        resolve(duration)
      }
    }
    video.onerror = () => {
      cleanup()
      reject(new Error('Could not read video metadata.'))
    }
    video.src = url
  })
}

export interface ValidationResult {
  ok: boolean
  durationSec: number
  error?: string
}

export async function validateVideo(source: Blob): Promise<ValidationResult> {
  if (!source.type.startsWith('video/')) {
    return { ok: false, durationSec: 0, error: 'Please choose a video file.' }
  }
  let durationSec: number
  try {
    durationSec = await probeDurationSec(source)
  } catch {
    return { ok: false, durationSec: 0, error: 'Could not read the video. Try another file.' }
  }
  const max = env.uploadMaxDurationSec
  // Allow half a second of tolerance for rounding in container metadata.
  if (durationSec > max + 0.5) {
    return {
      ok: false,
      durationSec,
      error: `Video must be ${max} seconds or less (this one is ${Math.round(durationSec)}s).`,
    }
  }
  return { ok: true, durationSec }
}
