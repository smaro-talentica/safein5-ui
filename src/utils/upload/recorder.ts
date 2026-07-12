/**
 * MediaRecorder codec selection and capture-quality caps.
 *
 * Recorded clips are capped at 720p / 30fps with a bounded bitrate so a 30s
 * video stays small (~10-15 MB) and uploads fast, regardless of what the
 * device camera is natively capable of. Prefer MP4 (broad playback + iOS),
 * fall back to WebM where MP4 recording isn't supported (most desktop
 * Chrome/Firefox).
 */

/** Hard ceiling on recording resolution. */
export const CAPTURE_MAX_WIDTH = 1280
export const CAPTURE_MAX_HEIGHT = 720
/** Frame-rate ceiling — 60fps roughly doubles size for little perceived gain. */
export const CAPTURE_MAX_FPS = 30
/** Video bitrate ceiling (~4 Mbps → ~15 MB for 30s). */
export const CAPTURE_VIDEO_BITS_PER_SEC = 4_000_000
/** Audio bitrate ceiling (~128 kbps). */
export const CAPTURE_AUDIO_BITS_PER_SEC = 128_000

const CANDIDATES = [
  'video/mp4;codecs=h264,aac',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
]

/**
 * getUserMedia constraints that cap the capture at 720p/30fps. `ideal` targets
 * 720p while `max` prevents the browser from handing back a larger stream.
 */
export function captureConstraints(): MediaStreamConstraints {
  return {
    video: {
      facingMode: 'environment',
      width: { ideal: CAPTURE_MAX_WIDTH, max: CAPTURE_MAX_WIDTH },
      height: { ideal: CAPTURE_MAX_HEIGHT, max: CAPTURE_MAX_HEIGHT },
      frameRate: { ideal: CAPTURE_MAX_FPS, max: CAPTURE_MAX_FPS },
    },
    audio: true,
  }
}

/** MediaRecorder options that bound the encoded bitrate. */
export function recorderOptions(mimeType: string): MediaRecorderOptions {
  return {
    mimeType,
    videoBitsPerSecond: CAPTURE_VIDEO_BITS_PER_SEC,
    audioBitsPerSecond: CAPTURE_AUDIO_BITS_PER_SEC,
  }
}

export function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return undefined
  return CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type))
}

export function extensionForMime(mime: string): string {
  if (mime.includes('mp4')) return 'mp4'
  if (mime.includes('webm')) return 'webm'
  return 'video'
}
