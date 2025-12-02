import { defineConfig, devices } from 'playwright/test'

/**
 * Playwright Configuration for FumbleBot Integration Tests
 *
 * Tests the FumbleBot platform server (API and UI endpoints)
 * Make sure to start the server before running tests: npm run platform:dev
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
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'on', // Capture screenshots for all tests
    video: 'retain-on-failure',
  },

  projects: [
    // API-only tests (no browser needed)
    {
      name: 'api',
      testMatch: /.*\.api\.test\.ts/,
      use: {},
    },

    // Browser tests for FumbleBot UI
    {
      name: 'chromium',
      testMatch: /.*\.browser\.test\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
