/**
 * Proxy Middleware
 *
 * Express middleware for Discord Activity and multi-platform proxy routing.
 *
 * Features:
 * - CORS configuration for Discord iframe embedding
 * - Security headers with CSP for platform-specific embedding
 * - Activity server proxy middleware
 * - Rate limiting utilities
 */

// CORS middleware
export {
  type CorsConfig,
  buildAllowedOrigins,
  isOriginAllowed,
  createCorsMiddleware,
  setupCors,
} from './cors.js';

// Security headers middleware
export {
  type SecurityConfig,
  type CspDirectives,
  buildDefaultCspDirectives,
  buildCspHeader,
  createSecurityMiddleware,
  setupSecurityHeaders,
} from './security.js';

// Proxy middleware
export {
  type ActivityProxyConfig,
  type MultiProxyConfig,
  createActivityProxy,
  proxyToActivityServer,
  setupActivityProxy,
  setupMultiProxy,
  createConditionalProxy,
} from './proxy.js';

// Core server proxy (internal DO network)
export {
  type CoreProxyConfig,
  type CoreUserInfo,
  type GetUserInfoFn,
  buildCoreUrl,
  createCoreProxyMiddleware,
  setupCoreProxy,
  createCoreProxyWithFallback,
  checkCoreHealth,
} from './core-proxy.js';

// Rate limiting
export {
  type RateLimitConfig,
  type RateLimitEntry,
  type RateLimitStore,
  createMemoryStore,
  defaultKeyGenerator,
  userKeyGenerator,
  sessionKeyGenerator,
  ipKeyGenerator,
  createRateLimiter,
  rateLimitPresets,
} from './rate-limit.js';

// Re-export http-proxy-middleware types for convenience
export type { Options as ProxyOptions } from 'http-proxy-middleware';
