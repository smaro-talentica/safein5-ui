export const MAX_TRIM_SECONDS = 60

export const PREFERRED_TRIM_MIME_TYPES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
] as const

/** Number of thumbnail frames drawn across the filmstrip, regardless of clip length. */
export const FILMSTRIP_FRAME_COUNT = 10

/** Minimum handle-drag width, in seconds, mirrors the floor used when clamping a trim range. */
export const MIN_TRIM_SECONDS = 1
