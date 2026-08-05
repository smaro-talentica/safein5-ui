## ADDED Requirements

### Requirement: Playwright test infrastructure exists and is locally runnable
The project SHALL provide a Playwright configuration and an `npm run test:e2e` script that runs
real-browser end-to-end tests locally, independent of and additive to the existing Vitest
unit/component test setup.

#### Scenario: Running the e2e script locally
- **WHEN** a developer runs `npm run test:e2e` after installing dependencies and Playwright
  browser binaries
- **THEN** Playwright builds the app, serves it via `vite preview`, launches Chromium, runs all
  specs under `e2e/`, and reports pass/fail without requiring any CI system

#### Scenario: Vitest is unaffected
- **WHEN** a developer runs `npm test` (Vitest)
- **THEN** no Playwright spec under `e2e/` is collected or executed, and no existing Vitest test
  is affected by the presence of the Playwright config

### Requirement: E2E specs are isolated from the component-folder convention
Playwright spec files SHALL live under a top-level `e2e/` directory, not under `src/`, and SHALL
NOT be subject to the `index/model/helper/constant/action/query.tsx` component-folder splitting
convention, since they are test infrastructure rather than application components.

#### Scenario: Locating e2e specs
- **WHEN** a developer looks for end-to-end test files
- **THEN** they find them under `e2e/` at the repo root, sibling to `src/`, and find no e2e spec
  files anywhere under `src/`

### Requirement: A passing smoke test verifies the app shell loads
The project SHALL include at least one Playwright smoke spec that loads the app's root route in a
real browser and verifies the app shell renders with no uncaught page errors, without depending on
authenticated state.

#### Scenario: Smoke test passes on a working build
- **WHEN** the smoke spec runs against a locally built and served app
- **THEN** it navigates to `/`, finds the expected root layout element, and reports zero uncaught
  JavaScript errors on the page

#### Scenario: Smoke test does not depend on auth
- **WHEN** the smoke spec runs against a fresh browser context with no stored token
- **THEN** the test still passes, because it only asserts on the unauthenticated app shell/root
  route rather than any auth-gated screen
