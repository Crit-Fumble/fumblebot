/**
 * Platform Middleware
 * Express middleware for CORS, security headers, and request processing
 */

import express, { type Application, type Request, type Response, type NextFunction } from 'express';

/**
 * Get allowed origins for CORS
 */
function getAllowedOrigins(): string[] {
  const DISCORD_CLIENT_ID = process.env.FUMBLEBOT_DISCORD_CLIENT_ID || '1443525084256931880';

  return [
    'https://discord.com',
    `https://${DISCORD_CLIENT_ID}.discordsays.com`,
    'https://discordsays.com',
    'https://www.crit-fumble.com',
    'https://crit-fumble.com',
    'https://fumblebot.crit-fumble.com',
    'http://localhost:3000', // Dev
    'http://localhost:5173', // Vite dev
  ];
}

/**
 * Setup JSON body parsing
 */
export function setupBodyParser(app: Application): void {
  app.use(express.json());
}

/**
 * Setup CORS middleware for Discord iframe and web access
 */
export function setupCors(app: Application): void {
  const allowedOrigins = getAllowedOrigins();

  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;

    if (origin && allowedOrigins.some(allowed =>
      origin.startsWith(allowed.replace('https://', 'https://')) || origin === allowed
    )) {
      res.header('Access-Control-Allow-Origin', origin);
    } else {
      // Default to discord.com for non-matching origins
      res.header('Access-Control-Allow-Origin', 'https://discord.com');
    }

    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');

    // Handle preflight
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });
}

/**
 * Setup security headers for iframe embedding
 */
export function setupSecurityHeaders(app: Application): void {
  const DISCORD_CLIENT_ID = process.env.FUMBLEBOT_DISCORD_CLIENT_ID || '1443525084256931880';

  app.use((req: Request, res: Response, next: NextFunction) => {
    // X-Frame-Options is deprecated for multiple origins, use CSP instead
    // But some browsers still need it, so we set it to SAMEORIGIN as fallback
    res.header('X-Frame-Options', 'SAMEORIGIN');

    // Content-Security-Policy frame-ancestors allows multiple origins
    res.header(
      'Content-Security-Policy',
      `frame-ancestors 'self' https://discord.com https://${DISCORD_CLIENT_ID}.discordsays.com https://*.discordsays.com https://www.crit-fumble.com https://crit-fumble.com https://fumblebot.crit-fumble.com`
    );

    next();
  });
}

/**
 * Setup all middleware
 */
export function setupAllMiddleware(app: Application): void {
  setupBodyParser(app);
  setupCors(app);
  setupSecurityHeaders(app);
}
