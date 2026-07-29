## 1. Routing and navigation wiring

- [x] 1.1 Add `ALERT_SEGMENT` (and any derived `ROUTES.alert` entry) to `src/AppRoute/constant.tsx`
- [x] 1.2 Add a lazy-loaded route for the Alert page under the existing `worker`-role `RoleGuard` block in `src/AppRoute/index.tsx`, mirroring how `home`/`feed`/`capture`/`learn` are registered
- [x] 1.3 Add an "Alert" entry (Bell icon from `lucide-react`) to the `worker` array in `src/components/ui/bottom-nav/constant.tsx`

## 2. Alert page scaffold

- [x] 2.1 Create `src/pages/worker/Alert/model.tsx` with types for notification/diagnostic state (e.g. permission status, running status, last-fired timestamp, fire count)
- [x] 2.2 Create `src/pages/worker/Alert/helper.tsx` with pure logic: random delay calculation (5000–15000ms), unique tag generation, and the capability-detection check (`'Notification' in window`)
- [x] 2.3 Create `src/pages/worker/Alert/index.tsx`: renders Start/Stop control and the diagnostic panel, wires up state from `helper.tsx`/`model.tsx`

## 3. Notification permission and repeat-loop logic

- [x] 3.1 In the Alert page, implement Start: request `Notification.requestPermission()` from within the click handler if permission is not already granted
- [x] 3.2 On permission granted, implement the self-rescheduling `setTimeout` chain that calls `registration.showNotification()` with a unique tag and title/body/icon, then reschedules itself with a freshly randomized 5–15s delay
- [x] 3.3 On permission denied, update diagnostic state to a "permission denied" status without starting the loop
- [x] 3.4 Implement Stop: cancel the pending scheduled timeout and set diagnostic state to stopped
- [x] 3.5 Update diagnostic state (last-fired time, fire count) on every successful `showNotification()` call

## 4. Capability gating (iOS install requirement)

- [x] 4.1 On Alert page mount, check `'Notification' in window`; if false, disable/hide the Start control and render "Add to Home Screen to enable this" instructions instead
- [x] 4.2 Verify the enabled path (Start visible and functional) covers both a plain Android browser tab and an installed Android PWA with no additional branching

## 5. Service worker notification click handling

- [x] 5.1 Add a `notificationclick` listener to `src/sw.ts` that closes the notification, then focuses an existing app window via `clients.matchAll()` or opens one via `clients.openWindow('/')` if none exists, wrapped in `event.waitUntil()`

## 6. Verification

- [ ] 6.1 Manually verify on Android (Chrome, and at least one of Edge/Opera/Firefox): plain browser tab shows Start enabled; Start fires repeating notifications at randomized intervals; each fire is independently visible (not silently replaced); Stop halts firing; clicking a notification focuses/opens the app
- [ ] 6.2 Manually verify on iOS: in a plain Safari tab, Start is disabled with home-screen instructions shown; after adding to home screen (iOS ≥ 16.4), Start becomes enabled and behaves per the Android verification steps above, with title+body+icon content only
- [ ] 6.3 Verify Stop correctly prevents any further notification after the button is pressed (no race where an already-scheduled fire slips through)
- [ ] 6.4 Confirm no network requests are made by this feature (inspect via browser devtools network tab during a full Start→fire→Stop cycle)
