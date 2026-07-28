## 1. Notification permission hook

- [ ] 1.1 Create `src/hooks/useNotificationPermission/index.tsx` exposing current permission
      state (`default` / `granted` / `denied`), a `request()` function, and an `isSupported`
      flag (`typeof window.Notification !== 'undefined'` and service worker support check)
- [ ] 1.2 Re-read `Notification.permission` on window focus/visibility change so a permission
      changed externally (e.g. via browser site settings) is reflected without a full reload

## 2. Service worker changes

- [ ] 2.1 Add a `message` handler in `src/sw.ts` for a `SHOW_TEST_NOTIFICATION` message type that
      calls `self.registration.showNotification(...)` with a demo title/body/icon
- [ ] 2.2 Add a `notificationclick` listener in `src/sw.ts` that closes the notification and
      focuses an existing client if one matches the app origin, otherwise opens a new window to
      `/`

## 3. Profile screen UI

- [ ] 3.1 Add a "Trigger test notification" `Button` to `src/pages/shared/Profile/index.tsx`
      (or extracted to `src/pages/shared/Profile/helper.tsx`/its own feature component if the
      logic grows beyond a few lines)
- [ ] 3.2 Wire the button's click handler: if unsupported, keep disabled; if `default`, call
      `request()` then proceed only on grant; if `granted`, proceed directly; if `denied`, keep
      disabled
- [ ] 3.3 On proceed, await `navigator.serviceWorker.ready` and `postMessage` the
      `SHOW_TEST_NOTIFICATION` message to the active service worker
- [ ] 3.4 Render the current permission/support state next to the button (e.g. "Notifications
      blocked — enable them in your browser settings" for `denied`, "Notifications not supported
      on this browser" for unsupported)

## 4. Verification

- [ ] 4.1 Add unit tests for `useNotificationPermission` covering `default`/`granted`/`denied`/
      unsupported state derivation (mock `window.Notification`)
- [ ] 4.2 Manually verify in Chrome desktop: click trigger, grant permission, notification
      appears, clicking it focuses the existing tab
- [ ] 4.3 Manually verify on Android Chrome (installed PWA): notification appears and click
      focuses/opens the app
- [ ] 4.4 Manually verify on iOS Safari, both NOT installed to home screen (expect
      "unsupported" state) and installed to home screen (iOS 16.4+, expect it to work), and
      record actual behavior back into the design doc's Risks section if it differs from
      expectations
- [ ] 4.5 Run `npm run lint` and `npm run build` to confirm no type or lint regressions
