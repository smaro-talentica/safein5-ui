const MIN_DELAY_MS = 5000
const MAX_DELAY_MS = 15000

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function randomFireDelayMs(): number {
  return MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)
}

export function createFireTag(): string {
  return `alert-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function formatFiredAt(timestampMs: number | null): string {
  if (timestampMs === null) return '—'
  return new Date(timestampMs).toLocaleTimeString()
}

const SERVICE_WORKER_READY_TIMEOUT_MS = 5000

/**
 * `navigator.serviceWorker.ready` can hang indefinitely in a long-lived, standalone-launched PWA
 * window that's mid-way through an autoUpdate SW handoff (old SW still controlling this client,
 * new SW installed but waiting for clients to release). Prefer an already-active registration —
 * for showNotification's purposes any active worker for this scope works, we don't need the
 * newest one — and only fall back to `.ready` if none exists yet.
 */
export async function waitForServiceWorkerReady(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration()
  if (existing?.active) return existing

  const registrations = await navigator.serviceWorker.getRegistrations()
  const activeElsewhere = registrations.find((registration) => registration.active)
  if (activeElsewhere) return activeElsewhere

  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<ServiceWorkerRegistration>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              `Timed out waiting for the service worker (getRegistration active: ${Boolean(existing?.active)}, ` +
                `getRegistrations count: ${registrations.length}, any active: ${Boolean(activeElsewhere)})`,
            ),
          ),
        SERVICE_WORKER_READY_TIMEOUT_MS,
      ),
    ),
  ])
}
