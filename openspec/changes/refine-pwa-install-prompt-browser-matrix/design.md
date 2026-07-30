## Context

`InstallPromptProvider` (`src/hooks/InstallPromptProvider.tsx`) currently exposes a flat `InstallPromptValue`:

```ts
{ canInstall, isIos, isAndroidManualInstall, installed, promptInstall }
```

`isAndroidManualInstall` is `true` for Firefox, Opera, *and* Edge on Android alike (`isAndroidFirefoxBrowser() || isAndroidOperaBrowser() || isAndroidEdgeBrowser()`), all rendered with identical "Open ⋮ menu → Add to Home screen" copy in `InstallPrompt/index.tsx`. `isIos` is `true` for any iOS UA regardless of which browser, rendered with identical "Tap Share → Add to Home Screen" copy. This proposal replaces both flat booleans with a discriminated `bucket` so the provider (detection) and the component (copy/behavior) stay cleanly separated per the six real outcomes.

## Goals / Non-Goals

**Goals:**
- Classify every Android/iOS browser combination into exactly one of six mutually exclusive buckets and drive UI purely off that classification.
- Preserve all currently-correct behavior: Chromium-standard install, iOS Safari instructions, desktop suppression, installed-state suppression.
- Make Opera's fallback (button always shown, behavior decided at click-time based on whether a deferred event exists) explicit and testable rather than folded into a generic "manual install" bucket.
- Add iOS sub-browser detection (Safari vs. CriOS/EdgiOS/OPT/FxiOS) without needing a new dependency — plain UA string checks, consistent with existing `isIosDevice`/`isAndroidFirefoxBrowser` style.

**Non-Goals:**
- Not changing the manifest, service worker, or any build/PWA config — this is detection + UI logic only.
- Not attempting to detect browsers this proposal doesn't name (e.g. Brave, Vivaldi, UC Browser) — they fall through to the Chromium-standard bucket via the existing `beforeinstallprompt` check, which is correct for any unlisted Chromium engine, and iOS ones without a special UA token fall through to "non-Safari" since they cannot be Safari without lacking every other browser's token.
- Not adding automated cross-browser UA testing infrastructure (e.g. real device farm) — detection is UA/event-based and unit-testable by mocking `navigator.userAgent` and dispatching synthetic events, matching the existing test approach for this provider.

## Decisions

**1. Discriminated `bucket` field over multiple booleans.**
Replace `isIos` / `isAndroidManualInstall` with a single `bucket: 'chromium-standard' | 'opera-android' | 'firefox-android-unsupported' | 'ios-safari' | 'ios-other-webkit' | 'installed'`. A single discriminant makes the six outcomes mutually exclusive by construction (no risk of two booleans disagreeing) and makes the component's render logic a single switch instead of nested if/else.
- Alternative considered: keep booleans, just add more of them (`isFirefoxAndroid`, `isOperaAndroid`, `isIosSafari`, `isIosOtherWebkit`). Rejected — with 6 states this reintroduces the exact "which combination is actually reachable" ambiguity that caused Firefox/Opera/Edge to be wrongly merged in the current code.

**2. Opera keeps `canInstall: true` unconditionally; the deferred-event presence is checked inside `promptInstall`, not exposed as a separate flag.**
`promptInstall()` for the `opera-android` bucket: if a deferred `beforeinstallprompt` event was captured, call `.prompt()` as normal and return the real outcome; if not, return a new outcome value (e.g. `'manual-fallback'`) that tells the component to switch its own display from button to instructions in place, without a page reload or remount.
- Alternative considered: expose two separate opera sub-buckets (`opera-android-event` / `opera-android-no-event`) decided at classification time. Rejected — the deferred event can arrive at any point after mount (it's async), so the "does Opera have the event" question can only be answered authoritatively at click-time, not at classification-time. A static sub-bucket would go stale the moment the event fires late.

**3. iOS sub-browser detection via UA substring tokens, checked before the generic `isIosDevice` classification finalizes.**
`CriOS` (Chrome-iOS), `EdgiOS` (Edge-iOS), `OPT` (Opera Touch/Opera-iOS), `FxiOS` (Firefox-iOS) are Apple-mandated, stable UA tokens every non-Safari iOS browser sets specifically so servers/sites can distinguish them from Safari (since they all otherwise report a Safari-like WebKit UA). If any token is present, classify as `ios-other-webkit`; otherwise (plain iOS UA with no such token) classify as `ios-safari`.
- Alternative considered: feature-detect via `navigator.standalone` support or share-sheet capability probing. Rejected — there is no reliable JS-observable capability signal for "does this browser's share sheet have Add to Home Screen"; UA token check is the only practical signal, and it's the same technique the existing code already uses for Android browser detection (`isAndroidFirefoxBrowser`, etc.), so it's consistent with project convention.

**4. Classification order: installed → desktop (existing gate, unchanged) → Android sub-checks → iOS sub-checks → default Chromium-standard.**
Desktop suppression stays exactly where it is today (`useIsMobile()` gate in `InstallPrompt/index.tsx`, ahead of calling into bucket logic at all) — not moved into the provider, so as not to touch working, already-correct logic. Within mobile, `installed` is checked first (covers both Android and iOS installed cases with one check), then Android-specific UA checks, then iOS-specific UA checks, with `chromium-standard` as the terminal fallback for any Android UA that isn't Firefox or Opera.

## Risks / Trade-offs

- **UA sniffing is inherently brittle** → Mitigation: this already is the project's established pattern for this file (Firefox/Opera/Edge detection today); no new brittleness class introduced, and tokens chosen (CriOS/EdgiOS/OPT/FxiOS) are long-standing, Apple-review-enforced identifiers unlikely to change.
- **Opera's late-arriving `beforeinstallprompt` could fire between the user opening the fallback instructions and closing them** → Mitigation: `promptInstall` re-checks the deferred event fresh on every call; if the event arrives after the fallback UI is shown but the user re-triggers install, the real flow is used. No stale caching of "no event" state.
- **Firefox's "No PWA Support" message is a behavior regression from today's (incorrect) manual instructions** → this is intentional per proposal (marked **BREAKING**); mitigated by it being strictly more correct — today's instructions don't actually work in Firefox.
- **New iOS UA tokens from future browsers (e.g. a new WebKit wrapper not yet released) would silently fall into `ios-safari`** → Mitigation: default-to-`ios-safari` is the safer failure mode (shows real, if imperfect, guidance) rather than default-to-`ios-other-webkit` (which would incorrectly redirect actual Safari users). Acceptable given the non-goal of exhaustively tracking every possible browser.

## Migration Plan

No data migration or rollout sequencing needed — this is client-side detection logic behind a context provider already wrapping the app. Ship as a normal PR; rollback is a plain revert since there's no persisted state shape change (only the in-memory `InstallPromptValue` contract changes, and it's consumed by exactly one component in this repo).
