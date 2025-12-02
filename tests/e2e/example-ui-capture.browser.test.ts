import { test, expect } from '@playwright/test'
import { captureScreenshot } from '../helpers/capture'

/**
 * Example Browser Integration Test with Screenshot Capture
 *
 * This test demonstrates how to capture screenshots during UI tests
 * to the tests/output/screenshots folder for visual verification and debugging.
 *
 * These tests target the FumbleBot platform UI (login, admin dashboard, etc.).
 * Make sure the server is running: npm run platform:dev
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'

test.describe('FumbleBot UI Tests', () => {
  test('should capture login page screenshots', async ({ page }) => {
    // Navigate to login page
    await page.goto(`${BASE_URL}/login`)

    // Capture initial page load
    await captureScreenshot(page, {
      name: 'login-page-initial',
      testName: test.info().title,
    })

    // Wait for content to be ready
    await page.waitForLoadState('networkidle')

    // Capture after load
    await captureScreenshot(page, {
      name: 'login-page-loaded',
      testName: test.info().title,
    })

    // Verify page loaded correctly
    expect(page.url()).toContain('/login')
  })

  test('should capture admin page (redirect to login)', async ({ page }) => {
    // Try to access admin page without authentication
    await page.goto(`${BASE_URL}/admin`)

    // Wait for redirect or error page
    await page.waitForLoadState('networkidle')

    // Capture the result (likely redirect to login or 401)
    await captureScreenshot(page, {
      name: 'admin-unauthenticated',
      testName: test.info().title,
    })

    // Should redirect to login or show unauthorized
    const url = page.url()
    const isLoginOrUnauth = url.includes('/login') || (await page.locator('text=Unauthorized').count()) > 0
    expect(isLoginOrUnauth).toBeTruthy()
  })

  test('should capture responsive login page layouts', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    await page.waitForLoadState('networkidle')

    // Desktop view
    await page.setViewportSize({ width: 1920, height: 1080 })
    await captureScreenshot(page, {
      name: 'login-desktop-view',
      testName: test.info().title,
    })

    // Tablet view
    await page.setViewportSize({ width: 768, height: 1024 })
    await captureScreenshot(page, {
      name: 'login-tablet-view',
      testName: test.info().title,
    })

    // Mobile view
    await page.setViewportSize({ width: 375, height: 667 })
    await captureScreenshot(page, {
      name: 'login-mobile-view',
      testName: test.info().title,
    })
  })
})

test.describe('UI Error State Capture', () => {
  test('should capture 404 page', async ({ page }) => {
    // Navigate to non-existent page
    await page.goto(`${BASE_URL}/this-page-does-not-exist`)
    await page.waitForLoadState('networkidle')

    // Capture the 404 page
    await captureScreenshot(page, {
      name: '404-error-page',
      testName: test.info().title,
    })

    // Verify we got a 404 or redirect
    const response = await page.goto(`${BASE_URL}/this-page-does-not-exist`)
    expect(response?.status()).toBeGreaterThanOrEqual(400)
  })
})
