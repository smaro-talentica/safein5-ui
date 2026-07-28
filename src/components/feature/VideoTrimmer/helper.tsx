import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
  WebMOutputFormat,
} from 'mediabunny'
import { MAX_TRIM_SECONDS, MIN_TRIM_SECONDS, PREFERRED_TRIM_MIME_TYPES } from './constant'
import type { DragAnchor, TrimRange } from './model'

export function pickTrimMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return undefined
  return PREFERRED_TRIM_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type))
}

/**
 * Keeps [start, end] within [0, duration], at least 1 second wide, and no wider than
 * MAX_TRIM_SECONDS. Moving one handle past the other's allowed span pushes both together.
 */
export function clampTrimRange(range: TrimRange, duration: number): TrimRange {
  const start = Math.min(Math.max(0, range.start), duration)
  let end = Math.min(Math.max(start + 1, range.end), duration)
  if (end - start > MAX_TRIM_SECONDS) end = start + MAX_TRIM_SECONDS
  return { start, end }
}

export function formatClock(seconds: number): string {
  const clamped = Math.max(0, Math.round(seconds))
  const mins = Math.floor(clamped / 60)
  const secs = clamped % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/** Evenly-spaced timestamps (seconds) to grab filmstrip thumbnails at, across the whole clip. */
export function frameTimestamps(duration: number, count: number): number[] {
  if (count <= 0 || duration <= 0) return []
  if (count === 1) return [0]
  const step = duration / count
  return Array.from({ length: count }, (_, i) => Math.min(duration, i * step))
}

/**
 * Given a pointer's horizontal position expressed as a 0-1 ratio across the filmstrip, and which
 * handle is being dragged, returns the next clamped range. The non-dragged handle's position is
 * held fixed as the anchor, matching a WhatsApp-style trim scrubber (dragging one edge never
 * moves the other).
 */
export function dragValueFromRatio(
  ratio: number,
  handle: 'start' | 'end',
  range: TrimRange,
  duration: number,
): TrimRange {
  const time = Math.min(Math.max(0, ratio), 1) * duration
  if (handle === 'start') {
    const start = Math.min(time, range.end - MIN_TRIM_SECONDS)
    return clampTrimRange({ start, end: range.end }, duration)
  }
  const end = Math.max(time, range.start + MIN_TRIM_SECONDS)
  return clampTrimRange({ start: range.start, end }, duration)
}

/**
 * Shifts the whole selection window by the pointer's movement since the drag started, keeping
 * its width fixed — matches WhatsApp's "drag the crop frame as a whole" gesture. `anchor` is the
 * range and pointer ratio captured at drag-start; `ratio` is the pointer's current position.
 */
export function dragWindowFromRatio(
  ratio: number,
  anchor: DragAnchor,
  duration: number,
): TrimRange {
  const clampedRatio = Math.min(Math.max(0, ratio), 1)
  const deltaSeconds = (clampedRatio - anchor.ratio) * duration
  const width = anchor.range.end - anchor.range.start

  let start = anchor.range.start + deltaSeconds
  start = Math.min(Math.max(0, start), duration - width)
  return { start, end: start + width }
}

/**
 * Grabs `count` evenly-spaced thumbnail frames from `sourceUrl` as data URLs, for a WhatsApp-style
 * filmstrip scrubber. Uses its own off-DOM <video> (not the visible preview element) so seeking
 * for thumbnails never disrupts the preview's own playback/currentTime.
 */
export async function extractFilmstripThumbnails(
  sourceUrl: string,
  duration: number,
  count: number,
): Promise<string[]> {
  const timestamps = frameTimestamps(duration, count)
  if (timestamps.length === 0) return []

  const video = document.createElement('video')
  video.preload = 'auto'
  video.muted = true
  video.src = sourceUrl

  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve()
    video.onerror = () => reject(new Error('Could not read frames from this video.'))
  })

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth || 1
  canvas.height = video.videoHeight || 1
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context is unavailable.')

  const thumbnails: string[] = []
  for (const timestamp of timestamps) {
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve()
      video.currentTime = timestamp
    })
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    thumbnails.push(canvas.toDataURL('image/jpeg', 0.6))
  }

  return thumbnails
}

/**
 * A <video> element can have `createMediaElementSource` called on it at most once ever — a
 * second call throws `InvalidStateError`. Since a trimmer session can call recordTrimmedRange
 * repeatedly (auto-confirm fires on every drag release), the audio graph for a given element is
 * built once, cached here, and reused. `source` stays connected to `audioCtx.destination` too,
 * so routing the element through Web Audio doesn't silence its normal on-screen playback.
 */
const audioGraphs = new WeakMap<
  HTMLVideoElement,
  { audioCtx: AudioContext; destination: MediaStreamAudioDestinationNode }
>()

function getAudioGraph(video: HTMLVideoElement) {
  const cached = audioGraphs.get(video)
  if (cached) return cached

  if (!('AudioContext' in window)) return undefined

  const audioCtx = new AudioContext()
  const destination = audioCtx.createMediaStreamDestination()
  const source = audioCtx.createMediaElementSource(video)
  source.connect(destination)
  source.connect(audioCtx.destination)

  const graph = { audioCtx, destination }
  audioGraphs.set(video, graph)
  return graph
}

/**
 * Re-encodes the [start, end] slice of `video` into a new Blob by playing it back in real time
 * and capturing a canvas + audio stream through MediaRecorder. This is the fallback path for
 * browsers without WebCodecs support (`recordTrimmedRangeViaMediabunny` is tried first) — it's
 * tied to real-time playback (a 10s selection takes ~10s), but always produces a correctly-timed
 * output. This is a real re-encode (not a byte-range cut) since arbitrary container formats can't
 * be losslessly sliced in-browser.
 */
