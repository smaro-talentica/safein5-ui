# SafeIn5 UI

A React + TypeScript single-page app built with Vite, with PWA support.

## Features

- **Auth & role-based routing** — the app is gated by a login and partitioned into three roles: **worker**, **supervisor**, **admin**.
  - **`/login`** — sign-in page (`Login`, `src/pages/shared/Login/`) with three fixed demo accounts (`worker@demo` / `supervisor@demo` / `admin@demo`, password `demo`). On sign-in it mints an unsigned (`alg: none`) JWT carrying **role + multi-tenant claims** (org + site) and stores it in `localStorage`; the current user, role, and tenant/site are derived by decoding that token (`src/auth/`, `useAuth` hook). There is no backend — this mirrors a real JWT flow locally. After a successful sign-in it returns to the route the user originally tried to reach (e.g. a QR deep link) if one is present, otherwise it lands on the signed-in role's home.
  - **Route guards** (`src/AppRoute/guard.tsx`): unauthenticated users are redirected to `/login`, carrying the originally-requested path in router state (`LoginLocationState`, `src/AppRoute/model.tsx`) so `Login` can send them back there post sign-in; a user visiting a route outside their role is redirected to their own home. **`/`** redirects to the logged-in role's home — worker → `/home`, supervisor → `/dashboard`, admin → `/analytics`.
  - The **bottom navigation bar** (`BottomNav`, `src/components/ui/bottom-nav/`) is **role-driven** (`navItemsByRole`): workers see **Home, Scan, Feed, Capture, Learn, Profile**; supervisors see **Dashboard, Signals, Profile**; admins see **Analytics, Tenants, Profile**. Nav visibility is also **per-route**: a route hides the bar by setting `handle: { hideNav: true }` in the router config, which `RootLayout` reads via `useMatches()` (e.g. `/login` and the `/scan` result screens hide it).
- **QR scan & reroute** — one unified `/scan` route serves both ways a QR code can be scanned (`ScanQr` page, `src/pages/shared/ScanQr/`):
  - **In-app camera scan** — visiting **`/scan`** directly (with no extra path segment) shows the camera-backed scanner (`QrScanner` feature component using `@zxing/browser`, works on Android and iOS/PWA). **Mobile only**: on laptop/desktop it shows an "open on your phone" notice instead of the camera (`useIsMobile` hook). Append **`?force=1`** to bypass the gate and use a desktop webcam for local testing. The camera stays **off** until the user presses **Scan**; scanning then runs for up to **30 seconds** before returning to the idle (camera off) state if nothing is found. A decoded QR is accepted only when its payload is a URL of the form **`<origin>/scan/<id>`** with a non-empty, non-reserved `id` segment — valid routes to `/scan/success?id=…`, anything else routes to `/scan/fail` (`resolveScanTarget`, `src/pages/shared/ScanQr/helper.tsx`).
  - **External scan / deep link** — **`/scan/:code`** is the same route, reached when a QR is scanned by a device's native camera app outside the PWA (the QR encodes the URL `<origin>/scan/<id>` directly). This renders **no camera and no Scan button** — the `:code` path param is evaluated immediately on load and redirects straight to `/scan/success?id=<code>` (or `/scan/fail` if the code is empty), matching the in-app scan outcome exactly.
  - **`/scan/success`** — success page a valid scan (either path) reroutes to; displays the decoded **`id`** (`?id=` query param) with a **Retry** action back to `/scan` (`ScanSuccess` page).
  - **`/scan/fail`** — failure page an invalid scan reroutes to; shows an "Invalid QR code" message with a **Retry** action back to `/scan` (`ScanFail` page).
  - `/scan` (in every form above) is **shared** across all roles.
