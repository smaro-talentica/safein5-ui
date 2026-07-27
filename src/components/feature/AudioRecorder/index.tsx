import { cn } from '@/utils/cn'
import { Button } from '@/components/ui/button'
import { Circle, Mic, Square } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { MAX_RECORDING_MS } from './constant'
import { formatDuration, pickMimeType } from './helper'
import type { AudioRecorderProps, RecorderStatus } from './model'

export function AudioRecorder({ onRecorded, className }: AudioRecorderProps) {
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

  const beginRecording = useCallback(
    (stream: MediaStream) => {
      chunksRef.current = []
      const mimeType = pickMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        })
        chunksRef.current = []
        setStatus('idle')
        if (blob.size > 0) onRecorded(blob)
      }

      recorder.start()
      setStatus('recording')
      setSecondsLeft(MAX_RECORDING_MS / 1000)
      timerRef.current = window.setTimeout(stopRecording, MAX_RECORDING_MS)
      intervalRef.current = window.setInterval(() => {
        setSecondsLeft((prev) => Math.max(0, prev - 1))
      }, 1000)
    },
    [onRecorded, stopRecording],
  )

  const startRecording = useCallback(async () => {
    setError(null)
    if (streamRef.current) {
      beginRecording(streamRef.current)
      return
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          window.isSecureContext
            ? 'This browser exposes no microphone API.'
            : 'Microphone needs a secure (trusted HTTPS) connection.',
        )
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      beginRecording(stream)
    } catch (err) {
      setStatus('error')
      setError(
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone permission denied. Allow access and try again.'
          : err instanceof Error
            ? err.message
            : 'Could not start the microphone on this device.',
      )
    }
  }, [beginRecording])

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
        <Button variant="outline" className="w-full" onClick={() => void startRecording()}>
          Try again
        </Button>
      </div>
    )
  }

  return (
    <div className={cn('w-full max-w-sm space-y-3', className)}>
      <div className="flex aspect-square w-full items-center justify-center rounded-xl bg-slate-100">
        <div
          className={cn(
            'flex size-20 items-center justify-center rounded-full bg-white shadow-sm',
            status === 'recording' && 'ring-4 ring-red-200',
          )}
        >
          <Mic
            className={cn('size-8', status === 'recording' ? 'text-red-600' : 'text-slate-500')}
            aria-hidden
          />
        </div>
        {status === 'recording' && (
          <span
            className="absolute mt-28 flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-1 text-xs font-medium tabular-nums text-white"
            aria-live="polite"
          >
            <Circle className="size-2.5 animate-pulse fill-red-500 text-red-500" aria-hidden />
            {formatDuration(secondsLeft)}
          </span>
        )}
      </div>

      {status === 'idle' && (
        <Button className="w-full" onClick={() => void startRecording()}>
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
