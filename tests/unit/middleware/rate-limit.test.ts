/**
 * Rate Limiting Middleware Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import {
  createRateLimiter,
  chatKeyGenerator,
  commandKeyGenerator,
} from '../../../src/middleware/rate-limit.js';

// Counter for unique IPs to avoid test interference from global rate limit store
let testCounter = 0;

// Helper to create mock request with unique IP by default
function createMockRequest(overrides: Partial<Request> = {}): Request {
  testCounter++;
  const uniqueIp = overrides.ip ?? `10.0.${Math.floor(testCounter / 256)}.${testCounter % 256}`;
  return {
    ip: uniqueIp,
    socket: { remoteAddress: uniqueIp },
    headers: {},
    ...overrides,
  } as unknown as Request;
}

// Helper to create mock response
function createMockResponse(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe('Rate Limiting Middleware', () => {
  describe('createRateLimiter', () => {
    let mockNext: NextFunction;

    beforeEach(() => {
      mockNext = vi.fn();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should allow requests under the limit', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 10,
        blockDurationMs: 30000,
      });

      const req = createMockRequest();
      const res = createMockResponse();

      limiter(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should set rate limit headers', () => {
      // Use unique key to avoid test interference
      const uniqueKey = `test-headers-${Date.now()}`;
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 10,
        blockDurationMs: 30000,
        keyGenerator: () => uniqueKey,
      });

      const req = createMockRequest();
      const res = createMockResponse();

      limiter(req, res, mockNext);

      expect(res.set).toHaveBeenCalledWith('X-RateLimit-Limit', '10');
      expect(res.set).toHaveBeenCalledWith('X-RateLimit-Remaining', '9');
      expect(res.set).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
    });

    it('should decrement remaining count on each request', () => {
      // Use unique key to avoid test interference
      const uniqueKey = `test-decrement-${Date.now()}`;
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 10,
        blockDurationMs: 30000,
        keyGenerator: () => uniqueKey,
      });

      const req = createMockRequest();

      for (let i = 0; i < 5; i++) {
        const res = createMockResponse();
        limiter(req, res, mockNext);
        expect(res.set).toHaveBeenCalledWith('X-RateLimit-Remaining', String(10 - i - 1));
      }
    });

    it('should block when limit is exceeded', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 3,
        blockDurationMs: 30000,
      });

      const req = createMockRequest();

      // Make 3 allowed requests
      for (let i = 0; i < 3; i++) {
        const res = createMockResponse();
        limiter(req, res, mockNext);
      }

      // 4th request should be blocked
      const res = createMockResponse();
      limiter(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Too many requests',
        retryAfter: 30,
        message: expect.stringContaining('Rate limit exceeded'),
      });
    });

    it('should set Retry-After header when blocked', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        blockDurationMs: 30000,
      });

      const req = createMockRequest();

      // First request allowed
      limiter(req, createMockResponse(), mockNext);

      // Second request blocked
      const res = createMockResponse();
      limiter(req, res, mockNext);

      expect(res.set).toHaveBeenCalledWith('Retry-After', '30');
    });

    it('should remain blocked for the duration', () => {
      // Use unique key to avoid test interference
      const uniqueKey = `test-blocked-duration-${Date.now()}`;
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        blockDurationMs: 30000,
        keyGenerator: () => uniqueKey,
      });

      const req = createMockRequest();

      // Exceed limit
      limiter(req, createMockResponse(), mockNext);
      limiter(req, createMockResponse(), mockNext);

      // Still blocked after 15 seconds
      vi.advanceTimersByTime(15000);
      const res1 = createMockResponse();
      limiter(req, res1, mockNext);
      expect(res1.status).toHaveBeenCalledWith(429);

      // After block expires (30s) but before window expires (60s), the counter is
      // still exceeded (count=2 > maxRequests=1), causing a new block.
      // Need to wait past both block AND window to fully reset.
      vi.advanceTimersByTime(50000); // Total 65s - past both block (30s) and window (60s)
      const res2 = createMockResponse();
      const next2 = vi.fn();
      limiter(req, res2, next2);
      expect(next2).toHaveBeenCalled();
    });

    it('should reset count after window expires', () => {
      // Use unique key to avoid test interference
      const uniqueKey = `test-reset-window-${Date.now()}`;
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 2,
        blockDurationMs: 30000,
        keyGenerator: () => uniqueKey,
      });

      const req = createMockRequest();

      // Use up quota
      limiter(req, createMockResponse(), mockNext);
      limiter(req, createMockResponse(), mockNext);

      // Advance past window
      vi.advanceTimersByTime(61000);

      // Should have fresh quota
      const res = createMockResponse();
      const next = vi.fn();
      limiter(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.set).toHaveBeenCalledWith('X-RateLimit-Remaining', '1');
    });

    it('should use custom key generator', () => {
      const customKeyGenerator = vi.fn().mockReturnValue('custom-key');
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 10,
        blockDurationMs: 30000,
        keyGenerator: customKeyGenerator,
      });

      const req = createMockRequest();
      const res = createMockResponse();

      limiter(req, res, mockNext);

      expect(customKeyGenerator).toHaveBeenCalledWith(req);
    });

    it('should track different keys separately', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 2,
        blockDurationMs: 30000,
      });

      const req1 = createMockRequest({ ip: '1.1.1.1' });
      const req2 = createMockRequest({ ip: '2.2.2.2' });

      // Exhaust req1's limit
      limiter(req1, createMockResponse(), mockNext);
      limiter(req1, createMockResponse(), mockNext);
      const res1 = createMockResponse();
      limiter(req1, res1, mockNext);
      expect(res1.status).toHaveBeenCalledWith(429);

      // req2 should still have full quota
      const res2 = createMockResponse();
      const next2 = vi.fn();
      limiter(req2, res2, next2);
      expect(next2).toHaveBeenCalled();
      expect(res2.set).toHaveBeenCalledWith('X-RateLimit-Remaining', '1');
    });
  });

  describe('chatKeyGenerator', () => {
    it('should use user ID from header', () => {
      const req = createMockRequest({
        headers: { 'x-discord-user-id': 'user123' },
      });

      const key = chatKeyGenerator(req);

      expect(key).toBe('chat:user123');
    });

    it('should use anonymous for missing user ID', () => {
      const req = createMockRequest();

      const key = chatKeyGenerator(req);

      expect(key).toBe('chat:anonymous');
    });
  });

  describe('commandKeyGenerator', () => {
    it('should use user ID from session', () => {
      const req = createMockRequest() as any;
      req.session = { user: { discordId: 'sessionUser456' } };

      const key = commandKeyGenerator(req);

      expect(key).toBe('cmd:sessionUser456');
    });

    it('should fall back to IP when no session', () => {
      const req = createMockRequest({ ip: '10.0.0.1' });

      const key = commandKeyGenerator(req);

      expect(key).toBe('cmd:10.0.0.1');
    });

    it('should use anonymous as last resort', () => {
      const req = createMockRequest({ ip: undefined });
      (req as any).socket = { remoteAddress: undefined };

      const key = commandKeyGenerator(req);

      expect(key).toBe('cmd:anonymous');
    });
  });

  describe('Default key generator', () => {
    it('should prefer user ID over IP', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        blockDurationMs: 30000,
      });

      // First request with user ID
      const req1 = createMockRequest({
        ip: '1.1.1.1',
        headers: { 'x-discord-user-id': 'testuser' },
      });
      limiter(req1, createMockResponse(), vi.fn());

      // Second request with same user but different IP - should be counted
      const req2 = createMockRequest({
        ip: '2.2.2.2',
        headers: { 'x-discord-user-id': 'testuser' },
      });
      const res = createMockResponse();
      limiter(req2, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(429);
    });

    it('should use IP when no user ID', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        blockDurationMs: 30000,
      });

      // First request
      const req1 = createMockRequest({ ip: '1.1.1.1' });
      limiter(req1, createMockResponse(), vi.fn());

      // Same IP should be blocked
      const req2 = createMockRequest({ ip: '1.1.1.1' });
      const res = createMockResponse();
      limiter(req2, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(429);
    });

    it('should use socket remoteAddress as fallback', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 10,
        blockDurationMs: 30000,
      });

      const req = createMockRequest({ ip: undefined });
      (req as any).socket = { remoteAddress: '192.168.1.1' };

      const res = createMockResponse();
      limiter(req, res, vi.fn());

      // Should succeed and use socket address
      expect(res.set).toHaveBeenCalledWith('X-RateLimit-Remaining', '9');
    });
  });

  describe('Edge cases', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should handle zero remaining correctly', () => {
      // Use unique key to avoid test interference
      const uniqueKey = `test-zero-remaining-${Date.now()}`;
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        blockDurationMs: 30000,
        keyGenerator: () => uniqueKey,
      });

      const req = createMockRequest();
      const res = createMockResponse();

      limiter(req, res, vi.fn());

      expect(res.set).toHaveBeenCalledWith('X-RateLimit-Remaining', '0');
    });

    it('should handle very short windows', () => {
      // Use unique key to avoid test interference
      const uniqueKey = `test-short-windows-${Date.now()}`;
      const limiter = createRateLimiter({
        windowMs: 100,
        maxRequests: 2,
        blockDurationMs: 50,
        keyGenerator: () => uniqueKey,
      });

      const req = createMockRequest();

      // Use up quota
      limiter(req, createMockResponse(), vi.fn());
      limiter(req, createMockResponse(), vi.fn());

      // Block
      const resBlocked = createMockResponse();
      limiter(req, resBlocked, vi.fn());
      expect(resBlocked.status).toHaveBeenCalledWith(429);

      // Wait for both block (50ms) AND window (100ms) to expire
      // After block expires, counter is still exceeded unless window also expires
      vi.advanceTimersByTime(150);

      // Should work again
      const resAllowed = createMockResponse();
      const next = vi.fn();
      limiter(req, resAllowed, next);
      expect(next).toHaveBeenCalled();
    });

    it('should handle concurrent requests from same source', () => {
      // Use unique key to avoid test interference
      const uniqueKey = `test-concurrent-${Date.now()}`;
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 5,
        blockDurationMs: 30000,
        keyGenerator: () => uniqueKey,
      });

      const req = createMockRequest();
      const results: boolean[] = [];

      // Simulate concurrent requests
      for (let i = 0; i < 10; i++) {
        const res = createMockResponse();
        const next = vi.fn();
        limiter(req, res, next);
        results.push(next.mock.calls.length > 0);
      }

      // First 5 should succeed, rest should fail
      expect(results.filter(Boolean).length).toBe(5);
      expect(results.filter((r) => !r).length).toBe(5);
    });
  });
});
