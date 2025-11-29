/**
 * Security Headers Middleware for Discord Activity Iframe Embedding
 *
 * Configures security headers including:
 * - Content-Security-Policy with frame-ancestors for iframe embedding
 * - HSTS, X-Content-Type-Options, etc.
 * - Permissions Policy
 */

import type { Request, Response, NextFunction, Application } from 'express';

export interface SecurityConfig {
  /** Discord Application Client ID (for CSP frame-ancestors) */
  discordClientId: string;
  /** Additional domains allowed to embed this app in iframes */
  additionalFrameAncestors?: string[];
  /** Whether running in production (enables HSTS) */
  isProduction?: boolean;
  /** Custom CSP directives to override defaults */
  customCsp?: Partial<CspDirectives>;
}

export interface CspDirectives {
  /** Allowed frame ancestors (who can embed this app) */
  frameAncestors: string[];
  /** Script sources */
  scriptSrc: string[];
  /** Style sources */
  styleSrc: string[];
  /** Connection sources (fetch, WebSocket, etc.) */
  connectSrc: string[];
  /** Image sources */
  imgSrc: string[];
  /** Default source fallback */
  defaultSrc: string[];
  /** Form action targets */
  formAction: string[];
  /** Base URI restriction */
  baseUri: string[];
  /** Object/embed sources */
  objectSrc: string[];
}

/**
 * Build default CSP directives for Discord Activity
 */
export function buildDefaultCspDirectives(config: SecurityConfig): CspDirectives {
  const { discordClientId, additionalFrameAncestors = [] } = config;

  return {
    frameAncestors: [
      "'self'",
      'https://discord.com',
      `https://${discordClientId}.discordsays.com`,
      'https://*.discordsays.com',
      ...additionalFrameAncestors,
    ],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'"],
    connectSrc: [
      "'self'",
      'https://discord.com',
      'https://*.discord.com',
      'https://*.discordsays.com',
    ],
    imgSrc: [
      "'self'",
      'https://cdn.discordapp.com',
      'https://*.discordapp.com',
      'data:',
    ],
    defaultSrc: ["'self'"],
    formAction: ["'self'"],
    baseUri: ["'self'"],
    objectSrc: ["'none'"],
  };
}

/**
 * Build CSP header string from directives
 */
export function buildCspHeader(directives: CspDirectives): string {
  const parts: string[] = [];

  if (directives.frameAncestors.length > 0) {
    parts.push(`frame-ancestors ${directives.frameAncestors.join(' ')}`);
  }
  if (directives.scriptSrc.length > 0) {
    parts.push(`script-src ${directives.scriptSrc.join(' ')}`);
  }
  if (directives.styleSrc.length > 0) {
    parts.push(`style-src ${directives.styleSrc.join(' ')}`);
  }
  if (directives.connectSrc.length > 0) {
    parts.push(`connect-src ${directives.connectSrc.join(' ')}`);
  }
  if (directives.imgSrc.length > 0) {
    parts.push(`img-src ${directives.imgSrc.join(' ')}`);
  }
  if (directives.defaultSrc.length > 0) {
    parts.push(`default-src ${directives.defaultSrc.join(' ')}`);
  }
  if (directives.formAction.length > 0) {
    parts.push(`form-action ${directives.formAction.join(' ')}`);
  }
  if (directives.baseUri.length > 0) {
    parts.push(`base-uri ${directives.baseUri.join(' ')}`);
  }
  if (directives.objectSrc.length > 0) {
    parts.push(`object-src ${directives.objectSrc.join(' ')}`);
  }

  return parts.join('; ');
}

/**
 * Create security headers middleware
 */
export function createSecurityMiddleware(config: SecurityConfig) {
  const { isProduction = false, customCsp = {} } = config;

  // Merge default and custom CSP directives
  const defaultDirectives = buildDefaultCspDirectives(config);
  const directives: CspDirectives = {
    ...defaultDirectives,
    ...customCsp,
  };

  const cspHeader = buildCspHeader(directives);

  return (req: Request, res: Response, next: NextFunction) => {
    // HSTS - Force HTTPS for 1 year (production only)
    if (isProduction) {
      res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    // Prevent MIME type sniffing
    res.header('X-Content-Type-Options', 'nosniff');

    // Note: X-Frame-Options is intentionally NOT set
    // We use CSP frame-ancestors which is more flexible
    // X-Frame-Options: SAMEORIGIN would block Discord from embedding

    // XSS Protection (legacy browsers)
    res.header('X-XSS-Protection', '1; mode=block');

    // Referrer Policy - don't leak URLs to third parties
    res.header('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions Policy - disable unnecessary browser features
    res.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    // Content-Security-Policy
    res.header('Content-Security-Policy', cspHeader);

    next();
  };
}

/**
 * Setup security headers on an Express application
 */
export function setupSecurityHeaders(app: Application, config: SecurityConfig): void {
  app.use(createSecurityMiddleware(config));
}
