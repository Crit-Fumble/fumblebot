import { test, expect } from 'playwright/test'

/**
 * Bot Authentication API Tests
 *
 * Tests the FumbleBot authentication flow with crit-fumble.com
 * Uses the same auth headers that FumbleBot sends
 */

const BOT_DISCORD_ID = process.env.FUMBLEBOT_DISCORD_CLIENT_ID || '1443525084256931880'
const BOT_API_SECRET = process.env.FUMBLEBOT_API_SECRET || ''
const BASE_URL = process.env.TEST_BASE_URL || 'https://www.crit-fumble.com'

test.describe('Bot Authentication', () => {
  test('should authenticate with valid bot credentials', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/bot/status`, {
      headers: {
        'X-Discord-Bot-Id': BOT_DISCORD_ID,
        'X-Bot-Secret': BOT_API_SECRET,
        'X-Bot-Source': 'fumblebot',
      },
    })

    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    expect(data.authenticated).toBe(true)
    expect(data.role).toBe('admin')
    expect(data.discordId).toBe(BOT_DISCORD_ID)
  })

  test('should reject request without bot secret', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/bot/status`, {
      headers: {
        'X-Discord-Bot-Id': BOT_DISCORD_ID,
        'X-Bot-Source': 'fumblebot',
      },
    })

    // Should return 401 or have authenticated: false
    const data = await response.json()
    expect(data.authenticated).toBe(false)
  })

  test('should reject request with invalid bot ID', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/bot/status`, {
      headers: {
        'X-Discord-Bot-Id': 'invalid-bot-id',
        'X-Bot-Secret': BOT_API_SECRET,
        'X-Bot-Source': 'fumblebot',
      },
    })

    const data = await response.json()
    expect(data.authenticated).toBe(false)
  })

  test('should reject request with invalid secret', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/bot/status`, {
      headers: {
        'X-Discord-Bot-Id': BOT_DISCORD_ID,
        'X-Bot-Secret': 'invalid-secret',
        'X-Bot-Source': 'fumblebot',
      },
    })

    const data = await response.json()
    expect(data.authenticated).toBe(false)
  })
})

test.describe('Bot Health Check', () => {
  test('should return health status', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`)

    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    expect(data.status).toBe('ok')
  })

  test('should respond within acceptable time', async ({ request }) => {
    const start = Date.now()
    const response = await request.get(`${BASE_URL}/api/health`)
    const duration = Date.now() - start

    expect(response.ok()).toBeTruthy()
    expect(duration).toBeLessThan(2000) // 2 seconds max
  })
})
