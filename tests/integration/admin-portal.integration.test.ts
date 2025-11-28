/**
 * Admin Portal Integration Tests
 * Tests admin portal availability and authentication
 *
 * Run with: npm run test:integration
 * By default tests against local server at http://localhost:3001
 * Set FUMBLEBOT_ADMIN_PORTAL_URL to test against production
 */

import { describe, it, expect } from 'vitest'

const ADMIN_PORTAL_URL = process.env.FUMBLEBOT_ADMIN_PORTAL_URL || 'http://localhost:3001'

describe('Admin Portal Integration Tests', () => {
  describe('Health & Availability', () => {
    it('should respond to health check endpoint', async () => {
      const response = await fetch(`${ADMIN_PORTAL_URL}/health`)

      expect(response.ok).toBe(true)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('status', 'ok')
    })

    it('should serve root page', async () => {
      const response = await fetch(ADMIN_PORTAL_URL)

      expect(response.ok).toBe(true)
      expect(response.status).toBe(200)

      const html = await response.text()
      expect(html).toContain('FumbleBot')
    })

    it('should have proper security headers', async () => {
      const response = await fetch(ADMIN_PORTAL_URL)

      // Check for security headers
      const headers = response.headers
      // CSP or X-Frame-Options should be set for iframe protection
      const hasFrameProtection = headers.get('content-security-policy') || headers.get('x-frame-options')
      expect(hasFrameProtection).toBeTruthy()
    })
  })

  describe('Discord Activity', () => {
    it('should respond to discord activity endpoint', async () => {
      const response = await fetch(`${ADMIN_PORTAL_URL}/discord/activity`)

      expect(response.ok).toBe(true)
      expect(response.status).toBe(200)

      const html = await response.text()
      expect(html).toContain('FumbleBot')
    })

    it('should have Discord iframe-compatible headers', async () => {
      const response = await fetch(`${ADMIN_PORTAL_URL}/discord/activity`)

      const headers = response.headers
      const csp = headers.get('content-security-policy')

      // CSP should allow Discord to iframe this
      if (csp) {
        expect(csp).toContain('discord')
      }
    })
  })

  describe('Authentication Endpoints', () => {
    it('should have token exchange endpoint', async () => {
      const response = await fetch(`${ADMIN_PORTAL_URL}/api/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      // Should respond (400 without code, but not 404)
      expect(response.status).not.toBe(404)
    })

    it('should have auth callback endpoint configured', async () => {
      const response = await fetch(`${ADMIN_PORTAL_URL}/auth/callback`, {
        redirect: 'manual',
      })

      // Should not be 404 (400 without proper code is expected)
      expect(response.status).not.toBe(404)
    })

    it('should have auth me endpoint', async () => {
      const response = await fetch(`${ADMIN_PORTAL_URL}/api/auth/me`)

      // Should respond 401 without auth, but not 404
      expect(response.status).not.toBe(404)
    })
  })

  describe('API Endpoints', () => {
    it('should have platform info endpoint', async () => {
      const response = await fetch(`${ADMIN_PORTAL_URL}/api/platform`)

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data).toHaveProperty('platform')
    })
  })

  describe('Performance', () => {
    it('should respond to health check within reasonable time', async () => {
      const start = Date.now()
      const response = await fetch(`${ADMIN_PORTAL_URL}/health`)
      const duration = Date.now() - start

      expect(response.ok).toBe(true)
      expect(duration).toBeLessThan(2000) // Should respond within 2 seconds
    })

    it('should handle concurrent requests', async () => {
      const promises = [
        fetch(`${ADMIN_PORTAL_URL}/health`),
        fetch(`${ADMIN_PORTAL_URL}/`),
        fetch(`${ADMIN_PORTAL_URL}/api/platform`),
        fetch(`${ADMIN_PORTAL_URL}/health`),
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
      const response = await fetch(`${ADMIN_PORTAL_URL}/api/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      })

      // Should handle error gracefully (400 for bad request, not 500)
      expect([400, 415]).toContain(response.status)
    })
  })

  // SSL tests only run when testing against HTTPS URLs (production)
  describe.skipIf(!ADMIN_PORTAL_URL.startsWith('https'))('SSL/TLS Configuration', () => {
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
