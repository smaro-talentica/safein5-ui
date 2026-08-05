import { defineConfig, devices } from '@playwright/test'

// Boots the production build via `vite preview` (not `vite dev`) so the smoke test exercises the
// closest local approximation of what actually ships. `vite preview` still serves over HTTPS in
// this project (basic-ssl applies to Vite's preview/dev server infrastructure the same way), via
// a self-signed mkcert-issued certificate — ignoreHTTPSErrors avoids needing Chromium to trust
// that local CA just to run a smoke test.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'https://localhost:4173',
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173',
    url: 'https://localhost:4173',
    ignoreHTTPSErrors: true,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
