import { test, expect } from '@playwright/test'
import { captureAPICall, createCapturingRequest } from '../helpers/capture'

/**
 * Example API Integration Test with Request/Response Capture
 *
 * This test demonstrates how to capture API request and response data
 * to the tests/output/data folder for inspection and debugging.
 */

const BASE_URL = process.env.TEST_BASE_URL || 'https://www.crit-fumble.com'

test.describe('API Capture Examples', () => {
  test('should capture health check API call', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`)

    // Capture the request/response for inspection
    await captureAPICall(response, {
      name: 'health-check',
      testName: test.info().title,
    })

    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    expect(data.status).toBe('ok')
  })

  test('should capture bot authentication flow', async ({ request }) => {
    const BOT_DISCORD_ID = process.env.FUMBLEBOT_DISCORD_CLIENT_ID || '1443525084256931880'
    const BOT_API_SECRET = process.env.FUMBLEBOT_API_SECRET || ''

    // Make the API call
    const response = await request.get(`${BASE_URL}/api/bot/status`, {
      headers: {
        'X-Discord-Bot-Id': BOT_DISCORD_ID,
        'X-Bot-Secret': BOT_API_SECRET,
        'X-Bot-Source': 'fumblebot',
      },
    })

    // Capture for inspection
    await captureAPICall(response, {
      name: 'bot-auth-success',
      testName: test.info().title,
    })

    expect(response.ok()).toBeTruthy()
  })

  test('should auto-capture all API calls in test', async ({ request }) => {
    // Create a capturing request wrapper
    const capturingRequest = createCapturingRequest(request, test.info().title)

    // All API calls will be automatically captured
    const healthResponse = await capturingRequest.get(`${BASE_URL}/api/health`)
    expect(healthResponse.ok()).toBeTruthy()

    // Multiple calls are captured with timestamps
    const statusResponse = await capturingRequest.get(`${BASE_URL}/api/bot/status`, {
      headers: {
        'X-Discord-Bot-Id': 'test-bot',
        'X-Bot-Source': 'fumblebot',
      },
    })

    // This will have captured both API calls to tests/output/data/
  })
})

test.describe('API Error Capture', () => {
  test('should capture failed API responses', async ({ request }) => {
    // Test an invalid endpoint
    const response = await request.get(`${BASE_URL}/api/invalid-endpoint`)

    // Capture the error response
    await captureAPICall(response, {
      name: 'api-error-404',
      testName: test.info().title,
    })

    // The captured file will show the 404 error details
    expect(response.status()).toBe(404)
  })

  test('should capture authentication failures', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/bot/status`, {
      headers: {
        'X-Discord-Bot-Id': 'invalid-id',
        'X-Bot-Secret': 'invalid-secret',
        'X-Bot-Source': 'fumblebot',
      },
    })

    // Capture the auth failure response
    await captureAPICall(response, {
      name: 'auth-failure',
      testName: test.info().title,
    })

    const data = await response.json()
    expect(data.authenticated).toBe(false)
  })
})
