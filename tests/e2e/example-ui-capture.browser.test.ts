import { test, expect } from '@playwright/test'
import { captureScreenshot } from '../helpers/capture'

/**
 * Example Browser Integration Test with Screenshot Capture
 *
 * This test demonstrates how to capture screenshots during UI tests
 * to the tests/output/screenshots folder for visual verification and debugging.
 */

const BASE_URL = process.env.TEST_BASE_URL || 'https://www.crit-fumble.com'

test.describe('UI Screenshot Capture Examples', () => {
  test('should capture homepage screenshots', async ({ page }) => {
    // Navigate to homepage
    await page.goto(BASE_URL)

    // Capture initial page load
    await captureScreenshot(page, {
      name: 'homepage-initial',
      testName: test.info().title,
    })

    // Wait for content to be ready
    await page.waitForLoadState('networkidle')

    // Capture after load
    await captureScreenshot(page, {
      name: 'homepage-loaded',
      testName: test.info().title,
    })

    // Verify page loaded correctly
    await expect(page).toHaveTitle(/Crit.?Fumble/i)
  })

  test('should capture user interaction flow', async ({ page }) => {
    await page.goto(BASE_URL)

    // Capture before interaction
    await captureScreenshot(page, {
      name: 'before-interaction',
      testName: test.info().title,
    })

    // Look for a navigation link
    const navLinks = page.locator('nav a, header a')
    if ((await navLinks.count()) > 0) {
      // Hover over first link
      await navLinks.first().hover()

      // Capture hover state
      await captureScreenshot(page, {
        name: 'hover-state',
        testName: test.info().title,
      })
    }

    // Capture final state
    await captureScreenshot(page, {
      name: 'after-interaction',
      testName: test.info().title,
    })
  })

  test('should capture responsive layouts', async ({ page }) => {
    await page.goto(BASE_URL)

    // Desktop view
    await page.setViewportSize({ width: 1920, height: 1080 })
    await captureScreenshot(page, {
      name: 'desktop-view',
      testName: test.info().title,
    })

    // Tablet view
    await page.setViewportSize({ width: 768, height: 1024 })
    await captureScreenshot(page, {
      name: 'tablet-view',
      testName: test.info().title,
    })

    // Mobile view
    await page.setViewportSize({ width: 375, height: 667 })
    await captureScreenshot(page, {
      name: 'mobile-view',
      testName: test.info().title,
    })
  })

  test('should capture modal or dialog interactions', async ({ page }) => {
    await page.goto(BASE_URL)

    // Capture before any modal/dialog
    await captureScreenshot(page, {
      name: 'before-modal',
      testName: test.info().title,
    })

    // Look for buttons that might open modals/dialogs
    const buttons = page.locator('button, [role="button"]')
    if ((await buttons.count()) > 0) {
      // Try clicking the first button
      await buttons.first().click()

      // Wait a bit for any animation
      await page.waitForTimeout(500)

      // Capture potential modal state
      await captureScreenshot(page, {
        name: 'modal-opened',
        testName: test.info().title,
      })
    }
  })
})

test.describe('UI Error State Capture', () => {
  test('should capture 404 page', async ({ page }) => {
    // Navigate to non-existent page
    await page.goto(`${BASE_URL}/this-page-does-not-exist`)

    // Capture the 404 page
    await captureScreenshot(page, {
      name: '404-error-page',
      testName: test.info().title,
    })
  })

  test('should capture form validation errors', async ({ page }) => {
    await page.goto(BASE_URL)

    // Look for any form
    const forms = page.locator('form')
    if ((await forms.count()) > 0) {
      // Capture form before submission
      await captureScreenshot(page, {
        name: 'form-before-submit',
        testName: test.info().title,
      })

      // Try to submit without filling required fields
      const submitButton = forms.first().locator('button[type="submit"], input[type="submit"]')
      if ((await submitButton.count()) > 0) {
        await submitButton.click()

        // Wait for validation
        await page.waitForTimeout(500)

        // Capture validation errors
        await captureScreenshot(page, {
          name: 'form-validation-errors',
          testName: test.info().title,
        })
      }
    }
  })
})

test.describe('UI Element State Capture', () => {
  test('should capture different component states', async ({ page }) => {
    await page.goto(BASE_URL)

    // Capture initial state
    await captureScreenshot(page, {
      name: 'initial-state',
      testName: test.info().title,
    })

    // Scroll down to see more content
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2))
    await page.waitForTimeout(300)

    await captureScreenshot(page, {
      name: 'scrolled-state',
      testName: test.info().title,
    })

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(300)

    await captureScreenshot(page, {
      name: 'bottom-state',
      testName: test.info().title,
    })
  })
})
