import { Link, useRouteError } from 'react-router-dom'
import { ROUTES } from '@/AppRoute/constant'
import { NOT_FOUND_CONTENT } from './constant'
import { resolveVariant } from './helper'

export function NotFound() {
  const error = useRouteError()
  const variant = resolveVariant(error)
  const { emoji, heading, message } = NOT_FOUND_CONTENT[variant]

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 bg-white p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl">
        {emoji}
      </div>
      <h1 className="text-xl font-semibold">{heading}</h1>
      <p className="max-w-xs text-sm text-slate-500">{message}</p>
      <Link
        to={ROUTES.root}
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
      >
        Go home
      </Link>
    </div>
  )
}
