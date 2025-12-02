# FumbleBot Test Suite

Comprehensive testing infrastructure for FumbleBot with automatic screenshot and request/response capture.

## Test Structure

```
tests/
├── unit/                    # Unit tests (Vitest)
├── integration/             # Integration tests (Vitest)
├── e2e/                     # End-to-end tests (Playwright)
│   ├── *.api.test.ts       # API tests (no browser)
│   └── *.browser.test.ts   # Browser UI tests
├── helpers/                 # Test utilities and helpers
│   └── capture.ts          # Screenshot and API capture utilities
├── output/                  # Test output (gitignored)
│   ├── screenshots/        # UI test screenshots
│   └── data/              # API request/response data
├── results/                # Test results (gitignored)
│   ├── html/              # Playwright HTML report
│   ├── artifacts/         # Videos, traces, etc.
│   └── results.json       # Test results JSON
└── setup.ts               # Test setup configuration
```

## Running Tests

### Unit Tests (Vitest)

```bash
# Run all unit tests
npm run test:unit

# Run with watch mode
npm run test:watch

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage
```

### Integration Tests (Vitest)

```bash
# Run all integration tests
npm run test:integration

# Run with watch mode
npm run test:integration:watch
```

### E2E Tests (Playwright)

```bash
# Run all E2E tests
npm run test:e2e

# Run only API tests (no browser)
npm run test:e2e:api

# Run only browser UI tests
npm run test:e2e:browser

# Run with UI mode (interactive)
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Run in debug mode (step through tests)
npm run test:e2e:debug

# View test report
npm run test:e2e:report
```

### Cleaning Test Output

```bash
# Clean screenshots and API data
npm run test:clean:output

# Clean test results and reports
npm run test:clean:results

# Clean everything
npm run test:clean
```

## Test Capture Features

### Screenshot Capture

All browser tests automatically capture screenshots to `tests/output/screenshots/`. You can also manually capture screenshots at any point in your tests:

```typescript
import { test } from '@playwright/test'
import { captureScreenshot } from '../helpers/capture'

test('example test', async ({ page }) => {
  await page.goto('https://example.com')

  // Capture a screenshot
  await captureScreenshot(page, {
    name: 'after-login',
    testName: test.info().title,
  })
})
```

**Screenshot Features:**
- Full-page screenshots by default
- Automatic filename generation based on test name
- Optional timestamps for multiple captures in same test
- Organized by test name for easy identification

### API Request/Response Capture

API tests can capture full request and response data to `tests/output/data/` for inspection:

```typescript
import { test } from '@playwright/test'
import { captureAPICall, createCapturingRequest } from '../helpers/capture'

test('example API test', async ({ request }) => {
  // Option 1: Manual capture
  const response = await request.get('https://api.example.com/data')
  await captureAPICall(response, {
    name: 'get-data',
    testName: test.info().title,
  })

  // Option 2: Auto-capture all requests
  const capturingRequest = createCapturingRequest(request, test.info().title)
  await capturingRequest.get('https://api.example.com/data')
  // All requests automatically captured!
})
```

**Captured Data Includes:**
- Request URL, method, headers, and body
- Response status, headers, and body
- Timestamp and test name
- Formatted as JSON for easy inspection

**Example captured data:**
```json
{
  "timestamp": "2024-12-01T20:15:30.123Z",
  "testName": "should authenticate with valid credentials",
  "request": {
    "url": "https://api.example.com/auth",
    "method": "POST",
    "headers": { "content-type": "application/json" },
    "body": { "username": "test" }
  },
  "response": {
    "status": 200,
    "statusText": "OK",
    "headers": { "content-type": "application/json" },
    "body": { "token": "abc123", "authenticated": true },
    "timing": { "duration": 0 }
  }
}
```

## Writing Tests

### API Tests

Create files matching `*.api.test.ts` in the `tests/e2e/` directory:

```typescript
import { test, expect } from '@playwright/test'
import { captureAPICall } from '../helpers/capture'

test.describe('API Feature Tests', () => {
  test('should test endpoint', async ({ request }) => {
    const response = await request.get('/api/endpoint')

    // Capture for debugging
    await captureAPICall(response, {
      name: 'endpoint-response',
      testName: test.info().title,
    })

    expect(response.ok()).toBeTruthy()
  })
})
```

