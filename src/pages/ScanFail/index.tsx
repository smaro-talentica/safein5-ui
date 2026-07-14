import { Link } from 'react-router-dom'

export function ScanFail() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 bg-white p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl">
        ❌
      </div>
      <h1 className="text-xl font-semibold">Invalid QR code</h1>
      <Link
        to="/scan?auto=1"
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
      >
        Retry
      </Link>
    </div>
  )
}
