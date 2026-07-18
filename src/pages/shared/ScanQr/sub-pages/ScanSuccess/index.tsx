import { Link, useSearchParams } from 'react-router-dom'
import { to } from '@/AppRoute/helper'

export function ScanSuccess() {
  const [searchParams] = useSearchParams()
  const id = searchParams.get('id')

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center bg-white">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl">
        ✅
      </div>
      <h1 className="text-xl font-semibold">Scan successful</h1>
      {id && (
        <p className="rounded bg-slate-100 px-3 py-1 font-mono text-xs text-slate-600">id: {id}</p>
      )}
      <Link
        to={to.scanAuto()}
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
      >
        Retry
      </Link>
    </div>
  )
}
