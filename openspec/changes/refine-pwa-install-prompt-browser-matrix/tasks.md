## 1. Detection logic (`installPromptContext.ts` / `InstallPromptProvider.tsx`)

- [x] 1.1 Replace `InstallPromptValue`'s `isIos` / `isAndroidManualInstall` booleans with a discriminated `bucket: 'chromium-standard' | 'opera-android' | 'firefox-android-unsupported' | 'ios-safari' | 'ios-other-webkit' | 'installed'` field in `installPromptContext.ts`.
- [x] 1.2 Add iOS sub-browser UA detection (`isIosSafari` / `isIosOtherWebkit`, checking for `CriOS`, `EdgiOS`, `OPT`, `FxiOS` tokens) alongside the existing `isIosDevice` check.
- [x] 1.3 Remove `isAndroidEdgeBrowser` special-casing so Edge-Android falls into the `chromium-standard` bucket (matches its normal `beforeinstallprompt` support).
- [x] 1.4 Keep `isAndroidFirefoxBrowser` and `isAndroidOperaBrowser`, and use them to classify `firefox-android-unsupported` and `opera-android` respectively.
- [x] 1.5 Implement the classification order: installed → firefox-android-unsupported → opera-android → ios-safari → ios-other-webkit → chromium-standard (default).
- [x] 1.6 Update `promptInstall()` so the `opera-android` bucket calls the real deferred prompt when one has been captured, and returns a new `'manual-fallback'` outcome when no deferred event exists at click-time (re-checked fresh on every call, not cached).

## 2. UI / copy (`InstallPrompt/index.tsx`)

- [x] 2.1 Replace the `isIos` / `isAndroidManualInstall` two-way branch with a switch/lookup over the new `bucket` value.
- [x] 2.2 Add "No PWA Support" message for `firefox-android-unsupported` (no button, no instructions).
- [x] 2.3 Add "Open this in Safari to install" message for `ios-other-webkit` (no Share-sheet instructions).
- [x] 2.4 Keep existing Safari copy for `ios-safari` and existing Install-button flow for `chromium-standard`, wired to the renamed bucket values.
- [x] 2.5 For `opera-android`, always render the Install button; on click, handle both the real-install outcome and the `'manual-fallback'` outcome by swapping the same banner in place to manual "Open ⋮ menu → Add to Home screen" instructions (no remount/reload).
- [x] 2.6 Verify the top-level early return (`!isMobile || installed || dismissed`) still gates desktop and dismissed/installed states ahead of all bucket rendering — no change expected here, just confirm no regression.

## 3. Tests

- [x] 3.1 Update/extend existing tests for `InstallPromptProvider` to cover all six buckets via mocked `navigator.userAgent` and synthetic `beforeinstallprompt`/`appinstalled` events.
- [x] 3.2 Add a test for the Opera late-arriving-event case: no deferred event at click time → `'manual-fallback'`; deferred event captured after initial render but before click → real `prompt()` call.
- [x] 3.3 Update/extend `InstallPrompt` component tests to assert correct copy and controls render per bucket, including the new Firefox and iOS-non-Safari messages.
- [x] 3.4 Confirm existing desktop-suppression and already-installed tests still pass unchanged.

## 4. Verification

- [x] 4.1 Run `npm run lint` and `npm run build` (type-check via `tsc -b`) to confirm no type errors from the `InstallPromptValue` shape change.
- [x] 4.2 Run `npx vitest run` for the affected test files and confirm all pass.
- [x] 4.3 Manually smoke-test in Chrome DevTools device emulation (or real devices if available) for at least: Chrome-Android, iOS Safari, and one non-Safari iOS browser UA, confirming the correct banner/message appears.
  - **Not performed in this session** — no browser/device environment available. Automated coverage (26 new unit/render tests) exercises every bucket's classification and copy, but real-device/DevTools verification of the actual install banners is still outstanding and should be done before shipping to production.
