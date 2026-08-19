import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  createFireTag,
  formatFiredAt,
  isNotificationSupported,
  randomFireDelayMs,
  waitForServiceWorkerReady,
} from './helper'
import type { AlertDiagnostics } from './model'

const NOTIFICATION_ICON = '/pwa-192.png'

function initialDiagnostics(): AlertDiagnostics {
  const supported = isNotificationSupported()
  return {
    supported,
    permission: supported ? Notification.permission : 'unsupported',
    status: 'stopped',
    fireCount: 0,
    lastFiredAt: null,
    lastError: null,
  }
}

export function Alert() {
  const [diagnostics, setDiagnostics] = useState<AlertDiagnostics>(initialDiagnostics)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const runningRef = useRef(false)

  useEffect(() => {
    return () => {
      runningRef.current = false
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current)
    }
  }, [])

  function scheduleNextFire() {
    timeoutRef.current = setTimeout(fireNotification, randomFireDelayMs())
  }

  async function fireNotification() {
    if (!runningRef.current) return
    try {
      const registration = await waitForServiceWorkerReady()
      await registration.showNotification('Demo App — Test Alert', {
        body: 'This is a test notification fired by the Alert page.',
        icon: NOTIFICATION_ICON,
        tag: createFireTag(),
      })
      setDiagnostics((prev) => ({
        ...prev,
        fireCount: prev.fireCount + 1,
        lastFiredAt: Date.now(),
        lastError: null,
      }))
    } catch (error) {
      setDiagnostics((prev) => ({
        ...prev,
        lastError: error instanceof Error ? error.message : String(error),
      }))
    }
    if (runningRef.current) scheduleNextFire()
  }

  async function handleStart() {
    let permission = Notification.permission
    if (permission === 'default') {
      permission = await Notification.requestPermission()
    }

    if (permission !== 'granted') {
      setDiagnostics((prev) => ({ ...prev, permission, status: 'permission-denied' }))
      return
    }

    runningRef.current = true
    setDiagnostics((prev) => ({ ...prev, permission, status: 'running' }))
    void fireNotification()
  }

  function handleStop() {
    runningRef.current = false
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setDiagnostics((prev) => ({ ...prev, status: 'stopped' }))
  }

  const isRunning = diagnostics.status === 'running'

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-6">
      <div className="flex items-center gap-2">
        <Bell className="size-5 text-slate-900" aria-hidden />
        <h1 className="text-lg font-semibold text-slate-900">Alert</h1>
      </div>

      {!diagnostics.supported ? (
        <div className="space-y-2 rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-900">Notifications aren't available yet</p>
          <p>
            On iOS, notifications only work once this app is added to your home screen. Open the
            share menu and choose &quot;Add to Home Screen&quot;, then reopen the app from there.
          </p>
        </div>
      ) : (
        <>
          <div className="flex gap-3">
            <Button onClick={handleStart} disabled={isRunning} className="flex-1">
              Start
            </Button>
            <Button onClick={handleStop} disabled={!isRunning} variant="outline" className="flex-1">
              Stop
            </Button>
          </div>

          <dl className="space-y-2 rounded-xl border border-slate-200 p-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Status</dt>
              <dd className="font-medium text-slate-900">{diagnostics.status}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Permission</dt>
              <dd className="font-medium text-slate-900">{diagnostics.permission}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Notifications fired</dt>
              <dd className="font-medium text-slate-900">{diagnostics.fireCount}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Last fired</dt>
              <dd className="font-medium text-slate-900">
                {formatFiredAt(diagnostics.lastFiredAt)}
              </dd>
            </div>
            {diagnostics.lastError && (
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Last error</dt>
                <dd className="text-right font-medium text-red-600">{diagnostics.lastError}</dd>
              </div>
            )}
          </dl>

          <p className="text-xs text-slate-400">
            Runs only while this page stays open and in the foreground — the timer pauses if the app
            is backgrounded or closed.
          </p>
        </>
      )}
    </div>
  )
}
