/**
 * Discord Activity Integration Tests
 * Tests Discord Activity endpoints, CSP headers, and SDK requirements
 *
 * Note: All UI content is served from core via proxy.
 * This tests fumblebot's API endpoints and Discord-specific middleware.
 *
 * Run with: npm run test:integration
 * By default tests against local server at http://localhost:6000
 * Set FUMBLEBOT_PLATFORM_URL to test against production
 */

import { describe, it, expect } from 'vitest'

// Use port 6000 for local dev (set in tests/setup.ts)
const PLATFORM_URL = process.env.FUMBLEBOT_PLATFORM_URL || 'http://localhost:6000'
const DISCORD_CLIENT_ID = process.env.FUMBLEBOT_DISCORD_CLIENT_ID || '1443525084256931880'

describe('Discord Activity Integration Tests', () => {
  describe('Health & Core API', () => {
    it('should respond to health check', async () => {
      const response = await fetch(`${PLATFORM_URL}/health`)

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.status).toBe('ok')
    })

    it('should return 404 for unknown routes', async () => {
      const response = await fetch(`${PLATFORM_URL}/unknown-route-xyz123`)

      expect(response.status).toBe(404)
    })
  })

  describe('Content-Security-Policy Headers', () => {
    it('should have CSP header with frame-ancestors for Discord', async () => {
      const response = await fetch(`${PLATFORM_URL}/health`)
      const csp = response.headers.get('content-security-policy')

      expect(csp).toBeTruthy()
      expect(csp).toContain('frame-ancestors')
      expect(csp).toContain('discord.com')
      expect(csp).toContain('discordsays.com')
    })

    it('should have script-src directive', async () => {
      const response = await fetch(`${PLATFORM_URL}/health`)
      const csp = response.headers.get('content-security-policy')

      expect(csp).toBeTruthy()
      expect(csp).toContain('script-src')
      expect(csp).toContain("'self'")
    })

    it('should allow connections to Discord API', async () => {
      const response = await fetch(`${PLATFORM_URL}/health`)
      const csp = response.headers.get('content-security-policy')

      expect(csp).toBeTruthy()
      expect(csp).toContain('connect-src')
      expect(csp).toContain('discord.com')
    })

    it('should allow images from Discord CDN', async () => {
      const response = await fetch(`${PLATFORM_URL}/health`)
      const csp = response.headers.get('content-security-policy')

      expect(csp).toBeTruthy()
      expect(csp).toContain('img-src')
      expect(csp).toContain('discordapp.com')
    })

    it('should include client ID in frame-ancestors', async () => {
      const response = await fetch(`${PLATFORM_URL}/health`)
      const csp = response.headers.get('content-security-policy')

      expect(csp).toBeTruthy()
      // Should include {client_id}.discordsays.com
      expect(csp).toContain(`${DISCORD_CLIENT_ID}.discordsays.com`)
    })
  })

  describe('Token Exchange Endpoint', () => {
    it('should have /api/token endpoint', async () => {
      const response = await fetch(`${PLATFORM_URL}/api/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      // Should respond with 400 (missing code), not 404
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.error).toContain('code')
    })

    it('should reject invalid authorization codes', async () => {
      const response = await fetch(`${PLATFORM_URL}/api/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'invalid-test-code' }),
      })

      // Discord API will reject invalid codes
      expect(response.status).toBe(400)
    })
  })

  describe('CORS Configuration', () => {
    it('should allow Discord origin', async () => {
      const response = await fetch(`${PLATFORM_URL}/health`, {
        headers: {
          'Origin': 'https://discord.com',
        },
      })

      const allowOrigin = response.headers.get('access-control-allow-origin')
      expect(allowOrigin).toBeTruthy()
    })

    it('should allow discordsays.com origin', async () => {
      const response = await fetch(`${PLATFORM_URL}/health`, {
        headers: {
          'Origin': `https://${DISCORD_CLIENT_ID}.discordsays.com`,
        },
      })

      const allowOrigin = response.headers.get('access-control-allow-origin')
      expect(allowOrigin).toBeTruthy()
    })

    it('should allow credentials', async () => {
      const response = await fetch(`${PLATFORM_URL}/health`, {
        headers: {
          'Origin': 'https://discord.com',
        },
      })

      const allowCreds = response.headers.get('access-control-allow-credentials')
      expect(allowCreds).toBe('true')
    })

    it('should handle OPTIONS preflight requests', async () => {
      const response = await fetch(`${PLATFORM_URL}/api/token`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://discord.com',
          'Access-Control-Request-Method': 'POST',
        },
      })

      expect(response.status).toBe(200)
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await fetch(`${PLATFORM_URL}/api/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{invalid json',
      })

      // Should return 400, not 500
      expect(response.status).toBeLessThan(500)
    })
  })

  describe('Performance', () => {
    it('should respond to health check within 2 seconds', async () => {
      const start = Date.now()
      const response = await fetch(`${PLATFORM_URL}/health`)
      const duration = Date.now() - start

      expect(response.ok).toBe(true)
      expect(duration).toBeLessThan(2000)
    })

    it('should handle concurrent requests', async () => {
      const promises = Array(5).fill(null).map(() =>
        fetch(`${PLATFORM_URL}/health`)
      )

      const start = Date.now()
      const responses = await Promise.all(promises)
      const duration = Date.now() - start

      responses.forEach(response => {
        expect(response.ok).toBe(true)
      })

      expect(duration).toBeLessThan(5000)
    })
  })

  describe('Authentication Endpoints', () => {
    it('should have auth me endpoint', async () => {
      const response = await fetch(`${PLATFORM_URL}/api/auth/me`)

      // Should respond (200 or 401 without auth, but not 404)
      expect(response.status).not.toBe(404)
    })

    it('should have auth guilds endpoint', async () => {
      const response = await fetch(`${PLATFORM_URL}/api/auth/guilds`)

      // Should respond (200 or 401 without auth, but not 404)
      expect(response.status).not.toBe(404)
    })

    it('should have auth activities endpoint', async () => {
      const response = await fetch(`${PLATFORM_URL}/api/auth/activities`)

      // Should respond (200 or 401 without auth, but not 404)
      expect(response.status).not.toBe(404)
    })
  })

  // Production-only SSL tests
  describe.skipIf(!PLATFORM_URL.startsWith('https'))('Production SSL', () => {
    it('should serve content over HTTPS', async () => {
      const response = await fetch(`${PLATFORM_URL}/health`)
      expect(response.ok).toBe(true)
    })

    it('should have HSTS header', async () => {
      const response = await fetch(`${PLATFORM_URL}/health`)
      const hsts = response.headers.get('strict-transport-security')

      // HSTS should be set in production
      expect(hsts).toBeTruthy()
    })
  })
})
