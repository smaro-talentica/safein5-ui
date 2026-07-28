## Why

We need to understand how far we can get with web-standard push/notification APIs on this PWA
before deciding whether a native wrapper (e.g. Capacitor) is required. There is no backend yet to
issue real push messages, so the fastest way to learn the real platform constraints (permission
prompts, iOS PWA install requirement, service worker display behavior) is a self-contained demo:
a button in the app that triggers a notification locally, with no server round-trip.

## What Changes

- Add a "Trigger test notification" control to the Profile screen (`src/pages/shared/Profile`),
  reachable by any logged-in role.
- Add a `useNotificationPermission` hook (or equivalent) that requests `Notification` permission
  on demand (not on app load) and exposes current permission state (`default` / `granted` /
  `denied`).
- On trigger, show a notification via the registered service worker
  (`ServiceWorkerRegistration.showNotification`) rather than the plain `Notification` constructor,
  so behavior matches what real push would use and works when the PWA is installed/backgrounded.
- Extend `src/sw.ts` with a minimal `notificationclick` handler (focus/open the app) so the demo
  notification is interactive, not just a toast.
- Surface unsupported/denied states in the UI (e.g. iOS Safari without home-screen install, or
  permission previously denied) instead of failing silently.
- No backend, no VAPID keys, no `PushManager.subscribe()`, no real push delivery — that is
  explicitly out of scope until a backend exists to send it.

## Capabilities

### New Capabilities

- `local-notification-demo`: on-demand, client-only triggering of a browser/OS notification via
  the service worker, including permission request/state handling and graceful degradation on
  unsupported platforms.

### Modified Capabilities

(none — no existing spec covers notifications)

## Impact

- Affected code: `src/pages/shared/Profile/`, `src/sw.ts`, new `src/hooks/useNotificationPermission`
  (or similar), `vite-env.d.ts` if new env/typing is needed.
- No new dependencies expected — this uses the standard Notifications API and the existing
  `vite-plugin-pwa` service worker (`injectManifest` strategy already in place).
- No backend/API impact — explicitly deferred until a push server exists.
- Informs the earlier PWA-vs-native discussion: results here (especially iOS Safari behavior)
  are direct input to whether Capacitor becomes necessary for reliable notifications.
