/**
 * MediaRecorder codec selection. Prefer MP4 (broad playback + iOS), fall back to
 * WebM where MP4 recording isn't supported (most desktop Chrome/Firefox).
 */
const CANDIDATES = [
  'video/mp4;codecs=h264,aac',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
]

export function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return undefined
  return CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type))
}

export function extensionForMime(mime: string): string {
  if (mime.includes('mp4')) return 'mp4'
  if (mime.includes('webm')) return 'webm'
  return 'video'
}
