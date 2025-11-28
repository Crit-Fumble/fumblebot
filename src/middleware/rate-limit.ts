/**
 * Rate Limiting Middleware
 * Protects API endpoints from abuse
 */

import type { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetAt: number;
  blocked: boolean;
  blockedUntil?: number;
}

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  blockDurationMs: number; // How long to block after exceeding limit
  keyGenerator?: (req: Request) => string;
}

// In-memory store for rate limits (consider Redis for production clustering)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now && (!entry.blockedUntil || entry.blockedUntil < now)) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean every minute

/**
 * Create a rate limiter middleware
 */
export function createRateLimiter(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    blockDurationMs,
    keyGenerator = defaultKeyGenerator,
  } = config;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const now = Date.now();

    let entry = rateLimitStore.get(key);

    // Check if blocked
    if (entry?.blocked && entry.blockedUntil && entry.blockedUntil > now) {
      const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      res.status(429).json({
        error: 'Too many requests',
        retryAfter,
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
      });
      return;
    }

    // Reset if window has passed
    if (!entry || entry.resetAt < now) {
      entry = {
        count: 0,
        resetAt: now + windowMs,
        blocked: false,
      };
    }

    entry.count++;

    // Check if over limit
    if (entry.count > maxRequests) {
      entry.blocked = true;
      entry.blockedUntil = now + blockDurationMs;
      rateLimitStore.set(key, entry);

      const retryAfter = Math.ceil(blockDurationMs / 1000);
      res.set('Retry-After', String(retryAfter));
      res.status(429).json({
        error: 'Too many requests',
        retryAfter,
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
      });
      return;
    }

    rateLimitStore.set(key, entry);

    // Set rate limit headers
    res.set('X-RateLimit-Limit', String(maxRequests));
    res.set('X-RateLimit-Remaining', String(Math.max(0, maxRequests - entry.count)));
    res.set('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    next();
  };
}

/**
 * Default key generator - uses IP + user ID if available
 */
function defaultKeyGenerator(req: Request): string {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const userId = req.headers['x-discord-user-id'] as string | undefined;
  return userId ? `user:${userId}` : `ip:${ip}`;
}

/**
 * Key generator for chat endpoints - per user
 */
export function chatKeyGenerator(req: Request): string {
  const userId = req.headers['x-discord-user-id'] as string;
  return `chat:${userId || 'anonymous'}`;
}

/**
 * Key generator for command endpoints - per user from session
 */
export function commandKeyGenerator(req: Request): string {
  const session = (req as any).session;
  const userId = session?.user?.discordId;
  return `cmd:${userId || req.ip || 'anonymous'}`;
}

/**
 * Pre-configured rate limiters
 */

// Chat API: 30 messages/minute per user, 30s block if exceeded
export const chatRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,      // 1 minute
  maxRequests: 30,          // 30 requests per minute
  blockDurationMs: 30 * 1000, // 30 second block
  keyGenerator: chatKeyGenerator,
});

// Command API: 60 requests/minute per user, 30s block
export const commandRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 60,
  blockDurationMs: 30 * 1000,
  keyGenerator: commandKeyGenerator,
});

// General API: 100 requests/minute per IP
export const generalRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 100,
  blockDurationMs: 60 * 1000,
});
