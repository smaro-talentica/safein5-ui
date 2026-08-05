## Why

SafeIn5 UI currently has no way to verify that the app actually works end-to-end in a real
browser — Vitest + Testing Library cover pure logic and component rendering in jsdom, but nothing
today opens the real app shell and confirms it loads. We need the scaffolding for real-browser
UI automation in place before we can add meaningful journey coverage (QR scan, capture, login)
in follow-up changes.

## What Changes

- Add Playwright as a dev dependency, additive to the existing Vitest setup (not a replacement).
- Add a Playwright config (`playwright.config.ts`) that boots the app via a `webServer` and runs
  against Chromium (single browser to start).
- Add a top-level `e2e/` directory for Playwright spec files, separate from `src/` and from the
  per-component `index/model/helper/constant/action/query.tsx` convention (Playwright specs are
  test infra, not components).
- Add one smoke test: the app shell renders and the root route loads without error.
- Add an `npm run test:e2e` script to run Playwright locally.
- Add `e2e-results/`, `playwright-report/`, and related Playwright output paths to `.gitignore`.

## Capabilities

### New Capabilities

- `e2e-test-infra`: Locally-runnable Playwright scaffolding (config, one smoke spec, npm script)
  for real-browser UI automation, independent of the existing Vitest unit/component test setup.

### Modified Capabilities

(none — no existing spec-level requirements change)

## Impact

- **Dependencies**: adds `@playwright/test` (dev dependency) and requires a one-time
  `npx playwright install` (browser binaries) as a documented local setup step.
- **package.json**: new `test:e2e` script; no changes to existing `test`, `build`, `dev*` scripts.
- **New files**: `playwright.config.ts`, `e2e/app-shell.spec.ts` (or similar), updates to
  `.gitignore`.
- **Not affected**: Vitest config/tests, CI (no workflow exists yet — wiring this into CI is
  explicitly out of scope for this change), any existing `src/` code or routes.
- **Explicit non-goals**: no CI/build gate wiring, no coverage of real user journeys (QR scan,
  capture, login) — those are follow-up changes once this scaffolding lands.
