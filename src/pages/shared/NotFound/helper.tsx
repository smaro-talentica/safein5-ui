import { isRouteErrorResponse } from 'react-router-dom'
import type { NotFoundVariant } from './model'

/**
 * `NotFound` is used two ways: as the `*` catch-all route's plain element (no
 * error at all — `error` is undefined) and as `errorElement` for real router
 * errors. Only a genuine non-404 error should show the "something went wrong"
 * copy; everything else (undefined, or an actual 404 ErrorResponse) is a
 * not-found case.
 */
export function resolveVariant(error: unknown): NotFoundVariant {
  if (error === undefined) return 'not-found'
  if (isRouteErrorResponse(error)) return error.status === 404 ? 'not-found' : 'error'
  return 'error'
}
