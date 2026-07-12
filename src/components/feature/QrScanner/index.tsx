import { cn } from '@/utils/cn'
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser'
import { useEffect, useRef, useState } from 'react'

type QrScannerProps = {
  /**
   * Called for each decoded QR code. Fires repeatedly while scanning (throttled
   * to avoid spamming the same code), so the caller decides how to react — the
   * scanner keeps running so the user can retry after an invalid code.
   */
  onDecode: (text: string) => void
  className?: string
}

/** Ignore a repeat of the same decoded value within this window (ms). */
const REPEAT_THROTTLE_MS = 1500

/**
 * Camera-backed QR scanner. Uses ZXing's canvas decode loop so it works across
 * Android and iOS (including installed PWAs), where the native BarcodeDetector
 * API is unavailable. Prefers the rear camera.
 */
export function QrScanner({ onDecode, className }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const lastRef = useRef<{ text: string; at: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const reader = new BrowserQRCodeReader()
    let controls: IScannerControls | undefined
    let cancelled = false
    let starting = false

    const stop = () => {
      controls?.stop()
      controls = undefined
    }

    const start = async () => {
      // Guard against overlapping starts (e.g. visibility flapping quickly).
      if (cancelled || controls || starting) return
      const video = videoRef.current
      if (!video) return
      starting = true
      try {
        const next = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } } },
          video,
          (result) => {
            if (!result) return
            const text = result.getText()
            const now = performance.now()
            const last = lastRef.current
            if (last && last.text === text && now - last.at < REPEAT_THROTTLE_MS) {
              return
            }
            lastRef.current = { text, at: now }
            onDecode(text)
          },
        )
        if (cancelled) next.stop()
        else controls = next
      } catch (err) {
        setError(
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'Camera permission denied. Allow camera access and reload.'
            : 'Could not start the camera on this device.',
        )
      } finally {
        starting = false
      }
    }

    // When the screen locks or the app is backgrounded, the browser suspends the
    // camera track; on resume ZXing's loop stays alive but never decodes again,
    // so the preview looks frozen. Tear the camera down when hidden and rebuild a
    // fresh session when the page becomes visible again.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void start()
      else stop()
    }

    void start()
    document.addEventListener('visibilitychange', handleVisibility)
    // iOS restores from the bfcache with a `pageshow` (persisted) instead of a
    // visibility change; restart on that too.
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
