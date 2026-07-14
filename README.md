# SafeIn5 UI

A React + TypeScript single-page app built with Vite, with PWA support.

## Features

- **Video upload** (`/upload`) — a mobile-friendly view to record a short clip in-app or choose one from the gallery, then upload it. Videos are limited to **30 seconds** (configurable) and uploaded **resumably and in the background**:
  - **In-app recording** with a live countdown that hard-stops at the limit (`VideoRecorder`, `src/components/feature/VideoRecorder/`), plus gallery selection with client-side duration validation.
  - **Non-blocking, resumable uploads** via a singleton upload manager (`src/utils/upload/`): the file is split into ~6 MiB parts uploaded directly to S3 (multipart), with per-part retry/backoff so an upload never fails silently.
  - **Survives app close** — upload state and per-part progress are persisted in **IndexedDB** and auto-resume on reopen; on browsers that support the **Background Fetch API** (Chrome/Android) uploads continue while the app is closed. On iOS, uploads resume the next time the app is opened.
  - Implemented as the `VideoUpload` feature component (`src/components/feature/VideoUpload/`) rendered by the `UploadVideo` page (`src/pages/UploadVideo/`), bridged to React via the `useUpload` hook (`src/hooks/`).
  - **Backend contract** required for the upload flow (S3 multipart, presigned URLs) is fully specified in [`docs/BACKEND_UPLOAD_SPEC.md`](docs/BACKEND_UPLOAD_SPEC.md).