async function recordTrimmedRangeViaCanvas(
  video: HTMLVideoElement,
  range: TrimRange,
  signal?: AbortSignal,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth || 720
  canvas.height = video.videoHeight || 1280
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context is unavailable.')

  // An explicit frame rate switches captureStream() to timer-driven capture instead of
  // change-detection mode — without it, Chrome/Firefox can fail to emit more than the first
  // frame for short recordings, producing a recording that looks frozen on a single frame.
  const canvasStream = canvas.captureStream(30)

  const audioGraph = getAudioGraph(video)
  const audioStream = audioGraph?.destination.stream

  const tracks = [...canvasStream.getVideoTracks(), ...(audioStream?.getAudioTracks() ?? [])]
  const combined = new MediaStream(tracks)

  const mimeType = pickTrimMimeType()
  const recorder = new MediaRecorder(combined, mimeType ? { mimeType } : undefined)
  const chunks: Blob[] = []
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }

  const wasMuted = video.muted
  video.muted = false

  const cleanup = () => {
    video.pause()
    video.muted = wasMuted
    canvasStream.getTracks().forEach((track) => track.stop())
  }

  return new Promise<Blob>((resolve, reject) => {
    let rafId: number | null = null
    let settled = false
    let failure: Error | null = null

    const stop = (error?: Error) => {
      if (settled) return
      settled = true
      failure = error ?? null
      if (rafId !== null) cancelAnimationFrame(rafId)
      if (recorder.state !== 'inactive') recorder.stop()
      else {
        cleanup()
        if (failure) reject(failure)
      }
    }

    if (signal) {
      if (signal.aborted) {
        stop(new DOMException('Trim canceled', 'AbortError'))
      } else {
        signal.addEventListener('abort', () => {
          stop(new DOMException('Trim canceled', 'AbortError'))
        })
      }
    }

    recorder.onstop = () => {
      cleanup()
      if (failure) {
        reject(failure)
        return
      }
      resolve(new Blob(chunks, { type: recorder.mimeType || 'video/webm' }))
    }
    recorder.onerror = () => {
      stop(new Error('Recording the trimmed clip failed.'))
    }

    const drawFrame = () => {
      if (video.paused || video.ended) return
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      if (video.currentTime >= range.end) {
        stop()
        return
      }
      rafId = requestAnimationFrame(drawFrame)
    }

    const beginRecording = () => {
      recorder.start()
      video
        .play()
        .then(() => {
          rafId = requestAnimationFrame(drawFrame)
        })
        .catch((err) => {
          stop(err instanceof Error ? err : new Error('Could not play the video to trim it.'))
        })
    }

    // Live-scrubbing during the drag that led here often already left currentTime at (or very
    // near) range.start, in which case the browser never fires `seeked` — waiting for it would
    // hang forever. Only wait for a real seek when one is actually needed.
    if (Math.abs(video.currentTime - range.start) < 0.05) {
      beginRecording()
    } else {
      video.onseeked = () => {
        video.onseeked = null
        beginRecording()
      }
      video.currentTime = range.start
    }
  })
}

/** True if this browser can decode/encode video via WebCodecs, which Mediabunny relies on. */
function supportsWebCodecs(): boolean {
  return typeof VideoDecoder !== 'undefined' && typeof VideoEncoder !== 'undefined'
}

/**
 * Re-encodes the [start, end] slice of `file` into a new Blob using Mediabunny, which drives the
 * browser's native WebCodecs decoder/encoder directly — frames are processed as fast as the CPU
 * allows rather than gated to real-time playback (unlike the canvas/MediaRecorder fallback), so a
 * 10s selection typically finishes in a small fraction of a second while the output still plays
 * back at the correct 10s duration (each frame keeps its original timestamp).
 */
async function recordTrimmedRangeViaMediabunny(file: Blob, range: TrimRange): Promise<Blob> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS })
  const outputFormat = file.type.includes('mp4') ? new Mp4OutputFormat() : new WebMOutputFormat()
  const target = new BufferTarget()
  const output = new Output({ format: outputFormat, target })

  const conversion = await Conversion.init({
    input,
    output,
    trim: { start: range.start, end: range.end },
  })
  if (!conversion.isValid) {
    throw new Error('This video cannot be trimmed in this browser.')
  }

  await conversion.execute()

  if (!target.buffer) throw new Error('Trimming produced no output.')
  return new Blob([target.buffer], {
    type: outputFormat instanceof Mp4OutputFormat ? 'video/mp4' : 'video/webm',
  })
}

/**
 * Re-encodes the [start, end] slice of the video into a new Blob, so the trimmed clip is no
 * longer than MAX_TRIM_SECONDS. Prefers Mediabunny (WebCodecs-backed, fast, correct duration);
 * falls back to the real-time canvas/MediaRecorder path on browsers without WebCodecs support.
 */
export async function recordTrimmedRange(
  video: HTMLVideoElement,
  file: Blob,
  range: TrimRange,
  signal?: AbortSignal,
): Promise<Blob> {
  if (supportsWebCodecs()) {
    try {
      return await recordTrimmedRangeViaMediabunny(file, range)
    } catch {
      // Fall through to the canvas path — e.g. an unsupported codec/container combination for
      // this particular file, even though the browser generally supports WebCodecs.
    }
  }
  return recordTrimmedRangeViaCanvas(video, range, signal)
}
