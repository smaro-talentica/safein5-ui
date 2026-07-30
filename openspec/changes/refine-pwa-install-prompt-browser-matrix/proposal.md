## Why

The app already prompts mobile users to install the PWA, but the current logic collapses several browsers with materially different install capabilities into two buckets (`isIos` / `isAndroidManualInstall`). This produces wrong or unactionable guidance for real users: Firefox-Android and Opera-Android currently get the *same* "open menu, add to home screen" message even though Firefox has no install path at all, and every iOS browser (Safari, Chrome-iOS, Edge-iOS, Opera-iOS, Firefox-iOS) gets the *same* "tap Share, Add to Home Screen" message even though only Safari's share sheet has that option — Apple mandates WebKit for all iOS browsers, so non-Safari iOS browsers cannot install a PWA at all via that instruction. Users on those browsers are being told to do something that doesn't work.

## What Changes

- Split the Android branch into three distinct outcomes instead of two:
  - **Chromium-standard** (Chrome, Edge, Samsung Internet, and any other Chromium browser where `beforeinstallprompt` fires normally): unchanged — show a working "Install" button.
  - **Opera-Android**: always show an "Install" button optimistically (Opera is Chromium-based and PWA-capable, but its own install layer means `beforeinstallprompt` is known to fire unreliably). On click, use the deferred prompt if one exists; if none was ever captured, fall back in place to manual "Open ⋮ menu → Add to Home screen" instructions rather than a dead button.
  - **Firefox-Android**: **BREAKING** (behavior change) — stop showing manual install instructions (there is no reliable manual install path Firefox exposes); show a "No PWA Support" message instead, with no button and no instructions.
- Split the iOS branch into two distinct outcomes instead of one:
  - **iOS Safari**: unchanged — "Tap Share → Add to Home Screen" banner.
  - **iOS non-Safari** (Chrome-iOS, Edge-iOS, Opera-iOS, Firefox-iOS, or any other WebKit-wrapper browser detected via UA tokens `CriOS`/`EdgiOS`/`OPT`/`FxiOS`): **BREAKING** (behavior change) — show a different banner telling the user to open the site in Safari to install, since these browsers have no Share-sheet install option.
- No change to: desktop suppression (already gated by `useIsMobile()` ahead of all branching), the already-installed detection/hide behavior (`isStandalone()`), or the Chromium-standard install flow itself.

## Capabilities

### New Capabilities
- `pwa-install-prompt`: Per-browser/per-OS detection and UI behavior for prompting mobile users to install the PWA, covering Android (Chromium-standard, Opera fallback, Firefox unsupported) and iOS (Safari vs. non-Safari WebKit wrappers), with desktop and already-installed states suppressing the prompt entirely.

### Modified Capabilities
(none — no existing archived specs cover this behavior yet)

## Impact

- `src/hooks/installPromptContext.ts` — `InstallPromptValue` shape changes from `{ canInstall, isIos, isAndroidManualInstall, installed, promptInstall }` to a discriminated set of states covering all six buckets (chromium-standard, opera-android-with-event, opera-android-fallback, firefox-android-unsupported, ios-safari, ios-other-webkit, installed).
- `src/hooks/InstallPromptProvider.tsx` — replace `isAndroidFirefoxBrowser` / `isAndroidOperaBrowser` / `isAndroidEdgeBrowser` grouping (which currently treats all three as one "manual install" bucket) with distinct per-browser classification; Edge-Android moves into the Chromium-standard bucket; add iOS sub-browser detection (Safari vs. CriOS/EdgiOS/OPT/FxiOS).
- `src/components/feature/InstallPrompt/index.tsx` — replace the current two-way (`isIos` / `isAndroidManualInstall`) copy branch with distinct copy per bucket, including the new "No PWA Support" (Firefox) and "Open in Safari to install" (iOS non-Safari) messages, and the Opera fallback-on-click behavior.
- No changes to `vite.config.ts`, the manifest, or `index.html` — this is purely install-prompt detection/UI logic.
