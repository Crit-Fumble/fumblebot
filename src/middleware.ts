/**
 * Platform Middleware
 * Express middleware for CORS, security headers, session management, and request processing
 */

import express, { type Application, type Request, type Response, type NextFunction } from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';

// Extend Express session with our user data
declare module 'express-session' {
  interface SessionData {
    user?: {
      id: string;
      discordId: string;
      username: string;
      avatar: string | null;
      globalName: string | null;
    };
    accessToken?: string;
    expiresAt?: number;
  }
}

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

    // Content-Security-Policy with strict directives for Discord Activity
    // No unsafe-inline - all scripts and styles are bundled by Vite/React
    const csp = [
      // Allow framing from Discord and our domains
      `frame-ancestors 'self' https://discord.com https://${DISCORD_CLIENT_ID}.discordsays.com https://*.discordsays.com https://www.crit-fumble.com https://crit-fumble.com https://fumblebot.crit-fumble.com`,
      // Allow scripts from self only (no unsafe-inline needed with bundled React)
      `script-src 'self'`,
      // Allow styles from self only (Tailwind CSS is bundled)
      `style-src 'self'`,
      // Allow connections to Discord API, our API
      `connect-src 'self' https://discord.com https://*.discord.com https://*.discordsays.com`,
      // Allow images from Discord CDN
      `img-src 'self' https://cdn.discordapp.com https://*.discordapp.com data:`,
      // Default fallback
      `default-src 'self'`,
    ].join('; ');

    res.header('Content-Security-Policy', csp);

    next();
  });
}

/**
 * Setup session middleware with Prisma-backed store
 */
export function setupSession(app: Application): void {
  const sessionSecret = process.env.SESSION_SECRET || 'fumblebot-session-secret-change-in-production';

  app.use(cookieParser());

  app.use(session({
    name: 'fumblebot.sid',
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'lax',
    },
    // Using default memory store for now
    // TODO: Implement Prisma session store for production
    // store: new PrismaSessionStore(getPrisma()),
  }));
}

/**
 * Get session user from request
 */
export function getSessionUser(req: Request): { id: string; discordId: string; username: string; avatar: string | null; globalName: string | null } | null {
  if (req.session?.user && req.session?.expiresAt && req.session.expiresAt > Date.now()) {
    return req.session.user;
  }
  return null;
}

/**
 * Middleware to require authentication
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

/**
 * Setup all middleware
 */
export function setupAllMiddleware(app: Application): void {
  setupBodyParser(app);
  setupSession(app);
  setupCors(app);
  setupSecurityHeaders(app);
}
