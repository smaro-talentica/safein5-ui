# Wrapping the app in Capacitor — notes

Exploratory notes on what it would take to wrap this app (React 19 + Vite PWA) as a native
Android/iOS app shell using [Capacitor](https://capacitorjs.com/), instead of relying solely on
PWA installability. Captured from a design discussion; nothing here has been implemented.

## Why this came up

The app already ships as an installable PWA (`vite-plugin-pwa`, `src/sw.ts`). PWA install/behavior
has real platform gaps — most notably iOS Safari's push notification support (requires
home-screen install, iOS 16.4+) and the general unreliability of background audio/mic capture on
mobile browsers, both relevant given voice memo is the primary capture input and a supervisor
notification path is planned. Capacitor is the natural next step if those gaps turn out to block
a real requirement, without discarding the existing React/TS codebase.

## What Capacitor actually is

Capacitor does not rewrite the app. It takes the existing Vite **build output** (`dist/`) and
loads it into a native WebView shell (`WKWebView` on iOS, Android `WebView`), with a JS bridge
that exposes native plugins (push notifications, camera, filesystem, etc.) to the same web code.

```
   Today (PWA)                          With Capacitor added
┌───────────────────┐                 ┌─────────────────────────────┐
│   Browser / OS     │                │   Native shell (iOS/Android) │
│  ┌───────────────┐ │                │  ┌─────────────────────────┐ │
│  │ Service Worker │ │                │  │  WKWebView / WebView    │ │
│  │  (src/sw.ts)   │ │                │  │  ┌───────────────────┐  │ │
│  └───────────────┘ │                │  │  │  Same React build  │  │ │
│  ┌───────────────┐ │   add native   │  │  │  (served from      │  │ │
│  │ Your React app │ │ ─────wrapper──▶│  │  │  capacitor:// or   │  │ │
│  │ (dist/ served  │ │                │  │  │  https://localhost)│  │ │
│  │ over https://) │ │                │  │  └─────────┬─────────┘  │ │
│  └───────────────┘ │                │  └────────────┼───────────┘ │
└───────────────────┘                 │        Capacitor JS bridge  │
                                       │  ┌────────────┴───────────┐ │
                                       │  │ Native plugins:         │ │
                                       │  │ PushNotifications,      │ │
                                       │  │ Camera, Filesystem, ... │ │
                                       │  └─────────────────────────┘ │
                                       └───────────────┬───────────────┘
                                                        ▼
                                          ios/ and android/ native
                                          projects checked into repo
                                          (Xcode / Android Studio)
```

## Mechanical steps

### 1. Add the CLI + core packages

```bash
npm install @capacitor/core
npm install -D @capacitor/cli
npx cap init
```

`cap init` asks for the app name (`Safe in 5`) and a bundle/app ID (reverse-DNS, e.g.
`com.safein5.app`). **This ID is effectively permanent once published to a store** — decide it
deliberately rather than accepting a placeholder. Generates `capacitor.config.ts`.

### 2. Point config at the existing build output

```ts
// capacitor.config.ts
const config: CapacitorConfig = {
  appId: 'com.safein5.app',
  appName: 'Safe in 5',
  webDir: 'dist', // existing `npm run build` output — no Vite config change needed
}
```

### 3. Add native platforms

```bash
npm install @capacitor/ios @capacitor/android
npx cap add ios
npx cap add android
```

Creates `ios/` and `android/` folders **checked into the repo** as real Xcode/Android Studio
projects. This is the biggest mental shift: native project files now live alongside the web code.
**iOS builds and App Store submission require Xcode, which requires macOS** — a real constraint
if the dev environment is Windows-only (as it appears to be here). Options if so: a Mac in the
loop, a macOS CI runner (GitHub Actions, Codemagic, Bitrise), or a cloud Mac service.

### 4. Sync on every build

```bash
npm run build && npx cap sync
```

`cap sync` copies the fresh `dist/` into both native shells and updates native plugin
dependencies. This becomes a recurring step in the build/release pipeline, not a one-time setup
action.

### 5. Swap web APIs for native plugins where native capability is actually wanted

Only needed where crossing from "web-capable" to "native-capable" matters:

| Concern | Web API today | Capacitor plugin |
|---|---|---|
| Push notifications | `Notification` + SW `showNotification` (see `docs/../openspec/changes/add-push-notification-demo`) | `@capacitor/push-notifications` → real APNs/FCM, works even when app is killed |
| QR camera (`@zxing`) | `getUserMedia` in a `<video>` | Can stay as-is (WebView supports getUserMedia), or `@capacitor/camera` for native camera UI |
| Voice memo capture | `MediaRecorder` | Can stay as-is, or `@capacitor-community/voice-recorder` for reliable background recording |
| Routing | `createHashRouter` (see below) | Works unmodified — no server-side fallback dependency |

### 6. Routing (resolved — was a caveat, no longer one)

`src/AppRoute/index.tsx` originally used `createBrowserRouter`, which relies on real URL path
history and normally needs server-side SPA fallback to resolve deep links/hard refreshes (e.g. a
refresh on `/scan/success`). Capacitor serves the app from a local scheme (`capacitor://localhost`
on iOS, `https://localhost` on Android), not a real HTTP server doing file-existence checks, so
that fallback behavior was unverified for this setup.

Since no physical QR codes had been printed and no deep-link URLs had shipped anywhere external,
the app was switched to `createHashRouter` pre-emptively (see the `switch-to-hash-router` change
under `openspec/changes/`). All in-app URLs are now hash-shaped (e.g. `/#/scan/success`), which
never depends on server-side rewriting — this removes the Capacitor-hosting risk entirely rather
than requiring it to be verified. Any future QR code or shared-link generation must produce URLs
in this hash-routed shape.

## What does NOT change

- React/TS component code, `src/pages/`, `src/components/` — untouched.
- Tailwind, shadcn/ui, TanStack Query — untouched.
- `npm run dev` for day-to-day iteration in-browser — untouched; the native shell
  (`npx cap open ios` / `npx cap open android`) is only needed to test native-specific behavior or
  cut a release build.
- The existing PWA config (`VitePWA` in `vite.config.ts`) — Capacitor is additive, not a
  replacement. The installable-web-PWA path can continue to exist alongside native wrapping.

## Open questions / not yet decided

- Whether push notifications (or another specific capability gap) actually justify taking this on
  now, versus staying PWA-only until a concrete requirement forces the issue.
- Whether iOS support is required for v1, given the macOS/Xcode build dependency.
