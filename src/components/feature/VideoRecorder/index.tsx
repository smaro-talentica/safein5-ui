import { cn } from '@/utils/cn'
import { Button } from '@/components/ui/button'
import { Circle, Square, Video } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { MAX_RECORDING_MS } from './constant'
import { formatDuration, pickMimeType } from './helper'
import type { RecorderStatus, VideoRecorderProps } from './model'

export function VideoRecorder({ onRecorded, className }: VideoRecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const intervalRef = useRef<number | null>(null)

  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(MAX_RECORDING_MS / 1000)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const startCamera = useCallback(async () => {
    setError(null)
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          window.isSecureContext
            ? 'This browser exposes no camera API.'
            : 'Camera needs a secure (trusted HTTPS) connection.',
        )
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          aspectRatio: { ideal: 9 / 16 },
          width: { ideal: 720 },
          height: { ideal: 1280 },
        },
        audio: true,
      })
      streamRef.current = stream
      const video = videoRef.current
      if (video) {
        video.setAttribute('playsinline', 'true')
        video.muted = true
        video.srcObject = stream
        await video.play().catch(() => {})
      }
      setStatus('ready')
    } catch (err) {
      setStatus('error')
      setError(
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Camera/microphone permission denied. Allow access and try again.'
          : err instanceof Error
            ? err.message
            : 'Could not start the camera on this device.',
      )
    }
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const stopRecording = useCallback(() => {
    clearTimer()
    recorderRef.current?.stop()
  }, [clearTimer])

  const startRecording = useCallback(() => {
    const stream = streamRef.current
    if (!stream) return
    chunksRef.current = []
    const mimeType = pickMimeType()
    // TODO: MediaRecorder produces the browser's native format (webm/VP9 on Chrome/Android,
    // mov/mp4 on Safari). Once an upload endpoint exists, normalize to H.264/AAC MP4 server-side
    // for universal playback, and transcode to HLS for adaptive streaming at scale.
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    recorderRef.current = recorder

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || 'video/webm',
      })
      chunksRef.current = []
      setStatus('ready')
      if (blob.size > 0) onRecorded(blob)
    }

    recorder.start()
    setStatus('recording')
    setSecondsLeft(MAX_RECORDING_MS / 1000)
    timerRef.current = window.setTimeout(stopRecording, MAX_RECORDING_MS)
    intervalRef.current = window.setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1))
    }, 1000)
  }, [onRecorded, stopRecording])

  useEffect(() => {
    return () => {
      clearTimer()
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop()
      }
      stopStream()
    }
  }, [clearTimer, stopStream])

  if (status === 'error') {
    return (
      <div className={cn('w-full max-w-sm space-y-3', className)}>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
          {error}
        </div>
        <Button variant="outline" className="w-full" onClick={() => void startCamera()}>
          Try again
        </Button>
      </div>
    )
  }

  return (
    <div className={cn('w-full max-w-sm space-y-3', className)}>
      <div className="relative aspect-9/16 w-full overflow-hidden rounded-xl bg-black">
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
        {status === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center text-white/70">
            <Video className="size-10" aria-hidden />
          </div>
        )}
        {status === 'recording' && (
          <>
            <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-1 text-xs font-medium text-white">
              <Circle className="size-2.5 animate-pulse fill-red-500 text-red-500" aria-hidden />
              REC
            </span>
            <span
              className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-1 text-xs font-medium tabular-nums text-white"
              aria-live="polite"
            >
              {formatDuration(secondsLeft)}
            </span>
          </>
        )}
      </div>

      {status === 'idle' && (
        <Button className="w-full" onClick={() => void startCamera()}>
          <Video className="size-4" aria-hidden />
          Start camera
        </Button>
      )}
      {status === 'ready' && (
        <Button className="w-full" onClick={startRecording}>
          <Circle className="size-4 fill-current" aria-hidden />
          Record
        </Button>
      )}
      {status === 'recording' && (
        <Button variant="destructive" className="w-full" onClick={stopRecording}>
          <Square className="size-4 fill-current" aria-hidden />
          Stop recording
        </Button>
      )}
    </div>
  )
}
