import { useCallback, useEffect, useRef, useState } from 'react'
import { env } from '@/utils/env'
import { cn } from '@/utils/cn'
import { extensionForMime, pickRecorderMimeType } from '@/utils/upload/recorder'

/**
 * VideoRecorder — in-app camera capture with a hard duration limit.
 *
 * Uses getUserMedia + MediaRecorder with a live countdown that auto-stops at
 * the configured max (default 30s), enforcing the limit at capture time. On
 * stop it hands the recorded Blob (and its measured duration) back via onCapture.
 */
export interface VideoRecorderProps {
  onCapture: (result: { blob: Blob; filename: string; durationSec: number }) => void
  onClose: () => void
  className?: string
}

type RecState = 'idle' | 'requesting' | 'ready' | 'recording' | 'error'

export function VideoRecorder({ onCapture, onClose, className }: VideoRecorderProps) {
  const maxSec = env.uploadMaxDurationSec
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const startedAtRef = useRef<number>(0)

  const [state, setState] = useState<RecState>('requesting')
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Acquire camera on mount.
  useEffect(() => {
    let cancelled = false
    navigator.mediaDevices
      ?.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.muted = true
        }
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) {
          setError('Camera access is required to record. Please allow permission.')
          setState('error')
        }
      })
    return () => {
      cancelled = true
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
      stopStream()
    }
  }, [stopStream])

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startRecording = useCallback(() => {
    const stream = streamRef.current
    if (!stream) return
    const mimeType = pickRecorderMimeType()
    if (!mimeType) {
      setError('Recording is not supported on this browser. Choose a file instead.')
      setState('error')
      return
    }
    chunksRef.current = []
    const recorder = new MediaRecorder(stream, { mimeType })
    recorderRef.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      const durationSec = Math.min(maxSec, (Date.now() - startedAtRef.current) / 1000)
      const blob = new Blob(chunksRef.current, { type: mimeType })
      stopStream()
      const filename = `recording-${startedAtRef.current}.${extensionForMime(mimeType)}`
      onCapture({ blob, filename, durationSec })
    }

    startedAtRef.current = Date.now()
    recorder.start(1000) // gather data every second
    setState('recording')
    setElapsed(0)

    timerRef.current = window.setInterval(() => {
      const secs = (Date.now() - startedAtRef.current) / 1000
      setElapsed(secs)
      if (secs >= maxSec) stopRecording() // hard 30s auto-stop
    }, 100)
  }, [maxSec, onCapture, stopRecording, stopStream])

  const remaining = Math.max(0, maxSec - elapsed)

  return (
    <div className={cn('fixed inset-0 z-60 flex h-dvh flex-col bg-black text-white', className)}>
      <div className="flex shrink-0 items-center justify-between p-4">
        <button type="button" onClick={onClose} className="text-sm font-medium">
          Cancel
        </button>
        <span className="text-sm font-semibold tabular-nums">
          {state === 'recording' ? `${remaining.toFixed(0)}s left` : `Max ${maxSec}s`}
        </span>
        <span className="w-12" />
      </div>

      <div className="relative min-h-0 flex-1">
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
        {state === 'recording' && (
          <div className="absolute top-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/50 px-3 py-1">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
            <span className="text-xs font-semibold tabular-nums">{elapsed.toFixed(1)}s</span>
          </div>
        )}
        {(state === 'requesting' || state === 'idle') && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm">
            Starting camera…
          </div>
        )}
        {state === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm">
            {error}
          </div>
        )}
      </div>

      <div
        className="flex shrink-0 items-center justify-center px-8 pt-6 pb-8"
        style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
      >
        {state === 'recording' ? (
          <button
            type="button"
            onClick={stopRecording}
            aria-label="Stop recording"
            className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white"
          >
            <span className="h-7 w-7 rounded bg-red-500" />
          </button>
        ) : (
          <button
            type="button"
            onClick={startRecording}
            disabled={state !== 'ready'}
            aria-label="Start recording"
            className="h-20 w-20 rounded-full border-4 border-white bg-red-500 disabled:opacity-40"
          />
        )}
      </div>
    </div>
  )
}
