import { cn } from '@/utils/cn'
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser'
import { useEffect, useRef, useState } from 'react'
import { REPEAT_THROTTLE_MS } from './constant'
import type { QrScannerProps } from './model'

export function QrScanner({ onDecode, className }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const lastRef = useRef<{ text: string; at: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const reader = new BrowserQRCodeReader()
    let controls: IScannerControls | undefined
    let cancelled = false
    let starting = false

    let stream: MediaStream | undefined

    const stop = () => {
      controls?.stop()
      controls = undefined
      stream?.getTracks().forEach((track) => track.stop())
      stream = undefined
    }

    const start = async () => {
      if (cancelled || controls || starting) return
      const video = videoRef.current
      if (!video) return
      starting = true
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error(
            window.isSecureContext
              ? 'This browser exposes no camera API.'
              : 'Camera needs a secure (trusted HTTPS) connection. Open this page over HTTPS with a trusted certificate.',
          )
        }

        const media = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (cancelled) {
          media.getTracks().forEach((track) => track.stop())
          return
        }
        stream = media
        video.setAttribute('playsinline', 'true')
        video.muted = true
        video.srcObject = media
        await new Promise<void>((resolve) => {
          if (video.readyState >= 2) return resolve()
          video.addEventListener('loadedmetadata', () => resolve(), { once: true })
        })
        await video.play().catch(() => {})

        const next = await reader.decodeFromVideoElement(video, (result) => {
          if (!result) return
          const text = result.getText()
          const now = performance.now()
          const last = lastRef.current
          if (last && last.text === text && now - last.at < REPEAT_THROTTLE_MS) {
            return
          }
          lastRef.current = { text, at: now }
          onDecode(text)
        })
        if (cancelled) next.stop()
        else controls = next
      } catch (err) {
        setError(
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'Camera permission denied. Allow camera access and reload.'
            : err instanceof Error
              ? err.message
              : 'Could not start the camera on this device.',
        )
      } finally {
        starting = false
      }
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void start()
      else stop()
    }

    void start()
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('pageshow', handleVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('pageshow', handleVisibility)
      stop()
    }
  }, [onDecode])

  if (error) {
    return (
      <div className="max-w-sm rounded-lg border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
        {error}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative aspect-square w-full max-w-sm overflow-hidden rounded-xl bg-black',
        className,
      )}
    >
      <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
      <div className="pointer-events-none absolute inset-8 rounded-lg border-2 border-white/70" />
    </div>
  )
}
