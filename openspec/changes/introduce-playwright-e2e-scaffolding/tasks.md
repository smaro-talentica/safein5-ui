## 1. Install & Setup

- [x] 1.1 Add `@playwright/test` as a dev dependency
- [x] 1.2 Run `npx playwright install chromium` and document this one-time setup step (README or
      contributing notes)
- [x] 1.3 Add Playwright output paths (`playwright-report/`, `e2e-results/`, `blob-report/`,
      `test-results/`) to `.gitignore`

## 2. Configuration

- [x] 2.1 Create `playwright.config.ts` at repo root: `testDir: './e2e'`, single `chromium`
      project, `ignoreHTTPSErrors: true`
- [x] 2.2 Configure `webServer` to run `npm run build && vite preview --mode production`, point
      `baseURL`/`webServer.url` at the preview server's HTTPS URL, and reuse an existing server
      when already running locally (`reuseExistingServer: !process.env.CI`)
- [x] 2.3 Add `"test:e2e": "playwright test"` script to `package.json`

## 3. Smoke Test

- [x] 3.1 Create `e2e/app-shell.spec.ts`: navigate to `/`, assert a known root layout element is
      visible, assert zero `pageerror` events, without relying on any authenticated state
- [x] 3.2 Run `npm run test:e2e` locally and confirm the smoke test passes

## 4. Verification

- [x] 4.1 Confirm `npm test` (Vitest) still passes and does not collect anything under `e2e/`
- [x] 4.2 Confirm `npm run build` and `npm run lint` are unaffected by the new files
- [x] 4.3 Update `CLAUDE.md`'s Commands section with `npm run test:e2e` and a one-line note on the
      `e2e/` directory, consistent with existing documented commands
