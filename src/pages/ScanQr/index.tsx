import { QrScanner } from '@/components/feature/QrScanner'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { SCAN_TIMEOUT_MS } from './constant'
import { resolveScanTarget } from './helper'

export function ScanQr() {
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const forceDesktop = searchParams.get('force') === '1'
  const [active, setActive] = useState(searchParams.get('auto') === '1')

  useEffect(() => {
    if (!active) return
    const timer = window.setTimeout(() => setActive(false), SCAN_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [active])

  const handleDecode = useCallback(
    (text: string) => {
      const result = resolveScanTarget(text)
      if (result.kind === 'ok') {
        navigate(`/scan/success?id=${encodeURIComponent(result.id)}`)
      } else {
        navigate('/scan/fail')
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
