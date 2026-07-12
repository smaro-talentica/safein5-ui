import { Link, useSearchParams } from 'react-router-dom'

/**
 * Route 2 — landing page a scanned QR code reroutes to. Displays the `id`
 * decoded from the scanned QR payload, with a Rescan action back to the scanner.
 */
export function ScanLanding() {
  const [searchParams] = useSearchParams()
  const id = searchParams.get('id')

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl">
        ✅
      </div>
      <h1 className="text-xl font-semibold">Scan successful</h1>
      {id && (
        <p className="rounded bg-slate-100 px-3 py-1 font-mono text-xs text-slate-600">id: {id}</p>
      )}
      <Link
        to="/scan?auto=1"
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
      >
        Retry
      </Link>
    </div>
  )
}
