import { test, expect } from '@playwright/test'

// Deliberately auth-independent: the router (createHashRouter) sends an unauthenticated visit to
// `/` straight to `/#/login` via AuthedRedirect, so this asserts on the unauthenticated app
// shell rather than anything behind RoleGuard — auth is mock scaffolding that will change shape
// once a real backend lands (see CLAUDE.md's Auth & API security section).
test('app shell renders and the root route loads', async ({ page }) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => pageErrors.push(error))

  await page.goto('/')

  await expect(page).toHaveURL(/#\/login$/)
  await expect(page.getByRole('heading', { name: 'Demo App' })).toBeVisible()
  await expect(page.getByText('Sign in to continue')).toBeVisible()

  expect(pageErrors).toEqual([])
})
