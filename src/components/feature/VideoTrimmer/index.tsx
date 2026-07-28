import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'
import { useCallback, useEffect, useRef, useState } from 'react'
import { queueTrimJob } from '@/pages/worker/Capture/action'
import { FILMSTRIP_FRAME_COUNT, MAX_TRIM_SECONDS } from './constant'
import {
  clampTrimRange,
  dragValueFromRatio,
  dragWindowFromRatio,
  extractFilmstripThumbnails,
  formatClock,
} from './helper'
import type { DragAnchor, DragHandle, TrimRange, TrimStatus } from './model'
import type { VideoTrimmerProps } from './model'

export function VideoTrimmer({ file, duration, onQueued, onCancel, className }: VideoTrimmerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [sourceUrl] = useState<string>(() => URL.createObjectURL(file))
  const isMountedRef = useRef(false)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      // React 19 StrictMode's dev-mode mount→cleanup→remount cycle fires this cleanup
      // synchronously and then remounts in the same tick, without recreating `sourceUrl` (the
      // useState initializer only runs once per instance) — revoking here unconditionally would
      // leave the still-mounted <video> pointing at a dead blob URL. Deferring the revoke lets the
      // remount's effect flip isMountedRef back to true first, so only a real unmount revokes it.
      queueMicrotask(() => {
        if (!isMountedRef.current) URL.revokeObjectURL(sourceUrl)
      })
    }
  }, [sourceUrl])

  const [range, setRange] = useState<TrimRange>(() =>
    clampTrimRange({ start: 0, end: Math.min(duration, MAX_TRIM_SECONDS) }, duration),
  )
  const rangeRef = useRef(range)
  useEffect(() => {
    rangeRef.current = range
  }, [range])
  const [status, setStatus] = useState<TrimStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [thumbnails, setThumbnails] = useState<string[]>([])
  const [dragging, setDragging] = useState<DragHandle>(null)
  const dragAnchorRef = useRef<DragAnchor | null>(null)

  useEffect(() => {
    let cancelled = false
    extractFilmstripThumbnails(sourceUrl, duration, FILMSTRIP_FRAME_COUNT)
      .then((frames) => {
        if (!cancelled) setThumbnails(frames)
      })
      .catch(() => {
        // Filmstrip is a visual aid only — if extraction fails, the scrubber still works
        // against a plain track background, so there's nothing to surface as a user-facing error.
      })
    return () => {
      cancelled = true
    }
  }, [sourceUrl, duration])

  const ratioFromPointer = useCallback((clientX: number) => {
    const track = trackRef.current
    if (!track) return 0
    const rect = track.getBoundingClientRect()
    return (clientX - rect.left) / rect.width
  }, [])

  // Constrain native playback (the built-in play button / progress bar) to the selected
  // [start, end] window — without this, "play" plays the whole source clip regardless of what's
  // been trimmed. Reaching `range.end` loops back to `range.start` and keeps playing, rather than
  // pausing. Deliberately NOT keyed off `seeked`, since the live-scrub during dragging seeks the
  // video to the exact start/end boundary on purpose — clamping there would fight the drag.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onTimeUpdate = () => {
      if (!video.paused && video.currentTime >= range.end) {
        video.currentTime = range.start
      }
    }
    const onPlay = () => {
      if (video.currentTime < range.start || video.currentTime >= range.end) {
        video.currentTime = range.start
      }
    }

    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('play', onPlay)
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('play', onPlay)
    }
  }, [range])

  const queueUpload = useCallback(
    async (finalRange: TrimRange) => {
      setStatus('processing')
      setError(null)
      try {
        await queueTrimJob(file, `trimmed-${file.size}.webm`, finalRange)
        onQueued(finalRange)
      } catch (err) {
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Could not queue this video for trimming.')
        return
      }
      setStatus('idle')
    },
    [file, onQueued],
  )

  const dragHandleRef = useRef<DragHandle>(null)

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const current = dragHandleRef.current
      if (!current) return
      const ratio = ratioFromPointer(event.clientX)
      const prev = rangeRef.current
      const next =
        current === 'window'
          ? dragWindowFromRatio(ratio, dragAnchorRef.current ?? { range: prev, ratio }, duration)
          : dragValueFromRatio(ratio, current, prev, duration)
      setRange(next)
      rangeRef.current = next
      const video = videoRef.current
      if (video) {
        // Live-scrub the preview as the handle moves — dragging the start handle or the whole
        // window shows the new in-point, dragging the end handle shows the new out-point,
        // matching WhatsApp's immediate-feedback scrubber (no separate "preview" step).
        video.currentTime = current === 'end' ? next.end : next.start
      }
    },
    [duration, ratioFromPointer],
  )

  const handlePointerUp = useCallback(() => {
    dragHandleRef.current = null
    dragAnchorRef.current = null
    setDragging(null)
  }, [])

  useEffect(() => {
    if (!dragging) return
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [dragging, handlePointerMove, handlePointerUp])

  const startDrag = useCallback(
    (handle: Exclude<DragHandle, null>) => (event: React.PointerEvent) => {
      event.preventDefault()
      if (handle === 'window') {
        dragAnchorRef.current = { range: rangeRef.current, ratio: ratioFromPointer(event.clientX) }
      }
      dragHandleRef.current = handle
      setDragging(handle)
    },
    [ratioFromPointer],
  )

  const trimmedSeconds = range.end - range.start
  const startPercent = duration > 0 ? (range.start / duration) * 100 : 0
  const endPercent = duration > 0 ? (range.end / duration) * 100 : 0
  const isBusy = status === 'processing'

  return (
    <div className={cn('space-y-3', className)}>
      <div className="relative overflow-hidden rounded-lg bg-black">
        <video
          ref={videoRef}
          src={sourceUrl}
          controls
          playsInline
          className="aspect-9/16 w-full object-contain"
        />
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className={cn('font-medium', dragging ? 'text-slate-900' : undefined)}>
          {dragging ? `${formatClock(range.start)} - ${formatClock(range.end)}` : 'Drag to trim'}
        </span>
        <span
          className={cn(
            'font-medium',
            trimmedSeconds > MAX_TRIM_SECONDS ? 'text-red-600' : 'text-slate-700',
          )}
        >
          {formatClock(trimmedSeconds)} / {formatClock(MAX_TRIM_SECONDS)}
        </span>
      </div>

      <div
        ref={trackRef}
        className={cn(
          'relative h-14 touch-none select-none overflow-hidden rounded-md bg-slate-800',
          isBusy && 'pointer-events-none opacity-60',
        )}
      >
        <div className="flex h-full w-full">
          {thumbnails.map((thumbnail, index) => (
            <img
              key={index}
              src={thumbnail}
              alt=""
              aria-hidden
              className="h-full flex-1 object-cover"
              draggable={false}
            />
          ))}
        </div>

        <div
          className="absolute inset-y-0 left-0 bg-black/60"
          style={{ width: `${startPercent}%` }}
        />
        <div
          className="absolute inset-y-0 right-0 bg-black/60"
          style={{ width: `${100 - endPercent}%` }}
        />

        <div
          onPointerDown={startDrag('window')}
          className="absolute inset-y-0 cursor-grab border-y-2 border-yellow-400 active:cursor-grabbing"
          style={{ left: `${startPercent}%`, right: `${100 - endPercent}%` }}
        />

        <div
          role="slider"
          aria-label="Trim start"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={range.start}
          tabIndex={0}
          onPointerDown={startDrag('start')}
          className="absolute inset-y-0 flex w-4 -translate-x-1/2 cursor-ew-resize items-center justify-center"
          style={{ left: `${startPercent}%` }}
        >
          <div className="h-full w-1.5 rounded-full bg-yellow-400" />
        </div>
        <div
          role="slider"
          aria-label="Trim end"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={range.end}
          tabIndex={0}
          onPointerDown={startDrag('end')}
          className="absolute inset-y-0 flex w-4 -translate-x-1/2 cursor-ew-resize items-center justify-center"
          style={{ left: `${endPercent}%` }}
        >
          <div className="h-full w-1.5 rounded-full bg-yellow-400" />
        </div>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={onCancel}
          disabled={isBusy}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="w-full"
          onClick={() => void queueUpload(range)}
          disabled={isBusy}
        >
          {isBusy ? 'Uploading…' : 'Upload'}
        </Button>
      </div>
    </div>
  )
}
