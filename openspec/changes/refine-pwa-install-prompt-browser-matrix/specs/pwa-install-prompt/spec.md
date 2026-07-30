## ADDED Requirements

### Requirement: Desktop and installed-app suppression
The system SHALL NOT render any install prompt UI on desktop browsers, and SHALL NOT render any install prompt UI when the app is already running as an installed/standalone app.

#### Scenario: Desktop browser
- **WHEN** the app is loaded on a desktop browser (any OS, any browser)
- **THEN** no install prompt UI is rendered

#### Scenario: Already installed
- **WHEN** the app is running in standalone display mode (`display-mode: standalone` matches, or `navigator.standalone` is true on iOS)
- **THEN** no install prompt UI is rendered, regardless of browser or OS

### Requirement: Chromium-standard Android install
On Android, when running in a Chromium-based browser that fires the native `beforeinstallprompt` event (e.g. Chrome, Edge, Samsung Internet), the system SHALL show a working "Install" button that triggers the native install flow.

#### Scenario: Native install prompt available
- **WHEN** the app is loaded on Android in a Chromium-based browser and the browser fires `beforeinstallprompt`
- **THEN** an "Install" button is shown
- **AND** activating the button calls the deferred prompt's `prompt()` and resolves based on `userChoice`

### Requirement: Opera-Android optimistic install with fallback
On Android Opera, the system SHALL treat the browser as PWA-capable and always show an "Install" button, without waiting for `beforeinstallprompt` to fire, because Opera is known to fire this event unreliably despite supporting installation.

#### Scenario: Opera fires the deferred prompt
- **WHEN** the app is loaded on Android Opera and `beforeinstallprompt` fires before the user activates the Install button
- **THEN** activating the button calls the deferred prompt's `prompt()` and performs a real install, same as the Chromium-standard flow

#### Scenario: Opera never fires the deferred prompt
- **WHEN** the app is loaded on Android Opera and no `beforeinstallprompt` event has fired by the time the user activates the Install button
- **THEN** the system falls back in place to manual instructions ("Open ⋮ menu → Add to Home screen") instead of a non-functional button

### Requirement: Firefox-Android unsupported messaging
On Android Firefox, the system SHALL show a "No PWA Support" message with no install button and no manual install instructions, since Firefox does not expose a reliable install path.

#### Scenario: Firefox on Android
- **WHEN** the app is loaded on Android Firefox
- **THEN** the install prompt UI shows a "No PWA Support" message
- **AND** no Install button and no manual "Add to Home screen" instructions are shown

### Requirement: iOS Safari install instructions
On iOS Safari, the system SHALL show instructions to use the Share sheet's "Add to Home Screen" option.

#### Scenario: Safari on iOS
- **WHEN** the app is loaded on iOS in Safari
- **THEN** the install prompt UI shows instructions to tap the Share icon and select "Add to Home Screen"

### Requirement: iOS non-Safari redirect messaging
On iOS in any browser other than Safari (including Chrome-iOS, Edge-iOS, Opera-iOS, Firefox-iOS, or any other WebKit-based browser identified via its distinct UA token), the system SHALL show a message instructing the user to open the site in Safari to install, since these browsers' share sheets do not expose an "Add to Home Screen" option.

#### Scenario: Non-Safari browser on iOS
- **WHEN** the app is loaded on iOS in a browser other than Safari
- **THEN** the install prompt UI shows a message instructing the user to open the site in Safari to install
- **AND** no Share-sheet "Add to Home Screen" instructions are shown
