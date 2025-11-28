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
 * Get Discord Client ID (required)
 */
function getDiscordClientId(): string {
  const clientId = process.env.FUMBLEBOT_DISCORD_CLIENT_ID;
  if (!clientId) {
    throw new Error('FUMBLEBOT_DISCORD_CLIENT_ID environment variable is required');
  }
  return clientId;
}

/**
 * Get allowed origins for CORS
 */
function getAllowedOrigins(): string[] {
  const DISCORD_CLIENT_ID = getDiscordClientId();

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
 * Setup JSON body parsing with size limits
 */
export function setupBodyParser(app: Application): void {
  // Limit request body size to prevent DoS attacks
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));
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
  const DISCORD_CLIENT_ID = getDiscordClientId();
  const isProduction = process.env.NODE_ENV === 'production';

  app.use((req: Request, res: Response, next: NextFunction) => {
    // HSTS - Force HTTPS for 1 year (production only)
    if (isProduction) {
      res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    // Prevent MIME type sniffing
    res.header('X-Content-Type-Options', 'nosniff');

    // Prevent clickjacking (fallback for browsers that don't support CSP frame-ancestors)
    res.header('X-Frame-Options', 'SAMEORIGIN');

    // XSS Protection (legacy browsers)
    res.header('X-XSS-Protection', '1; mode=block');

    // Referrer Policy - don't leak URLs to third parties
    res.header('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions Policy - disable unnecessary browser features
    res.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

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
      // Prevent form submissions to external sites
      `form-action 'self'`,
      // Restrict base URI
      `base-uri 'self'`,
      // Disable plugins/objects
      `object-src 'none'`,
    ].join('; ');

    res.header('Content-Security-Policy', csp);

    next();
  });
}

/**
 * Setup session middleware with Prisma-backed store
 */
export function setupSession(app: Application): void {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error('SESSION_SECRET environment variable is required');
  }

  const isProduction = process.env.NODE_ENV === 'production';

  app.use(cookieParser());

  app.use(session({
    name: 'fumblebot.sid',
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProduction,
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: isProduction ? 'strict' : 'lax',
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
 * Middleware to require admin privileges
 * For now, checks if the user is in the admin list from environment
 * TODO: Implement proper role-based access control with database
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // Check if user is in admin list (comma-separated Discord IDs)
  const adminIds = process.env.FUMBLEBOT_ADMIN_IDS?.split(',').map(id => id.trim()) || [];
  if (!adminIds.includes(user.discordId)) {
    res.status(403).json({ error: 'Admin access required' });
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
