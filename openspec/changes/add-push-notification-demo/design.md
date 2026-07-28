## Context

The app is a role-gated PWA (`vite-plugin-pwa`, `injectManifest` strategy) with a custom service
worker at `src/sw.ts` that currently only does precaching and `skipWaiting`/`clients.claim`
lifecycle handling — no notification listeners exist yet. There is no backend, so there is no
push server, no VAPID key pair, and no `PushManager.subscribe()` flow. The goal of this change is
narrower than "push notifications": it is a local, client-only demo that exercises the same
display path (permission → service worker → `showNotification` → `notificationclick`) that a real
push message would use later, so we learn the platform constraints (especially iOS Safari) before
investing in a backend or a native wrapper (see prior PWA-vs-Capacitor discussion).

## Goals / Non-Goals

**Goals:**
- Let any logged-in user trigger a notification from the UI with one click, entirely client-side.
- Request permission lazily (on click), not on app load, to avoid an unsolicited prompt.
- Route the notification through the service worker (`registration.showNotification`), so the
  demo is representative of how real push notifications would render and behave when the app is
  backgrounded/installed.
- Make permission state (`default` / `granted` / `denied`) visible in the UI and handle all three
  without crashing.
- Handle the notification's `notificationclick` in the SW to focus/open the app window.
- Degrade gracefully (disabled control + message) where the Notifications API isn't available.

**Non-Goals:**
- No real push delivery, no `PushManager.subscribe()`, no VAPID keys, no push payload from a
  server — there is no backend to send anything, and building one is out of scope here.
- No persistence of permission state or notification history — this is a live demo, not a
  notification center/inbox.
- No cross-device or cross-tab notification targeting logic beyond the single
  focus-or-open-client behavior described in the spec.
- No attempt to work around iOS Safari's requirement that the PWA be added to the home screen —
  we surface that limitation via the "unsupported" state rather than defeat it.

## Decisions

**Trigger location: Profile screen, not a new route.**
`Profile` (`src/pages/shared/Profile`) is reachable by every role and already renders
user/account-level actions (sign out). A demo/utility control fits there without inventing a new
route or nav entry. Alternative considered: a dedicated `/notifications-demo` route — rejected as
unnecessary surface area for a throwaway demo control.

**Display via `ServiceWorkerRegistration.showNotification`, not `new Notification()`.**
The plain `Notification` constructor works on desktop but is unreliable/unsupported for
foreground-only pages on some mobile browsers, and critically does **not** match how a real push
notification is displayed (push events can only call `registration.showNotification` from the SW,
not the page). Using the SW path now means the demo's behavior (and its gaps) transfer directly to
a future real-push implementation. Alternative considered: page-level `Notification` API for
simplicity — rejected because it would teach us the wrong platform lessons.

**Permission requested on click, inline with the trigger action.**
Browsers increasingly gate or auto-deny permission prompts not triggered by a direct user gesture,
and requesting on load is a well-known bad UX pattern users have learned to distrust/deny
reflexively. Requesting inside the same click handler as the trigger keeps it a single user
gesture and avoids a separate "enable notifications" step.

**New `useNotificationPermission` hook rather than inlining state in `Profile`.**
Permission-state logic (read `Notification.permission`, expose a `request()` function, expose
support detection) is generic enough to reuse if a real push-subscription flow lands later, and
keeps `Profile/index.tsx` focused on rendering. Lives at `src/hooks/useNotificationPermission`
per the existing (currently-empty) `hooks` alias.

**Minimal `notificationclick` handler added directly to `src/sw.ts`.**
Given the SW is small today, a focus-or-open-client listener is added inline rather than split
into a separate module — consistent with "don't add abstraction beyond what's needed."

## Risks / Trade-offs

- **[Risk] iOS Safari won't show notifications unless the PWA is installed to the home screen.**
  → Mitigation: this is exactly the constraint we want to surface. The "unsupported" UI state
  documents it directly rather than hiding the limitation; it's a primary output of this demo, not
  a bug to fix.
- **[Risk] Demo teaches false confidence — local `showNotification` succeeding doesn't guarantee a
  real push payload will work once a backend exists (delivery, wake-from-terminated-state, and
  payload decryption are separate concerns).**
  → Mitigation: proposal and this design explicitly scope out `PushManager`/VAPID; do not present
  this demo as proof push-from-server will work.
- **[Risk] Requesting permission on click still gets denied, permanently blocking future prompts
  in most browsers until the user manually resets site permissions.**
  → Mitigation: the spec requires surfacing `denied` state clearly with guidance, rather than
  repeatedly calling `requestPermission()`.

## Open Questions

- None blocking implementation. If a real backend/push-server track starts later, revisit whether
  `useNotificationPermission` should be extended to cover `PushManager.subscribe()` or whether a
  separate capability/spec is cleaner.
