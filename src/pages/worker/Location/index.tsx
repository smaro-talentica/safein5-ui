import { useCallback, useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'
import {
  describeGeolocationError,
  describeStatus,
  formatAccuracy,
  formatCoordinate,
  formatFixedAt,
  formatHeading,
  formatSpeed,
  isGeolocationSupported,
  queryGeolocationPermission,
  toLocationFix,
} from './helper'
import type { LocationDiagnostics } from './model'

const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15_000,
  // Live tracking wants fresh fixes, not a cached one replayed on every update.
  maximumAge: 0,
}

function initialDiagnostics(): LocationDiagnostics {
  return {
    supported: isGeolocationSupported(),
    permission: 'unknown',
    status: 'idle',
    fix: null,
    updateCount: 0,
    error: null,
  }
}

export function Location() {
  const [diagnostics, setDiagnostics] = useState<LocationDiagnostics>(initialDiagnostics)
  const watchIdRef = useRef<number | null>(null)
  const mountedRef = useRef(true)

  const startWatching = useCallback(() => {
    if (!isGeolocationSupported() || watchIdRef.current !== null) return
    setDiagnostics((prev) => ({ ...prev, status: 'locating', error: null }))

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        if (!mountedRef.current) return
        setDiagnostics((prev) => ({
          ...prev,
          permission: 'granted',
          status: 'watching',
          fix: toLocationFix(position),
          updateCount: prev.updateCount + 1,
          error: null,
        }))
      },
      (error) => {
        if (!mountedRef.current) return
        // Only PERMISSION_DENIED means the permission was refused. TIMEOUT and
        // POSITION_UNAVAILABLE are routine on a real phone (indoors, basement,
        // cold GPS start) and happen with permission fully granted — treating
        // them as a denial would wrongly offer a re-approve button that cannot
        // re-prompt, and would hide a watch that is still alive and retrying.
        const denied = error.code === error.PERMISSION_DENIED
        // A denial ends the watch permanently — the callback never fires again,
        // so release the id rather than leaving a dead watch registered. Cleared
        // inline to keep this callback free of any render-scoped closure.
        if (denied && watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current)
          watchIdRef.current = null
        }
        setDiagnostics((prev) => ({
          ...prev,
          // A transient failure still proves the permission exists — the browser
          // would have reported PERMISSION_DENIED otherwise.
          permission: denied ? 'denied' : 'granted',
          status: denied ? 'error' : 'waiting',
          error: describeGeolocationError(error),
        }))
      },
      GEOLOCATION_OPTIONS,
    )
  }, [])

  // Probe geolocation directly on mount rather than waiting for a tap. Safari
  // implements no Permissions API for geolocation, so a direct call is the only
  // way to discover the state there — and where permission already exists this
  // starts tracking with no interaction at all.
  //
  // Trade-off, deliberate: on a browser where the state is still 'prompt', this
  // fires the system permission dialog on page load with no in-app context
  // beforehand. The permission query below is still run in parallel so that,
  // where it IS supported, the UI knows the real state instead of inferring it.
  useEffect(() => {
    mountedRef.current = true
    let cancelled = false

    startWatching()

    void queryGeolocationPermission().then((permission) => {
      if (cancelled || !mountedRef.current) return
      // Never downgrade a state the geolocation callbacks have already proven:
      // they are authoritative, this query is only a hint for the initial paint.
      setDiagnostics((prev) => (prev.permission === 'unknown' ? { ...prev, permission } : prev))
    })

    return () => {
      cancelled = true
      mountedRef.current = false
      // Release the OS-level location subscription on unmount — leaving a watch
      // registered keeps the device acquiring fixes after the page is gone.
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [startWatching])

  const { permission, status, fix } = diagnostics
  // The watch is probed automatically on mount, so no approve button is needed in
  // the normal path. It reappears only where the probe could not leave a live
  // watch running: a denial (which the button cannot fix — see the notice below)
  // is excluded, leaving a genuine retry after the watch was torn down.
  const watchIsLive = status === 'locating' || status === 'watching' || status === 'waiting'
  const showRetry = !watchIsLive && permission !== 'denied'

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-6">
      <div className="flex items-center gap-2">
        <MapPin className="size-5 text-slate-900" aria-hidden />
        <h1 className="text-lg font-semibold text-slate-900">Location</h1>
      </div>

      {!diagnostics.supported ? (
        <div className="space-y-2 rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-900">Location isn&apos;t available</p>
          <p>
            This browser doesn&apos;t expose the Geolocation API, or the page isn&apos;t running in
            a secure context. Open the app over HTTPS and try again.
          </p>
        </div>
      ) : (
        <>
          {showRetry && <Button onClick={startWatching}>Approve permission</Button>}

          {permission === 'denied' && (
            <div className="space-y-2 rounded-xl border border-dashed border-red-200 p-4 text-sm text-slate-600">
              <p className="font-medium text-slate-900">Location permission is blocked</p>
              <p>
                This site can&apos;t ask again — browsers remember a denial. Re-enable location for
                this site in your browser settings, then reload the page.
              </p>
            </div>
          )}

          <dl className="space-y-2 rounded-xl border border-slate-200 p-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Status</dt>
              <dd className="font-medium text-slate-900">{describeStatus(status)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Latitude</dt>
              <dd className="font-medium text-slate-900">
                {fix ? formatCoordinate(fix.latitude) : '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Longitude</dt>
              <dd className="font-medium text-slate-900">
                {fix ? formatCoordinate(fix.longitude) : '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Accuracy</dt>
              <dd className="font-medium text-slate-900">
                {fix ? formatAccuracy(fix.accuracy) : '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Heading</dt>
              <dd className="font-medium text-slate-900">
                {fix ? formatHeading(fix.heading) : '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Speed</dt>
              <dd className="font-medium text-slate-900">{fix ? formatSpeed(fix.speed) : '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Updates</dt>
              <dd className="font-medium text-slate-900">{diagnostics.updateCount}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Last update</dt>
              <dd className="font-medium text-slate-900">
                {formatFixedAt(fix?.timestamp ?? null)}
              </dd>
            </div>
            {diagnostics.error && (
              <div className="flex justify-between gap-2">
                {/* A transient failure is amber "Last issue", not a red error —
                    the watch is still alive and may recover on the next fix. */}
                <dt className="text-slate-500">{status === 'waiting' ? 'Last issue' : 'Error'}</dt>
                <dd
                  className={cn(
                    'text-right font-medium',
                    status === 'waiting' ? 'text-amber-600' : 'text-red-600',
                  )}
                >
                  {diagnostics.error}
                </dd>
              </div>
            )}
          </dl>

          <p className="text-xs text-slate-400">
            Updates live as the device moves, while this page stays open and in the foreground —
            tracking pauses if the app is backgrounded or closed.
          </p>
        </>
      )}
    </div>
  )
}
