## Context

SafeIn5 UI has Vitest (jsdom + Testing Library) for unit/component tests, but nothing exercises
the app in a real browser. The app is a PWA that runs over self-signed HTTPS in every mode
(`vite-plugin-mkcert` on `dev`, `@vitejs/plugin-basic-ssl` applied at `command === 'serve'`), has
three env-driven modes (development/staging/production), and has no `.github` CI workflow yet.
Auth is mock-JWT-in-localStorage scaffolding that will be replaced later. This change adds only
the Playwright scaffolding: install, config, one smoke spec, a local npm script.

## Goals / Non-Goals

**Goals:**
- Get `@playwright/test` installed and configured, runnable locally via `npm run test:e2e`.
- One smoke spec that proves the harness works: app shell renders, root route loads, no console
  errors.
- Establish where e2e specs live (`e2e/`) and how they're excluded from Vitest and from the
  component-folder convention.

**Non-Goals:**
- No CI/build gate wiring (no `.github` workflow exists yet in this repo; adding one is a
  separate, later decision).
- No real user-journey coverage (QR scan, capture, login, PWA install prompt) — follow-up changes.
- No cross-browser matrix (Firefox/WebKit) — Chromium only for now.
- No visual regression / screenshot testing.

## Decisions

### 1. `webServer` target: `vite preview` (built), not `vite dev`

Playwright's config needs to boot the app. Two options:

| | `vite dev` | `vite preview` (chosen) |
|---|---|---|
| Speed to first run | fast, no build step | requires `npm run build` first |
| Fidelity | dev-mode HMR overhead, unminified | closer to what ships to users |
| HTTPS cert | mkcert-issued, but Playwright's default Chromium still needs `ignoreHTTPSErrors: true` or the mkcert root CA trusted in the test environment | same self-signed cert story — `basic-ssl` still applies at `command === 'serve'`, `preview` also serves over HTTPS |
| Env mode | whichever `.env.development.local` is active | `production` build output, matching what actually deploys |

**Decision:** point `webServer` at `vite preview` against a `production`-mode build
(`npm run build && vite preview`), with `ignoreHTTPSErrors: true` in the Playwright config rather
than trying to get Chromium to trust the mkcert root CA. Rationale: a smoke test's job is to
catch "the shipped app is broken," and `preview` is the closest local approximation to that
without needing a real deployment. `ignoreHTTPSErrors` is a one-line, low-risk config flag for a
self-signed local cert — trying to get Playwright's bundled Chromium to trust mkcert's root CA is
more moving parts for no real security benefit in a local smoke test.

**Alternative considered:** point at `vite dev`. Rejected for now because dev mode pulls in
`vite-plugin-checker` and PWA dev-mode SW registration (`devOptions.enabled: true`), which adds
noise/flakiness risk to a first smoke test; nothing stops a later change from adding a
dev-mode-targeted config if fast local iteration on e2e specs becomes valuable.

### 2. Spec location: top-level `e2e/`, not under `src/`

The component-folder convention (`index/model/helper/constant/action/query.tsx`) applies to
application components. Playwright specs are test infrastructure, not components, and running
them through Vitest's `include`/`exclude` globs would require constant care to keep them apart.
**Decision:** `e2e/` at repo root, sibling to `src/`, `public/`, `openspec/`. Vitest's `test.include`
default (`src/**/*.{test,spec}.*`... effectively scoped under `src/` via existing config) already
won't pick up `e2e/`; Playwright's own `testDir: './e2e'` config keeps it from touching `src/`.

### 3. One browser (Chromium) to start

Playwright supports multi-browser projects out of the box, but adding Firefox/WebKit now multiplies
install size and run time for a smoke test whose only job is proving the harness works.
**Decision:** single `chromium` project in `playwright.config.ts`; adding `firefox`/`webkit`
projects later is a one-line change per browser, not a re-architecture.

### 4. The smoke test itself

**Decision:** navigate to `/`, assert the root layout renders (e.g. an element that's always
present — nav or a known root container) and assert zero uncaught page errors
(`page.on('pageerror', ...)`). Deliberately avoid anything auth-gated, since `src/auth/` is
temporary mock scaffolding (per CLAUDE.md) that will change shape once a real backend lands —
coupling the first e2e spec to it would make this test brittle for the wrong reasons.

### 5. Package script

**Decision:** add `"test:e2e": "playwright test"` alongside the existing `test` (Vitest) script.
No change to `npm test`'s meaning — it stays Vitest-only, so existing muscle memory and any future
CI step that runs `npm test` is unaffected by this change.

## Risks / Trade-offs

- **Browser binary download** (`npx playwright install`) is a new local setup step and adds
  disk/time cost on first run → mitigate by documenting it explicitly in tasks.md and README-level
  setup notes; only Chromium is installed (not the full browser set).
- **`ignoreHTTPSErrors: true`** slightly weakens TLS validation in tests → acceptable because this
  only affects the local Playwright-driven browser session against a local self-signed cert, never
  production traffic; no code path outside the test harness is touched.
- **Build-before-test coupling** (`vite preview` needs a prior `npm run build`) → mitigate by
  wiring Playwright's `webServer.command` to run the build itself (e.g.
  `npm run build && vite preview --mode production`) so `npm run test:e2e` stays a single command.
- **No CI gate yet** means this can silently rot (pass locally, never enforced) → explicitly
  flagged as a non-goal here rather than silently implied; a follow-up change should introduce
  CI wiring once there's more than a single smoke spec worth gating on.

## Open Questions

- Should the eventual CI integration run against `preview` (as here) or a deployed
  staging/preview environment? Deferred to the CI-wiring follow-up change.
- Once real journeys are added (QR scan, camera permissions), will Playwright's fake-camera flags
  need a dedicated Chromium launch-args config? Deferred to that follow-up change.
