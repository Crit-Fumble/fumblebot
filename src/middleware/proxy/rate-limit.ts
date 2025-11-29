/**
 * Rate Limiting Middleware
 *
 * Protects API endpoints from abuse with configurable:
 * - Time window and request limits
 * - Blocking duration after limit exceeded
 * - Custom key generators for different rate limit strategies
 */

import type { Request, Response, NextFunction } from 'express';

export interface RateLimitEntry {
  count: number;
  resetAt: number;
  blocked: boolean;
  blockedUntil?: number;
}

export interface RateLimitConfig {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum requests allowed per window */
  maxRequests: number;
  /** How long to block after exceeding limit (ms) */
  blockDurationMs: number;
  /** Custom function to generate rate limit key from request */
  keyGenerator?: (req: Request) => string;
  /** Custom store for rate limit data (defaults to in-memory Map) */
  store?: RateLimitStore;
}

export interface RateLimitStore {
  get(key: string): RateLimitEntry | undefined;
  set(key: string, entry: RateLimitEntry): void;
  delete(key: string): void;
  entries(): IterableIterator<[string, RateLimitEntry]>;
}

/**
 * Default in-memory rate limit store
 */
export function createMemoryStore(): RateLimitStore {
  const store = new Map<string, RateLimitEntry>();

  // Clean up old entries periodically
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt < now && (!entry.blockedUntil || entry.blockedUntil < now)) {
        store.delete(key);
      }
    }
  }, 60000); // Clean every minute

  // Ensure cleanup doesn't prevent process exit
  if (cleanup.unref) {
    cleanup.unref();
  }

  return {
    get: (key) => store.get(key),
    set: (key, entry) => store.set(key, entry),
    delete: (key) => store.delete(key),
    entries: () => store.entries(),
  };
}

// Global default store
const defaultStore = createMemoryStore();

/**
 * Default key generator - uses IP + user ID if available
 */
export function defaultKeyGenerator(req: Request): string {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const userId = req.headers['x-discord-user-id'] as string | undefined;
  return userId ? `user:${userId}` : `ip:${ip}`;
}

/**
 * Key generator for per-user rate limiting (chat, messages)
 */
export function userKeyGenerator(prefix: string = 'user') {
  return (req: Request): string => {
    const userId = req.headers['x-discord-user-id'] as string;
    return `${prefix}:${userId || 'anonymous'}`;
  };
}

/**
 * Key generator using session user
 */
export function sessionKeyGenerator(prefix: string = 'session') {
  return (req: Request): string => {
    const session = (req as any).session;
    const userId = session?.user?.discordId || session?.user?.id;
    return `${prefix}:${userId || req.ip || 'anonymous'}`;
  };
}

/**
 * Key generator for per-IP rate limiting
 */
export function ipKeyGenerator(prefix: string = 'ip') {
  return (req: Request): string => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    return `${prefix}:${ip}`;
  };
}

/**
 * Create a rate limiter middleware
 */
export function createRateLimiter(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    blockDurationMs,
    keyGenerator = defaultKeyGenerator,
    store = defaultStore,
  } = config;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const now = Date.now();

    let entry = store.get(key);

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
      store.set(key, entry);

      const retryAfter = Math.ceil(blockDurationMs / 1000);
      res.set('Retry-After', String(retryAfter));
      res.status(429).json({
        error: 'Too many requests',
        retryAfter,
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
      });
      return;
    }

    store.set(key, entry);

    // Set rate limit headers
    res.set('X-RateLimit-Limit', String(maxRequests));
    res.set('X-RateLimit-Remaining', String(Math.max(0, maxRequests - entry.count)));
    res.set('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    next();
  };
}

/**
 * Pre-configured rate limiter presets
 */
export const rateLimitPresets = {
  /** Chat/message endpoints: 30/min, 30s block */
  chat: () =>
    createRateLimiter({
      windowMs: 60 * 1000,
      maxRequests: 30,
      blockDurationMs: 30 * 1000,
      keyGenerator: userKeyGenerator('chat'),
    }),

  /** Command endpoints: 60/min, 30s block */
  commands: () =>
    createRateLimiter({
      windowMs: 60 * 1000,
      maxRequests: 60,
      blockDurationMs: 30 * 1000,
      keyGenerator: sessionKeyGenerator('cmd'),
    }),

  /** General API: 100/min per IP, 60s block */
  general: () =>
    createRateLimiter({
      windowMs: 60 * 1000,
      maxRequests: 100,
      blockDurationMs: 60 * 1000,
      keyGenerator: ipKeyGenerator('api'),
    }),

  /** Strict: 10/min, 5 min block (for sensitive endpoints) */
  strict: () =>
    createRateLimiter({
      windowMs: 60 * 1000,
      maxRequests: 10,
      blockDurationMs: 5 * 60 * 1000,
      keyGenerator: ipKeyGenerator('strict'),
    }),
};
