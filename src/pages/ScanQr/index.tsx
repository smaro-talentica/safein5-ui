import { QrScanner } from '@/components/feature/QrScanner'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

type ScanResult = { kind: 'ok'; id: string } | { kind: 'invalid' }

/** Give up and return to idle if no QR is decoded within this window (ms). */
const SCAN_TIMEOUT_MS = 30_000

/**
 * Route 1 — QR scanner. Only usable on a phone/tablet (needs a rear camera);
 * on laptop/desktop it renders a "mobile only" notice instead of the camera.
 * Append `?force=1` to bypass the gate on desktop (webcam) for local testing.
 *
 * The camera stays off until the user presses Scan. Once scanning, one of three
 * things happens: a valid QR routes to `/landing` with its `id`, an invalid QR
 * routes to `/failed`, or 30s elapse with nothing found and the page returns to
 * its idle (camera off) state.
 */
export function ScanQr() {
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const forceDesktop = searchParams.get('force') === '1'
  // Camera only runs while active; starts off so nothing scans until Scan is hit.
  // Arriving with `?auto=1` (e.g. a Retry from /landing or /failed) opens the
  // camera immediately, skipping the idle Scan button.
  const [active, setActive] = useState(searchParams.get('auto') === '1')

  // Stop scanning after SCAN_TIMEOUT_MS with no result and return to idle.
  useEffect(() => {
    if (!active) return
    const timer = window.setTimeout(() => setActive(false), SCAN_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [active])

  const handleDecode = useCallback(
    (text: string) => {
      const result = resolveScanTarget(text)
      if (result.kind === 'ok') {
        navigate(`/landing?id=${encodeURIComponent(result.id)}`)
      } else {
        navigate('/failed')
      }
    },
    [navigate],
  )

  const handleScan = useCallback(() => setActive(true), [])

  if (!isMobile && !forceDesktop) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-xl font-semibold">Open this on your phone</h1>
        <p className="max-w-sm text-sm text-slate-500">
          QR scanning uses your device camera and is only available on a mobile device. Please open
          this page on your phone to continue.
        </p>
        <p className="max-w-sm text-xs text-slate-400">
          Testing on desktop? Append <code>?force=1</code> to the URL to use your webcam.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-4 p-4">
      <h1 className="text-lg font-semibold">Scan QR code</h1>
      <p className="text-sm text-slate-500">
        {active
          ? 'Point your camera at the QR code to continue.'
          : 'Press Scan to turn on the camera.'}
      </p>
      {active ? (
        <QrScanner onDecode={handleDecode} />
      ) : (
        <>
          <div className="flex aspect-square w-full max-w-sm items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-400">
            Camera is off
          </div>
          <button
            type="button"
            onClick={handleScan}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Scan
          </button>
        </>
      )}
    </div>
  )
}

/**
 * Classifies a decoded QR payload. A redirect only happens when the payload is
 * a JSON object carrying a non-empty string `id`; every other payload (non-JSON,
 * wrong shape, or missing `id`) is rejected as invalid.
 */
function resolveScanTarget(text: string): ScanResult {
  const value = text.trim()
  if (!value) return { kind: 'invalid' }

  let payload: unknown
  try {
    payload = JSON.parse(value)
  } catch {
    return { kind: 'invalid' }
  }

  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('id' in payload) ||
    typeof (payload as { id: unknown }).id !== 'string' ||
    !(payload as { id: string }).id.trim()
  ) {
    return { kind: 'invalid' }
  }

  return { kind: 'ok', id: (payload as { id: string }).id }
}