- **Capture** (**`/capture`**) — page (`Capture`) reachable from the bottom navigation bar. Three top-level tabs: **Video**, **Audio**, **Text**.
  - **Video** → **Record** or **Choose file** sub-tabs. **Record** is an in-browser recorder (`VideoRecorder` feature component using `getUserMedia` + `MediaRecorder`, camera + mic, auto-stops at 60 s with a live countdown of the time left shown in the recorder) that needs the same trusted-HTTPS secure context as the QR scanner; a recorded clip goes straight to the preview-then-upload step below (it's already capped at 60 s). **Choose file** is a `video/*` file picker that rejects non-video files and probes the chosen file's duration; **every** chosen video (any length) then goes through an in-app **trim step** (`VideoTrimmer` feature component) — a WhatsApp-style filmstrip scrubber (thumbnail strip with draggable start/end handles and a whole-window drag, capped to a 60 s selection) with the video preview seeking live as you drag and looping playback within the selected range. Tapping **Upload** does **not** wait for the trim to finish: it immediately queues a background trim job (`TrimRunner` feature component, mounted once in `AppRoute` like the uploaders below, backed by a third IndexedDB store, `trim-jobs`) and navigates straight to **Feed**, where the pending item shows a **"Processing…"** placeholder card until the trim completes — at which point the placeholder is replaced by the normal saved-video card and its upload proceeds exactly as described below. A trim job that fails is shown with its error message and a dismiss action instead of hanging as "Processing…" forever. Re-encoding (both the trim step and `TrimRunner`) prefers **Mediabunny** (`mediabunny` package), which drives the browser's native WebCodecs decoder/encoder so a trim finishes in a small fraction of the selected duration rather than taking as long as the clip itself; on browsers without WebCodecs support it falls back to a real-time canvas + `MediaRecorder` capture. Mediabunny is loaded on demand (dynamic `import()`), not bundled into the app's main chunk, so it's only downloaded when a trim actually needs to run. Once a video is recorded or a trim finishes, it is previewed inline (name + size) and the recorder/file-picker are **locked** — no new recording is possible until the current video is either cancelled (**✕**, before upload) or uploaded. Upload **saves the video locally to IndexedDB first** (database `safein5-videos`, store `videos`), then **queues a background chunked upload** to the backend (see below) and navigates immediately to **Feed** — the upload continues without blocking navigation. Saved videos accumulate in IndexedDB up to a **cap of 5 (most recent)**: on saving a 6th, the **oldest** record (by `createdAt`) is evicted (FIFO).
  - **Audio** — a single mic-only recorder (`AudioRecorder` feature component, `getUserMedia`/`MediaRecorder`, capped at 2 minutes). Record → preview/playback → **Confirm** saves the clip locally to IndexedDB first (database `safein5-videos`, store `audio`), then **queues a background direct-to-S3 upload** (see below) and navigates to **Feed** — same local-first pattern as video, just single-request instead of chunked. This tab **keeps the audio** permanently (once uploaded); it does not produce any text.
  - **Text** → **Write** or **Transcribe** sub-tabs, both ending in a review step before saving. **Write** is a plain textarea — type a report, tap **Save**. **Transcribe** records a clip with the same `AudioRecorder` component, then automatically converts it to text via **AWS Transcribe** for the worker to review/edit in an editable textarea before tapping **Confirm**. Either way, only the final **text** is persisted — for **Transcribe**, the recorded clip is discarded once confirmed; it is never uploaded or kept anywhere. Text entries are saved **locally only** for now (IndexedDB, database `safein5-videos`, store `text-entries`) — no backend/S3 call for this tab at all yet (a real backend for text entries is a planned follow-up). Transcription itself goes through a provider-agnostic `TranscriptionClient` (`src/components/feature/Transcription/`); with no backend wired up yet it returns a fixed placeholder transcript after a short simulated delay — see `docs/BACKEND_SPEECH_TO_TEXT_SPEC.md` for the real (S3 + AWS Transcribe job polling) contract this is built against.
- **Feed** (**`/feed`**) — page (`Feed`) reachable from the bottom navigation bar. A single **merged, newest-first list** (no tabs) mixing videos, audio clips, text entries, and pending video-trim jobs from IndexedDB, each rendered with its own card (video player / audio player / text preview / trim-processing placeholder). Video and audio cards show name, size, recorded-at timestamp, a live **upload status**, and a **cancel-upload-or-delete** action; text cards show the saved text, whether it was **Written** or **Transcribed**, the timestamp, and a **delete** action; a trim-job card shows the video's name with a **"Processing…"** status (or its error message plus a dismiss action if the trim failed) until `TrimRunner` finishes it, at which point the card is replaced by the normal video card. Reads and deletes are done through **TanStack Query** (`useVideosQuery`/`useAudioClipsQuery`/`useTextEntriesQuery`/`useTrimJobsQuery`, matching delete/cancel mutations), so the list refreshes automatically after a delete and polls upload/trim progress while either is in flight. A video/audio item is removed from IndexedDB automatically once its upload completes; a trim job is removed once trimming succeeds (replaced by the real video). Shows one empty state when nothing is saved across all four types.
- **Chunked video upload** (background, no dedicated route) — videos saved in Capture are uploaded to the backend in fixed-size chunks via **S3 Multipart Upload**, one signed URL at a time (see `docs/BACKEND_UPLOAD_SPEC.md` for the full protocol). The upload loop lives in an app-level, render-nothing component (`VideoUploader`, `src/components/feature/VideoUploader/`) mounted once in `AppRoute` — it is not tied to the Capture/Feed page lifecycle, so an upload keeps running across navigation and **resumes automatically on app reopen** (progress, including chunk ETags and the backend session id, is persisted to a second IndexedDB store, `upload-sessions`). A failed chunk is retried with exponential backoff before the upload is marked failed. There is no real backend yet — `VITE_API_BASE_URL` points at a placeholder until one is implemented per the spec doc.
- **Audio clip upload** (background, no dedicated route) — audio clips saved via Capture's **Audio** tab are uploaded **directly to S3 via a presigned URL** (backend issues one presigned `PUT` per clip, no chunking, since clips are capped at 2 minutes and are small — see `docs/BACKEND_AUDIO_UPLOAD_SPEC.md` for the full contract). The upload loop lives in its own app-level, render-nothing component (`AudioUploader`, `src/components/feature/AudioUploader/`) mounted once in `AppRoute` alongside `VideoUploader` — same local-first, resume-on-reopen, retry-with-backoff behavior, persisted to a second IndexedDB store, `audio-upload-records`. There is no real backend yet — the mock **deliberately simulates a failed upload** (rather than a fake success) so every clip currently shows "Upload failed" in Feed and stays in local storage, exactly as it would if a real backend call failed; a clip is only ever deleted locally once a real upload actually succeeds.
- **AWS Transcribe speech-to-text** (background to Capture's **Text → Transcribe** sub-tab) — a recorded clip is uploaded directly to S3 (same presigned-URL pattern as audio clip upload), then the backend starts an **AWS Transcribe** job against that S3 object and the frontend polls for its result (see `docs/BACKEND_SPEECH_TO_TEXT_SPEC.md`). AWS Transcribe was chosen given the team's existing AWS subscription and this workforce's current UK (expanding to US/Europe) scope. **Unlike the Audio tab, the source clip is never kept** — once the worker confirms the reviewed transcript, only the text is saved (locally; see the Capture note above) and the audio/S3 object are not referenced again. There is no real backend yet — transcription is mocked (`src/components/feature/Transcription/action.tsx`).
- **Learn** (**`/learn`**, worker) — page (`Learn`). Placeholder screen with no content yet.
- **Profile** (**`/profile`**, shared) — page (`Profile`, `src/pages/shared/Profile/`) reachable by any role. Shows the signed-in user's name, email, role, organisation, and site (decoded from the JWT), with a **Sign out** action that clears the token and returns to `/login`.
- **Home** (**`/home`**, worker) — page (`Home`). Placeholder screen with no content yet.
- **Supervisor** placeholder screens (empty for now): **Dashboard** (**`/dashboard`**) and **Signals** (**`/signals`**).
- **Admin** placeholder screens (empty for now): **Analytics** (**`/analytics`**) and **Tenants** (**`/tenants`**).
- **Not found / error fallback** (shared) — `NotFound` (`src/pages/shared/NotFound/`) serves two roles: a `path: '*'` catch-all route shows it for any unmatched URL ("Oops, page not found"), and it's also wired as `errorElement` on the root and `/login` routes so any render/loader error anywhere in the app is caught by React Router's own error-boundary mechanism and shown as a generic "Oops, something went wrong" instead of a blank/crashed page. Both variants share a "Go home" link back to `/`; which copy renders is decided by `resolveVariant()` (`helper.tsx`) inspecting `useRouteError()`.

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
| `npm test`            | Run unit tests with Vitest (**watch mode**; use `npx vitest run` for a single pass) |

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
| `VITE_APP_ENV`      | Current environment: `development` \| `staging` \| `production` |
| `VITE_API_BASE_URL` | Base URL for API requests                                       |
| `VITE_STT_ENDPOINT_URL` | Speech-to-text transcription endpoint for the Capture **Text → Transcribe** flow (see `docs/BACKEND_SPEECH_TO_TEXT_SPEC.md`). Optional — left unset, transcription falls back to a mock transcript. |

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

- **Custom service worker** (`src/sw.ts`, `injectManifest` strategy) — Workbox app-shell precaching, kept as a custom SW so app-specific behavior can be added later.
- Web app manifest (standalone display, theme/background colors, two icon entries): `public/pwa.png` (`purpose: "any"`, `sizes: "192x192 512x512"`, one source image used at both sizes) plus `public/pwa-maskable.png` (`purpose: "maskable"`, 1024×1024) — the logo is scaled to ~72% and centered on a canvas filled with the icon's own background color, keeping it inside Android's safe-zone so platform icon masks (circle, squircle, etc.) crop only background, not the logo, fixing the inconsistent cropping previously seen across Firefox/Opera/Edge.
- Offline asset precaching via Workbox (`js`, `css`, `html`, `ico`, `png`, `svg`, `woff2`)
- **Custom install prompt** — an in-app banner (`InstallPrompt`, `src/components/feature/InstallPrompt/`, driven by the `useInstallPrompt` hook) offers "Add to Home Screen" until the app is installed, including on the logged-out `/login` screen. **Mobile only** (gated by `useIsMobile`) — desktop browsers never show it, regardless of engine. It is hidden while the app is running as the installed app itself (`display-mode: standalone`), after the user dismisses it (✕ — remembered permanently via `localStorage`, `src/components/feature/InstallPrompt/helper.tsx`), and whenever there is nothing actionable to show (no real install button available and the browser isn't one of the known manual-install cases below) — it does not show a button-less generic message just to be present. Install detection is app-wide: an `InstallPromptProvider` mounted at the app root captures the one-shot `beforeinstallprompt` event regardless of the current route, so it is not missed on the entry screen. Content varies by mobile browser: on **Android Chrome/Samsung Internet** (reliably fire `beforeinstallprompt`) it shows the real native install button via that captured event; on **any iOS browser** (Safari, Chrome, Firefox, Edge, Opera — all forced onto WebKit, none support `beforeinstallprompt`, and pre-16.4 iOS only supports installing via Safari at all) it shows manual Share → Add to Home Screen steps; on **Android Firefox, Android Opera, and Android Edge** (none reliably fire `beforeinstallprompt` — each is a known, separately reported gap, despite Opera/Edge being Chromium-based) it shows manual menu (⋮) → Add to Home screen steps. If `beforeinstallprompt` does happen to fire on Edge/Opera for a given user, the native button still takes priority over the manual instructions. Note: the native prompt only becomes available after the app is installable **and** the user has engaged with the page — never on the very first paint; once Chrome has already installed the app for a given profile, it will not re-offer `beforeinstallprompt` in a normal tab, so the banner stays hidden there rather than showing with no button.
- The service worker and manifest are also enabled in **dev** (`devOptions` in `vite-plugin-pwa`), so installability can be tested with `npm run dev` without a production build.

## Project Structure

```
src/
├── AppRoute/        App routing + route-path constants + role guards (@/AppRoute/constant, guard, helper). Every routed page component is `React.lazy`-loaded and wrapped in `<Suspense>`, so each role's pages (and heavy per-page deps like the QR-scanning libraries) ship as separate chunks fetched on demand instead of one large upfront bundle.
├── assets/          Static assets
├── auth/            Client-side auth: JWT mint/decode, localStorage token store, AuthProvider/context, demo accounts
├── components/      Reusable components
│   ├── ui/          Presentational components — styling only, no logic (incl. shadcn/ui)
│   └── feature/     Reusable components with styling AND logic
├── hooks/           Reusable React hooks — @/hooks (e.g. useIsMobile, useAuth)
├── pages/           Page components, partitioned by user role: shared/ (any role, e.g. Login, Profile, ScanQr), worker/ (Home, Feed, Capture, Learn), supervisor/ (Dashboard, Signals), admin/ (Analytics, Tenants). Child routes nest under the parent in a sub-pages/ folder, e.g. shared/ScanQr/sub-pages/ScanSuccess. Capture also owns the `safein5-videos` IndexedDB database (stores: `videos`, `upload-sessions`, `audio`, `audio-upload-records`, `text-entries`, `trim-jobs`).
├── utils/           Utilities (cn, env helpers) — @/utils
├── sw.ts            Custom service worker (app-shell precache)
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
- @zxing/browser + @zxing/library (camera QR scanning on `/scan`)
- mediabunny (WebCodecs-backed video trim/re-encode for Capture's video trim step, see above)

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
- fake-indexeddb (in-memory IndexedDB for unit tests, e.g. Capture's video/upload-session stores)
