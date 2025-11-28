import { test, expect } from 'playwright/test'

/**
 * Wiki API Integration Tests
 *
 * Tests the FumbleBot's ability to interact with wiki endpoints
 */

const BOT_DISCORD_ID = process.env.FUMBLEBOT_DISCORD_CLIENT_ID || '1443525084256931880'
const BOT_API_SECRET = process.env.FUMBLEBOT_API_SECRET || ''
const BASE_URL = process.env.TEST_BASE_URL || 'https://www.crit-fumble.com'

const botHeaders = {
  'X-Discord-Bot-Id': BOT_DISCORD_ID,
  'X-Bot-Secret': BOT_API_SECRET,
  'X-Bot-Source': 'fumblebot',
  'Content-Type': 'application/json',
}

test.describe('Wiki API - Read Operations', () => {
  test('should list wiki pages with bot auth', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/wiki`, {
      headers: botHeaders,
    })

    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    expect(data).toHaveProperty('pages')
    expect(Array.isArray(data.pages)).toBe(true)
  })

  test('should reject wiki list without auth', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/wiki`)

    // Should be 401 Unauthorized
    expect(response.status()).toBe(401)
  })
})

test.describe('Wiki API - Write Operations', () => {
  const testSlug = `test-bot-page-${Date.now()}`

  test('should create a wiki page with bot auth', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/wiki`, {
      headers: botHeaders,
      data: {
        slug: testSlug,
        title: 'Test Bot Page',
        category: 'test',
        content: 'This is a test page created by FumbleBot integration tests.',
      },
    })

    expect(response.ok()).toBeTruthy()
    const page = await response.json()
    expect(page.slug).toBe(testSlug)
    expect(page.title).toBe('Test Bot Page')
    expect(page.category).toBe('test')
  })

  test('should update a wiki page with bot auth', async ({ request }) => {
    // First, get the page list to find our test page
    const listResponse = await request.get(`${BASE_URL}/api/wiki`, {
      headers: botHeaders,
    })
    const { pages } = await listResponse.json()
    const testPage = pages.find((p: { slug: string }) => p.slug === testSlug)

    if (!testPage) {
      test.skip(true, 'Test page not found - create test may have failed')
      return
    }

    const response = await request.patch(`${BASE_URL}/api/wiki/${testPage.id}`, {
      headers: botHeaders,
      data: {
        content: 'Updated content by FumbleBot integration tests.',
        changeNote: 'Integration test update',
      },
    })

    expect(response.ok()).toBeTruthy()
    const updated = await response.json()
    expect(updated.content).toContain('Updated content')
  })

  test('should reject wiki creation without auth', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/wiki`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        slug: 'unauthorized-page',
        title: 'Unauthorized Page',
        category: 'test',
      },
    })

    expect(response.status()).toBe(401)
  })

  test('should reject wiki creation with invalid auth', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/wiki`, {
      headers: {
        'X-Discord-Bot-Id': 'fake-bot',
        'X-Bot-Secret': 'fake-secret',
        'Content-Type': 'application/json',
      },
      data: {
        slug: 'fake-auth-page',
        title: 'Fake Auth Page',
        category: 'test',
      },
    })

    // Should be 401 or 403
    expect([401, 403]).toContain(response.status())
  })

  test('should validate required fields', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/wiki`, {
      headers: botHeaders,
      data: {
        // Missing required fields: slug, title, category
        content: 'Some content',
      },
    })

    expect(response.status()).toBe(400)
    const error = await response.json()
    expect(error.error).toContain('required')
  })

  test('should reject duplicate slugs', async ({ request }) => {
    // Try to create a page with the same slug
    const response = await request.post(`${BASE_URL}/api/wiki`, {
      headers: botHeaders,
      data: {
        slug: testSlug, // Same as test page created above
        title: 'Duplicate Page',
        category: 'test',
      },
    })

    expect(response.status()).toBe(409) // Conflict
  })
})

test.describe('Wiki API - Bot Permissions', () => {
  test('bot should have admin role (not owner)', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/bot/status`, {
      headers: botHeaders,
    })

    const data = await response.json()
    expect(data.role).toBe('admin')
    // Admin can edit but not delete
  })

  test('bot should NOT be able to delete wiki pages', async ({ request }) => {
    // First get a page ID
    const listResponse = await request.get(`${BASE_URL}/api/wiki`, {
      headers: botHeaders,
    })
    const { pages } = await listResponse.json()

    if (pages.length === 0) {
      test.skip(true, 'No pages to test delete on')
      return
    }

    const pageId = pages[0].id

    // Try to delete - should fail with 403 (admin can't delete, only owner)
    const response = await request.delete(`${BASE_URL}/api/wiki/${pageId}`, {
      headers: botHeaders,
    })

    expect(response.status()).toBe(403)
  })
})
