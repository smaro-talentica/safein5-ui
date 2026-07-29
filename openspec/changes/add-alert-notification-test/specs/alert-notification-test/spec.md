## ADDED Requirements

### Requirement: Alert page accessible to worker role
The system SHALL provide an "Alert" page reachable from the worker bottom navigation, visible only to users with the `worker` role.

#### Scenario: Worker opens the Alert tab
- **WHEN** a logged-in user with role `worker` taps the "Alert" tab in the bottom navigation
- **THEN** the system navigates to the Alert page showing a Start/Stop control and a diagnostic panel

#### Scenario: Non-worker role has no Alert tab
- **WHEN** a logged-in user with role `supervisor` or `admin` views the bottom navigation
- **THEN** no "Alert" tab is shown

### Requirement: Capability detection gates the Start control
The system SHALL detect whether the current browser context supports showing notifications before enabling the Start control, and SHALL present an actionable message instead of a non-functional control when unsupported.

#### Scenario: Notification API unavailable (e.g. iOS browser tab, not installed)
- **WHEN** the Alert page loads and `Notification` is not available in the current context
- **THEN** the system disables the Start control and displays instructions to add the app to the home screen to enable notifications

#### Scenario: Notification API available (Android browser/PWA, or installed iOS PWA on iOS 16.4+)
- **WHEN** the Alert page loads and `Notification` is available in the current context
- **THEN** the system enables the Start control

### Requirement: Start begins a repeating local test notification
The system SHALL, when the Start control is activated, request notification permission if not already granted, and upon grant begin showing a browser/OS notification at a random interval between 5 and 15 seconds, repeating until Stop is activated.

#### Scenario: Permission not yet requested
- **WHEN** the user presses Start and notification permission has not yet been decided
- **THEN** the system requests permission from within the click handler

#### Scenario: Permission granted
- **WHEN** notification permission is granted (immediately or after the Start-triggered request)
- **THEN** the system shows a notification via the service worker, then schedules the next notification after a newly randomized delay between 5 and 15 seconds, and repeats this until Stop is activated

#### Scenario: Permission denied
- **WHEN** the user presses Start and notification permission is denied
- **THEN** the system does not start the repeat loop and the diagnostic panel shows a "permission denied" status

#### Scenario: Each fired notification is independently visible
- **WHEN** a new notification is shown while a previous one from this session is still present
- **THEN** the previous notification remains visible and the new one also becomes visible (no silent replacement)

### Requirement: Stop halts the repeat loop
The system SHALL, when the Stop control is activated, cancel any pending scheduled notification and prevent further notifications from firing until Start is pressed again.

#### Scenario: Stop pressed while running
- **WHEN** the user presses Stop while the repeat loop is active
- **THEN** the system cancels the next scheduled notification fire and updates the diagnostic panel to a stopped status

### Requirement: Diagnostic panel reflects real-time state
The system SHALL display, on the Alert page itself, the current permission status, running/stopped status, the time of the last fired notification, and a count of notifications fired in the current session.

#### Scenario: Diagnostic panel updates on each fire
- **WHEN** a notification is shown
- **THEN** the diagnostic panel updates the last-fired time and increments the fire count

### Requirement: Notification click focuses or opens the app
The system SHALL, when a fired notification is clicked, focus an existing open window of the app if one exists, or open a new window at the application root if none exists.

#### Scenario: App already open in another tab/window
- **WHEN** the user taps a fired notification while the app is open in an existing browser tab or window
- **THEN** the system focuses that existing tab/window

#### Scenario: App not currently open
- **WHEN** the user taps a fired notification while no window of the app is open
- **THEN** the system opens a new window at the application root

### Requirement: Feature operates without any network/backend dependency
The system SHALL implement Start, Stop, notification firing, and click handling entirely client-side, without establishing any WebSocket connection, Push API subscription, or other network call to a backend.

#### Scenario: Notifications continue firing with no network connectivity
- **WHEN** the device has no network connectivity and the user presses Start
- **THEN** the repeat loop still fires notifications on schedule, since no network call is involved
