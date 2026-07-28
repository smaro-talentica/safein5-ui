## ADDED Requirements

### Requirement: Manual notification trigger
The system SHALL provide a control on the Profile screen that lets any logged-in user manually
trigger a demo notification, with no server round-trip.

#### Scenario: User triggers a notification with permission already granted
- **WHEN** a logged-in user on the Profile screen clicks "Trigger test notification" and
  Notification permission is already `granted`
- **THEN** the system shows a notification via the active service worker registration within the
  same interaction (no additional prompt)

#### Scenario: User triggers a notification with no prior permission decision
- **WHEN** a logged-in user clicks "Trigger test notification" and Notification permission is
  `default` (not yet asked)
- **THEN** the system requests Notification permission first, and only shows the notification if
  the user grants it in that same request

### Requirement: Permission state is visible and re-requestable
The system SHALL surface the current Notification permission state on the Profile screen and
allow the user to re-attempt the request without leaving the page.

#### Scenario: Permission previously denied
- **WHEN** Notification permission is `denied` (previously blocked by the user or platform)
- **THEN** the system disables the trigger action and displays a message explaining notifications
  are blocked, without calling `Notification.requestPermission()` again automatically

#### Scenario: Permission granted after being denied at the OS/browser level
- **WHEN** the user changes the browser/OS setting externally and returns to the Profile screen
- **THEN** the displayed permission state SHALL reflect the current `Notification.permission`
  value on next render/focus, not a stale cached value

### Requirement: Notification shown via service worker
The system SHALL display the demo notification using the registered service worker's
`showNotification`, not the bare `Notification` constructor, so the demo reflects how a real push
notification would be displayed and remains visible when the app is backgrounded or installed as
a PWA.

#### Scenario: Service worker not yet active
- **WHEN** the user triggers the notification before the service worker has finished registering
  (e.g. immediately after a hard reload)
- **THEN** the system waits for `navigator.serviceWorker.ready` before calling
  `showNotification`, rather than failing silently or throwing an unhandled error

### Requirement: Notification click focuses or opens the app
The system SHALL handle clicks on the demo notification by focusing an existing app window/tab if
one is open, or opening a new one to the app's root if not.

#### Scenario: App already open in another tab
- **WHEN** the user clicks the demo notification while the app is already open in a browser tab
  or installed window
- **THEN** the service worker SHALL focus that existing client instead of opening a duplicate tab

### Requirement: Unsupported platforms degrade gracefully
The system SHALL detect when the Notifications API or service worker support is unavailable and
disable the trigger control with an explanatory message, rather than throwing or silently doing
nothing.

#### Scenario: Browser lacks Notification API support
- **WHEN** `window.Notification` is undefined (e.g. some in-app browsers, or iOS Safari when the
  PWA has not been added to the home screen)
- **THEN** the Profile screen disables the "Trigger test notification" control and shows a message
  that this platform/context does not support notifications
