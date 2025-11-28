import { defineConfig, devices } from 'playwright/test'

/**
 * Playwright Configuration for FumbleBot Integration Tests
 *
 * Tests the bot's API integration with crit-fumble.com website
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'tests/results/html' }],
    ['json', { outputFile: 'tests/results/results.json' }],
    ['list'],
  ],
  outputDir: 'tests/results/artifacts',

  use: {
    baseURL: process.env.TEST_BASE_URL || 'https://www.crit-fumble.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // API-only tests (no browser needed)
    {
      name: 'api',
      testMatch: /.*\.api\.test\.ts/,
      use: {},
    },

    // Browser tests for website integration
    {
      name: 'chromium',
      testMatch: /.*\.browser\.test\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
