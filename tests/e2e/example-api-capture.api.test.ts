import { test, expect } from '@playwright/test'
import { captureAPICall, createCapturingRequest } from '../helpers/capture'

/**
 * Example API Integration Test with Request/Response Capture
 *
 * This test demonstrates how to capture API request and response data
 * to the tests/output/data folder for inspection and debugging.
 *
 * These tests target the FumbleBot platform server API endpoints.
 * Make sure the server is running: npm run platform:dev
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'

test.describe('FumbleBot API Tests', () => {
  test('should capture health check API call', async ({ request }) => {
    const url = `${BASE_URL}/api/health`
    const response = await request.get(url)

    // Capture the request/response for inspection
    await captureAPICall(
      response,
      {
        name: 'health-check',
        testName: test.info().title,
      },
      {
        method: 'GET',
        url,
        headers: {},
      }
    )

    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    expect(data).toHaveProperty('status')
  })

  test('should capture stats API call', async ({ request }) => {
    const url = `${BASE_URL}/api/stats`
    const response = await request.get(url)

    // Capture for inspection
    await captureAPICall(
      response,
      {
        name: 'stats',
        testName: test.info().title,
      },
      {
        method: 'GET',
        url,
        headers: {},
      }
    )

    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    expect(data).toBeDefined()
  })

  test('should auto-capture all API calls in test', async ({ request }) => {
    // Create a capturing request wrapper
    const capturingRequest = createCapturingRequest(request, test.info().title)

    // All API calls will be automatically captured
    const healthResponse = await capturingRequest.get(`${BASE_URL}/api/health`)
    expect(healthResponse.ok()).toBeTruthy()

    // Multiple calls are captured with timestamps
    const statsResponse = await capturingRequest.get(`${BASE_URL}/api/stats`)
    expect(statsResponse.ok()).toBeTruthy()

    // This will have captured both API calls to tests/output/data/
  })
})

test.describe('API Error & Authentication Tests', () => {
  test('should capture 404 for invalid endpoint', async ({ request }) => {
    // Test an invalid endpoint
    const url = `${BASE_URL}/api/invalid-endpoint-that-does-not-exist`
    const response = await request.get(url)

    // Capture the error response
    await captureAPICall(
      response,
      {
        name: 'api-error-404',
        testName: test.info().title,
      },
      {
        method: 'GET',
        url,
        headers: {},
      }
    )

    // The captured file will show the 404 error details
    expect(response.status()).toBe(404)
  })

  test('should capture 401 for protected admin endpoint', async ({ request }) => {
    // Try to access admin endpoint without authentication
    const url = `${BASE_URL}/api/admin/bot-status`
    const response = await request.get(url)

    // Capture the auth failure response
    await captureAPICall(
      response,
      {
        name: 'admin-unauthorized',
        testName: test.info().title,
      },
      {
        method: 'GET',
        url,
        headers: {},
      }
    )

    // Should be unauthorized
    expect(response.status()).toBe(401)
  })
})