### Browser UI Tests

Create files matching `*.browser.test.ts` in the `tests/e2e/` directory:

```typescript
import { test, expect } from '@playwright/test'
import { captureScreenshot } from '../helpers/capture'

test.describe('UI Feature Tests', () => {
  test('should test UI interaction', async ({ page }) => {
    await page.goto('/dashboard')

    // Capture initial state
    await captureScreenshot(page, {
      name: 'initial-load',
      testName: test.info().title,
    })

    // Perform interaction
    await page.click('button#submit')

    // Capture after interaction
    await captureScreenshot(page, {
      name: 'after-submit',
      testName: test.info().title,
    })

    await expect(page.locator('.success')).toBeVisible()
  })
})
```

## Configuration

### Playwright Configuration

The Playwright config ([playwright.config.ts](../playwright.config.ts)) is configured to:
- Capture screenshots for all tests
- Save videos on test failure
- Generate HTML and JSON reports
- Run tests in parallel
- Retry failed tests in CI

### Vitest Configuration

The Vitest config ([vitest.config.ts](../vitest.config.ts)) is configured to:
- Use Node.js environment
- Exclude E2E tests (run those with Playwright)
- Generate coverage reports
- Use setup file for global test configuration

## Running the Server for Tests

Before running E2E tests, start the FumbleBot platform server:

```bash
# Start the platform server (runs on port 3000 by default)
npm run platform:dev
```

## Environment Variables

Create a `.env` file in the project root (copy from `.env.example`):

```bash
# Test target URL (defaults to localhost:3000)
TEST_BASE_URL=http://localhost:3000

# Discord configuration (required for full functionality)
FUMBLEBOT_DISCORD_CLIENT_ID=your-bot-id
FUMBLEBOT_DISCORD_CLIENT_SECRET=your-client-secret
FUMBLEBOT_DISCORD_TOKEN=your-bot-token

# Admin user IDs for testing protected endpoints
FUMBLEBOT_ADMIN_IDS=your-discord-user-id
```

## CI/CD Integration

Tests are designed to run in CI environments:

```yaml
# GitHub Actions example
- name: Run Tests
  run: |
    npm run test:unit
    npm run test:e2e
  env:
    TEST_BASE_URL: ${{ secrets.TEST_BASE_URL }}
    FUMBLEBOT_API_SECRET: ${{ secrets.FUMBLEBOT_API_SECRET }}
```

## Troubleshooting

### Tests are slow
- Use `test:e2e:api` for API-only tests (no browser overhead)
- Reduce screenshot capture frequency
- Run tests in parallel (default)

### Screenshots not capturing
- Ensure the test file matches `*.browser.test.ts` pattern
- Check that page is loaded before capturing
- Verify `tests/output/screenshots/` directory exists

### API captures not working
- Check that response is awaited before capturing
- Verify `tests/output/data/` directory exists
- Ensure response content-type is readable (JSON/text)

### Output folder too large
- Run `npm run test:clean:output` regularly
- Set up automated cleanup in CI
- Adjust capture frequency in tests

## Best Practices

1. **Use descriptive test names** - They become part of captured filenames
2. **Capture at key moments** - Initial load, after interactions, before/after state changes
3. **Clean up regularly** - Don't let output folder grow unbounded
4. **Use auto-capture for debugging** - The `createCapturingRequest` wrapper captures all API calls
5. **Review captures in code review** - Screenshots and API data help validate test behavior
6. **Organize tests by feature** - Keep related tests together
7. **Use test.describe blocks** - Group related tests for better organization

## Examples

See the example test files for detailed usage:
- [tests/e2e/example-api-capture.api.test.ts](./e2e/example-api-capture.api.test.ts) - API capture examples
- [tests/e2e/example-ui-capture.browser.test.ts](./e2e/example-ui-capture.browser.test.ts) - Screenshot capture examples

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Vitest Documentation](https://vitest.dev/)
- [Project Documentation](../docs/)
