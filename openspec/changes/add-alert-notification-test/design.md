## Context

SafeIn5 UI has no notification code today: `src/sw.ts` is a 13-line `injectManifest` service worker doing only precache/install/activate/skipWaiting; there is no `Notification`/`PushManager` usage anywhere in `src/`. The end goal (a separate, future proposal) is real-time alerts delivered even when the app is closed, which requires Web Push (VAPID + a backend subscription store) — a backend that does not exist yet. This proposal builds the piece that doesn't depend on a backend: proving the permission → display → click pipeline works correctly per platform, using a self-triggered repeating notification instead of a server-sent one.

The core constraint shaping this design is that notification support is **not one API with uniform behavior** — it splits sharply by platform:

- **Android** (Chrome, Edge, Opera, Firefox): `Notification` + `ServiceWorkerRegistration.showNotification()` work in a plain browser tab, no install required. All four browsers behave equivalently for basic title/body/icon notifications.
- **iOS** (Safari, Chrome, Edge, Opera, Firefox — all iOS browsers are WebKit under the hood per Apple's platform policy): `Notification` is `undefined` in a plain browser tab. It only becomes available if the PWA is added to the home screen (manifest `display: standalone`) on iOS ≥ 16.4. There is no plain-tab fallback — this is a hard platform gate, not a progressive-enhancement edge case.

## Goals / Non-Goals

**Goals:**
- Provide an on-device, no-devtools-required way to verify: permission request succeeds, a repeating notification actually displays, tapping it focuses/opens the app, across Android (plain tab + installed) and iOS (installed only).
- Make the iOS install requirement a first-class, explicit UI state rather than a silently non-functional button.
- Structure the notification-firing code so it is easy to extend later: swapping "page-side timer fires showNotification" for "SW push event fires showNotification" should not require touching the `notificationclick` handler or the diagnostic-panel UI.

**Non-Goals:**
- No real WebSocket or Push API (`PushManager.subscribe`, VAPID) integration — no backend exists to talk to.
- No deep-linking a notification click to a specific route. iOS's `clients.openWindow(path)` is documented to ignore the path argument (opens to root or wherever the PWA last was), so the click handler is intentionally path-agnostic on every platform for consistent behavior, even though Android could technically support it.
- No background/closed-app delivery. The repeat loop is a page-side `setTimeout` chain; it stalls when the tab/app backgrounds or closes on every platform, because no page JS runs while suspended. This is disclosed in the UI, not engineered around (engineering around it is impossible without Push API + backend).
- No rich notification content (actions, images, vibration patterns). iOS supports none of these, so content is kept to title + body + icon uniformly rather than branching rich content for Android only.

## Decisions

**1. Fire notifications via `ServiceWorkerRegistration.showNotification()`, not page-level `new Notification()`.**
Only SW-shown notifications get a reliable `notificationclick` event with a service-worker-scoped handler that can run `clients.matchAll()`/`clients.openWindow()`. Page-level `new Notification()` has an `onclick` but it's tied to the page's lifetime and doesn't give the focus-or-open-window pattern needed here. Since click-to-open behavior is an explicit goal, SW-based notification is the only viable choice — this also matches the shape Phase 2 (real Push) will need, since Push-delivered notifications are shown from the SW's `push` handler anyway.

**2. Unique tag per notification fire, not a fixed tag.**
A fixed `tag` silently replaces the previous notification when a new one with the same tag fires — no new alert sound/vibration, so a user could easily see "one notification" and wrongly conclude the repeat loop isn't working. `renotify: true` would fix that for a fixed tag, but Firefox for Android does not support `renotify` at all. A timestamp-based unique tag (e.g. `alert-test-${Date.now()}`) sidesteps the whole problem uniformly: every fire is guaranteed to be a new, visible notification on every browser, at the cost of notifications stacking in the tray if not dismissed — acceptable for a manually-triggered test tool.

**3. Random 5–15s interval implemented as a self-rescheduling `setTimeout` chain, not `setInterval`.**
Each fire schedules the next one with a freshly randomized delay (`5000 + Math.random() * 10000`), rather than one fixed-interval `setInterval`. This is the only way to get a *different* random delay each time; it also means Stop is a single "don't schedule the next one" flag rather than needing to clear a running interval mid-tick.

**4. Capability detection is colocated in the Alert page (`helper.tsx`/`model.tsx`), not extracted into a shared hook.**
Nothing else in the app needs "does this browser support notifications" logic yet. Per the project's convention against premature abstraction, this stays page-local; if a future Phase 2 (or another feature) needs the same detection, it can be lifted into `src/hooks/` at that point, following the existing `useInstallPrompt`/`InstallPromptProvider` pattern already in the codebase.

**5. iOS gating checks `window.navigator.standalone` (iOS-specific) OR `matchMedia('(display-mode: standalone)')` (cross-platform) combined with `'Notification' in window`.**
`'Notification' in window` alone distinguishes "iOS not installed" (false) from "iOS installed" (true) since the API literally doesn't exist until installed — so this single check is actually sufficient to gate the Start button correctly on iOS without separately detecting iOS vs. Android. The standalone-mode checks are used only for the *messaging* shown to the user ("you're on iOS in a browser tab — add to home screen"), not for the functional gate itself.

**6. Notification click handler focuses an existing client or opens root — never a specific path.**
```js
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => 'focus' in c);
      if (existing) return existing.focus();
      return self.clients.openWindow('/');
    })
  );
});
```
Wrapping in `event.waitUntil()` prevents the SW from being terminated mid-handler on Android. `event.notification.close()` ensures the tray entry clears on click across platforms that don't auto-dismiss (notably desktop).

## Risks / Trade-offs

- **[Risk] User expects "closed app → notification" from this feature, since that's the stated end goal.** → Mitigation: proposal.md and the diagnostic panel itself explicitly label this as foreground-only / no-backend, and the panel surfaces actual vs. expected next-fire time so a stalled loop (backgrounded tab) is visibly diagnosable rather than mistaken for a bug.
- **[Risk] iOS users in a plain browser tab see a permanently disabled feature with no clear next step.** → Mitigation: explicit "Add to Home Screen to enable this" messaging when `'Notification' in window` is false, rather than a silently inert button.
- **[Risk] Opera for Android in incognito/private mode has broken notification support.** → Mitigation: no special-cased UI (incognito can't be reliably detected); documented as a known limitation, not engineered around.
- **[Risk] Stacking notifications from unique tags could clutter the tray during extended test runs.** → Mitigation: acceptable for a manually-started/stopped test tool; user can clear the OS notification tray directly. Not a concern for the eventual real Push feature, which will use meaningful, deduped content instead of test filler.
- **[Trade-off] Colocating capability-detection logic in the page instead of a hook risks duplicated logic if Phase 2 needs the same checks.** → Accepted per no-premature-abstraction convention; extraction is a small, low-risk refactor when that need materializes.

## Open Questions

- None blocking — platform behavior, tag strategy, click-routing, and scope boundary were all resolved during exploration. Any remaining unknowns (e.g. exact wording of the diagnostic panel, icon asset choice) are implementation details for tasks.md, not design decisions.