- **QR scan & reroute** (the app's default screen — `/` redirects to `/scan`) — a QR scanning flow that reads a JSON payload and reroutes based on it:
  - **`/scan`** — camera-backed QR scanner (`ScanQr` page + `QrScanner` feature component using `@zxing/browser`, works on Android and iOS/PWA). **Mobile only**: on laptop/desktop it shows an "open on your phone" notice instead of the camera (`useIsMobile` hook). Append **`?force=1`** to bypass the gate and use a desktop webcam for local testing. The camera stays **off** until the user presses **Scan**; scanning then runs for up to **30 seconds** before returning to the idle (camera off) state if nothing is found. A QR is accepted only when its payload is a **JSON object with a non-empty string `id`** — a valid code routes to `/scan/success?id=…`, anything else routes to `/scan/fail`.
  - **`/scan/success`** — success page a valid scan reroutes to; displays the decoded **`id`** (`?id=` query param) with a **Retry** action back to `/scan` (`ScanSuccess` page).
  - **`/scan/fail`** — failure page an invalid scan reroutes to; shows an "Invalid QR code" message with a **Retry** action back to `/scan` (`ScanFail` page).
  - The Upload and Scan screens are reachable from a **bottom navigation bar** (`BottomNav`, `src/components/ui/bottom-nav/`) with **Upload** and **Scan** entries.

## Getting Started

### Prerequisites

- **Node.js** `>=24.17.0` (the version is pinned in `.nvmrc` / `.node-version` — run `nvm use` to match)
- **npm** `>=11.13.0`

Versions are enforced via the `engines` field and the pinned `packageManager` in `package.json`. `.npmrc` sets `engine-strict=true`, so `npm install` **fails** (rather than warns) on a mismatched Node/npm version.

### Recommended editor setup

When you open this project in VS Code, you'll be prompted to install the recommended extensions (defined in `.vscode/extensions.json`):

- ESLint
- Prettier
- Tailwind CSS IntelliSense
- Code Spell Checker

### Install

```bash
npm install
```

### Scripts

| Command               | Description                                                             |
| --------------------- | ----------------------------------------------------------------------- |
| `npm run dev`         | Start the dev server in **development** mode (HTTPS via mkcert, LAN-exposed via `--host`, HMR) |
| `npm run dev:stage`   | Start the dev server in **staging** mode                                |
| `npm run dev:prod`    | Start the dev server in **production** mode                             |
| `npm run build`       | Type-check (`tsc -b`) and build for **production**                      |
| `npm run build:dev`   | Build for **development**                                               |
| `npm run build:stage` | Build for **staging**                                                   |
| `npm run preview`     | Preview the last production build locally                               |
| `npm run lint`        | Run ESLint                                                              |
| `npm run format`      | Format the codebase with Prettier                                       |
| `npm test`            | Run unit tests with Vitest                                              |

## Environments

The app supports three environments, each driven by a Vite **mode** and its matching env file:

| Environment | Mode          | Env file           | Dev                 | Build                 |
| ----------- | ------------- | ------------------ | ------------------- | --------------------- |
| Development | `development` | `.env.development` | `npm run dev`       | `npm run build:dev`   |
| Staging     | `staging`     | `.env.staging`     | `npm run dev:stage` | `npm run build:stage` |
| Production  | `production`  | `.env.production`  | `npm run dev:prod`  | `npm run build`       |

- Variables follow Vite conventions and **must be prefixed with `VITE_`** to be exposed to the client.
- See `.env.example` for the full list of supported variables. Use `.env.local` / `.env.<mode>.local` for machine-specific overrides and secrets (git-ignored).
- Typed access is centralized in `src/utils/env.ts` (`env`, `isDevelopment`, `isStaging`, `isProduction`); types are declared in `src/vite-env.d.ts`.
- The dev server runs over HTTPS in all modes via `vite-plugin-mkcert`, which issues a locally-trusted certificate (needed for camera access and PWA testing on real devices).
- The `dev` scripts pass `--host`, so the server is exposed on your LAN. Open the printed **Network** URL (e.g. `https://<your-lan-ip>:5173`) on a phone on the same Wi-Fi to test with instant HMR — no rebuild/redeploy. Trust the mkcert root CA on the device (or use a secure-origin flag) so camera-dependent features like QR scanning work.

Available variables:

| Variable                       | Description                                                             |
| ------------------------------ | ----------------------------------------------------------------------- |
| `VITE_APP_ENV`                 | Current environment: `development` \| `staging` \| `production`         |
| `VITE_API_BASE_URL`            | Base URL for API requests (incl. the `/uploads/*` endpoints)            |
| `VITE_UPLOAD_PART_SIZE`        | Bytes per multipart upload part (default 6 MiB; must be ≥ 5 MiB per S3) |
| `VITE_UPLOAD_CONCURRENCY`      | Max concurrent part uploads (default 4)                                 |
| `VITE_UPLOAD_MAX_DURATION_SEC` | Max allowed video duration in seconds (default 30)                      |

## Testing on a phone (camera / PWA)

The QR scanner needs the **device camera**, which browsers only expose in a **secure context** — HTTPS with a certificate the device *trusts*, or `localhost`. When you open the dev server's Network URL on a phone, the page loads but the camera silently fails (black preview, no error) if that context isn't trusted. To test camera features on a real phone:

1. Phone and PC must be on the **same Wi-Fi**.
2. Run `npm run dev` and open the printed **Network** URL (e.g. `https://<your-lan-ip>:5173`) on the phone.
   - On Windows, allow Node through the firewall (Private networks) if prompted.
3. Grant the phone a **secure context** using one of:
   - **Trust the mkcert CA (recommended, permanent):** after the first `npm run dev`, mkcert's root CA is at `%LOCALAPPDATA%\mkcert\rootCA.pem` (macOS/Linux: `~/.local/share/mkcert/rootCA.pem` or run `mkcert -CAROOT`). Transfer it to the phone and install it as a trusted **CA certificate** (Android: Settings → Security → Install a certificate → CA certificate; iOS: install the profile, then enable it under Settings → General → About → Certificate Trust Settings). The origin is then fully trusted — no warnings.
   - **Chrome insecure-origin flag (quick, per-device):** on the phone's Chrome open `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, set it **Enabled**, add `https://<your-lan-ip>:5173`, and relaunch. This forces a secure context without installing a cert.
4. Also confirm the browser has OS-level **camera permission** (Android: Settings → Apps → Chrome → Permissions → Camera), then tap **Scan** and **Allow** when prompted.

Code changes hot-reload on the phone via HMR — no rebuild or redeploy needed.

## PWA Support

This app is an installable Progressive Web App, configured via `vite-plugin-pwa`:

- **Custom service worker** (`src/sw.ts`, `injectManifest` strategy) — Workbox precaching plus **Background Fetch** handling so video uploads can continue while the app is closed (Chrome/Android).
- Web app manifest (standalone display, theme/background colors, 192/512 icons incl. maskable)
- Offline asset precaching via Workbox (`js`, `css`, `html`, `ico`, `png`, `svg`, `woff2`)
- **Custom install prompt** — an in-app banner (`InstallPrompt`, `src/components/feature/InstallPrompt/`, driven by the `useInstallPrompt` hook) offers "Add to Home Screen" on every visit until the app is installed. On Chromium (Android Chrome / desktop Chrome/Edge) it triggers the native prompt via the captured `beforeinstallprompt` event; on iOS Safari (which has no such API) it shows the manual Share → Add to Home Screen steps. Note: browsers only expose the prompt after the app is installable **and** the user has engaged with the page — never on the very first paint.
- The service worker and manifest are also enabled in **dev** (`devOptions` in `vite-plugin-pwa`), so installability can be tested with `npm run dev` without a production build.

## Project Structure

```
src/
├── AppRoute/        App routing
├── assets/          Static assets
├── components/      Reusable components
│   ├── ui/          Presentational components — styling only, no logic (incl. shadcn/ui)
│   └── feature/     Reusable components with styling AND logic
├── hooks/           Reusable React hooks — @/hooks (e.g. useUpload)
├── pages/           Page components
├── utils/           Utilities (cn, env helpers, upload engine) — @/utils
│   └── upload/      Resumable upload engine (manager, IndexedDB, chunking, API)
├── sw.ts            Custom service worker (precache + Background Fetch uploads)
├── main.tsx         App entry point
├── global.css       Global styles
└── vite-env.d.ts    Vite/PWA + env type declarations
```

The `@` alias resolves to `src/`.

### Component conventions

- **`components/ui/`** — purely presentational, reusable building blocks. Styling only, **no business logic** or state (buttons, inputs, cards, etc.). This is where shadcn/ui components live.
- **`components/feature/`** — reusable components that combine **styling and logic** (data fetching, state, behavior) for a specific feature.

## Technologies

### Core

- React
- React DOM
- TypeScript
- Vite

### Routing & Data

- React Router DOM
- TanStack React Query
- TanStack React Query Devtools
- idb (IndexedDB wrapper — persists in-progress uploads)
- @zxing/browser + @zxing/library (camera QR scanning on `/scan`)

### Forms

- React Hook Form

### Styling & UI

- Tailwind CSS
- shadcn/ui
- Lucide React
- class-variance-authority
- clsx
- tailwind-merge

### Build & Plugins

- @vitejs/plugin-react
- vite-plugin-mkcert (locally-trusted HTTPS certs for the dev server)
- @tailwindcss/vite
- vite-plugin-checker
- vite-plugin-pwa

### Tooling

- ESLint
- typescript-eslint
- Prettier
- Vitest
- @vitest/coverage-v8 (unit-test coverage via `npx vitest run --coverage`)
- jsdom
- fake-indexeddb (IndexedDB in unit tests)
