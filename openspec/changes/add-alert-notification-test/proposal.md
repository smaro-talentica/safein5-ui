## Why

The eventual goal is real-time push notifications for workers (e.g. safety alerts) delivered even when the app is closed. That end state requires a backend (WebSocket or Web Push with VAPID), which doesn't exist yet. Before building against a real backend, we need to prove out the client-side notification pipeline — permission requests, OS/browser notification display, and click-to-open behavior — across the fragmented mobile landscape (Android vs. iOS, five browsers each) where support and behavior genuinely differ. Building this as an isolated, no-backend test harness now de-risks the real integration later and gives a concrete on-device tool for verifying platform support as new devices/OS versions are tested.

## What Changes

- Add a new "Alert" page/tab under the worker role (`src/pages/worker/Alert/`), registered in routing and the worker bottom nav.
- The page exposes a Start/Stop control plus a visible diagnostic panel (permission state, install/capability state, running status, last-fired time, fire count) — this is a test tool, so state must be observable on-device without opening devtools.
- Start: requests `Notification` permission (from within the click handler, so it's valid on all platforms including iOS), then begins firing a browser/OS notification via the service worker's `showNotification()` at a random interval between 5–15 seconds, repeating until Stop is pressed. Each fire uses a unique tag so every notification is guaranteed visible (not silently replaced) across browsers, including Firefox for Android which lacks `renotify` support.
- Stop: clears the repeat loop and updates the diagnostic panel.
- The service worker (`src/sw.ts`) gains a `notificationclick` handler that focuses an existing app window if one is open, or opens one if not — intentionally not deep-linking to a specific route, since iOS's `clients.openWindow(path)` is documented to ignore the path.
- The page detects platform capability up front and adapts: Android (any of Chrome/Edge/Opera/Firefox) works in a plain browser tab or installed PWA identically, with no branching needed. iOS (all browsers, since all iOS browsers run on WebKit) has no `Notification` API at all unless the PWA is installed to the home screen on iOS ≥ 16.4 — in that case the page shows an explicit "Add to Home Screen to enable this" state instead of a non-functional Start button.
- Explicitly out of scope (deferred to a future backend-dependent proposal): any real WebSocket connection, Push API subscriptions (`PushManager.subscribe`/VAPID), any server-originated message, and notification click deep-linking to a specific route. This feature does not talk to a network at all — it is a client-only test of the permission/display/click pipeline, and is inherently foreground-only (the repeat loop is a page-side timer that stalls when the tab/app is backgrounded or closed on every platform — a physical limitation of web pages, not a bug to fix here).

## Capabilities

### New Capabilities
- `alert-notification-test`: A worker-role page that lets a user start/stop a repeating local browser/OS notification (no backend, no network), used to verify notification permission, display, and click-to-open behavior across Android and iOS browsers.

### Modified Capabilities
- None — no existing `openspec/specs/` capabilities exist yet in this repo, and no other capability's requirements change.

## Impact

- **New files**: `src/pages/worker/Alert/` (index.tsx, model.tsx, helper.tsx, constant.tsx as warranted).
- **Modified files**: `src/AppRoute/constant.tsx` (new route segment), `src/AppRoute/index.tsx` (new lazy route under the worker `RoleGuard` block), `src/components/ui/bottom-nav/constant.tsx` (new worker nav entry), `src/sw.ts` (new `notificationclick` listener).
- **No backend, API, or dependency changes.** No new npm packages required (Notification API and Service Worker are browser-native).
- **Platform impact**: behavior intentionally differs between Android (works everywhere) and iOS (install-gated) — this is documented in design.md, not hidden.
