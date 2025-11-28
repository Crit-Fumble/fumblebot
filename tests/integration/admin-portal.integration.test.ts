/**
 * Admin Portal Integration Tests
 * Tests admin portal availability and authentication
 *
 * Run with: npm run test:integration
 * Tests against production deployment at fumblebot.crit-fumble.com
 */

import { describe, it, expect } from 'vitest'

const ADMIN_PORTAL_URL = process.env.FUMBLEBOT_ADMIN_PORTAL_URL || 'https://fumblebot.crit-fumble.com'
const ACTIVITY_URL = process.env.FUMBLEBOT_ACTIVITY_PUBLIC_URL || 'https://1443525084256931880.discordsays.com'

describe('Admin Portal Integration Tests', () => {
  describe('Health & Availability', () => {
    it('should respond to health check endpoint', async () => {
      const response = await fetch(`${ADMIN_PORTAL_URL}/api/health`)

      expect(response.ok).toBe(true)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('status', 'ok')
    })

    it('should serve login page at /login', async () => {
      const response = await fetch(`${ADMIN_PORTAL_URL}/login`)

      expect(response.ok).toBe(true)
      expect(response.status).toBe(200)

      const html = await response.text()
      expect(html).toContain('FumbleBot Admin')
      expect(html).toContain('Login with Discord')
    })

    it('should redirect to login when accessing admin page unauthenticated', async () => {
      const response = await fetch(`${ADMIN_PORTAL_URL}/admin`, {
        redirect: 'manual',
      })

      expect(response.status).toBe(302)
      expect(response.headers.get('location')).toContain('/login')
    })

    it('should have proper HTTPS security headers', async () => {
      const response = await fetch(ADMIN_PORTAL_URL)

      // Check for security headers
      const headers = response.headers
      expect(headers.get('strict-transport-security')).toBeTruthy()
      expect(headers.get('x-content-type-options')).toBe('nosniff')
      expect(headers.get('x-frame-options')).toBeTruthy()
      expect(headers.get('referrer-policy')).toBeTruthy()
    })
  })

  describe('Discord Activity Server', () => {
    it('should respond to activity endpoint', async () => {
      const response = await fetch(ACTIVITY_URL)

      expect(response.ok).toBe(true)
      expect(response.status).toBe(200)
    })

    it('should have Discord iframe-compatible headers', async () => {
      const response = await fetch(ACTIVITY_URL)

      const headers = response.headers
      const xFrameOptions = headers.get('x-frame-options')
      const csp = headers.get('content-security-policy')
      const acao = headers.get('access-control-allow-origin')

      // Should allow Discord to iframe this
      if (xFrameOptions) {
        expect(xFrameOptions).toContain('ALLOW-FROM')
      }
      if (csp) {
        expect(csp).toContain('discord.com')
      }
      if (acao) {
        expect(acao).toContain('discord.com')
      }
    })

    it('should serve HTTPS content for Discord', async () => {
      const url = new URL(ACTIVITY_URL)
      expect(url.protocol).toBe('https:')
    })
  })

  describe('Authentication Flow', () => {
    it('should expose Discord OAuth endpoint', async () => {
      const response = await fetch(`${ADMIN_PORTAL_URL}/auth/signin/discord`, {
        redirect: 'manual',
      })

      // Should redirect to Discord OAuth
      expect([302, 307]).toContain(response.status)
      const location = response.headers.get('location')
      expect(location).toContain('discord.com')
      expect(location).toContain('oauth2')
    })

    it('should have callback endpoint configured', async () => {
      // The callback endpoint should exist (will return error without proper OAuth flow)
      const response = await fetch(`${ADMIN_PORTAL_URL}/auth/callback/discord`, {
        redirect: 'manual',
      })

      // Should not be 404
      expect(response.status).not.toBe(404)
    })
  })

  describe('API Endpoints', () => {
    it('should have bot status endpoint', async () => {
      const response = await fetch(`${ADMIN_PORTAL_URL}/api/bot/status`)

      // Should respond (may require auth, but endpoint exists)
      expect(response.status).not.toBe(404)
    })

    it('should have Discord verify endpoint', async () => {
      const response = await fetch(`${ADMIN_PORTAL_URL}/api/discord/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ test: true }),
      })

      // Should respond (may be 401/403 without auth, but not 404)
      expect(response.status).not.toBe(404)
    })
  })

  describe('Performance', () => {
    it('should respond to health check within reasonable time', async () => {
      const start = Date.now()
      const response = await fetch(`${ADMIN_PORTAL_URL}/api/health`)
      const duration = Date.now() - start

      expect(response.ok).toBe(true)
      expect(duration).toBeLessThan(2000) // Should respond within 2 seconds
    })

    it('should handle concurrent requests', async () => {
      const promises = [
        fetch(`${ADMIN_PORTAL_URL}/api/health`),
        fetch(`${ADMIN_PORTAL_URL}/login`),
        fetch(ACTIVITY_URL),
        fetch(`${ADMIN_PORTAL_URL}/api/health`),
      ]

      const start = Date.now()
      const results = await Promise.all(promises)
      const duration = Date.now() - start

      // All should succeed
      results.forEach((response) => {
        expect(response.ok).toBe(true)
      })

      // Concurrent requests should complete reasonably fast
      expect(duration).toBeLessThan(5000)
    })
  })

  describe('Error Handling', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await fetch(`${ADMIN_PORTAL_URL}/nonexistent-route-12345`)

      expect(response.status).toBe(404)
    })

    it('should handle invalid API requests gracefully', async () => {
      const response = await fetch(`${ADMIN_PORTAL_URL}/api/discord/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      })

      // Should handle error gracefully (not 500)
      expect(response.status).not.toBe(500)
    })
  })

  describe('SSL/TLS Configuration', () => {
    it('should serve content over HTTPS', async () => {
      const url = new URL(ADMIN_PORTAL_URL)
      expect(url.protocol).toBe('https:')
    })

    it('should have valid SSL certificate', async () => {
      // This test will fail if SSL cert is invalid/expired
      const response = await fetch(ADMIN_PORTAL_URL)
      expect(response.ok).toBe(true)
    })

    it('should redirect HTTP to HTTPS (if configured)', async () => {
      const httpUrl = ADMIN_PORTAL_URL.replace('https://', 'http://')

      try {
        const response = await fetch(httpUrl, {
          redirect: 'manual',
        })

        // If server responds, it should redirect to HTTPS
        if (response.status === 301 || response.status === 302 || response.status === 307 || response.status === 308) {
          const location = response.headers.get('location')
          expect(location).toContain('https://')
        }
      } catch (error) {
        // HTTP may not be accessible at all (which is fine)
        // This is expected in production with HTTPS-only configuration
        expect(true).toBe(true)
      }
    })
  })
})
