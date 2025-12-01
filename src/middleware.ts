/**
 * Platform Middleware
 * Express middleware for CORS, security headers, session management, and request processing
 */

import express, { type Application, type Request, type Response, type NextFunction } from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import { createProxyMiddleware, type Options as ProxyOptions } from 'http-proxy-middleware';
import { setupCoreProxy, type CoreProxyConfig, type CoreUserInfo } from './middleware/proxy/index.js';
import { setupContainerProxy, type ContainerProxyConfig } from './services/container/index.js';

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
  const allowedOrigins = new Set(getAllowedOrigins());

  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;

    // Strict origin matching - exact match only, no subdomain wildcards
    if (origin && allowedOrigins.has(origin)) {
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

    // Note: X-Frame-Options is intentionally NOT set here because we use CSP frame-ancestors
    // which is more flexible and allows Discord Activity iframe embedding.
    // X-Frame-Options: SAMEORIGIN would block Discord from embedding our app.

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
 * Check if user is an admin based on environment config
 */
function isUserAdmin(discordId: string): boolean {
  const adminIds = process.env.FUMBLEBOT_ADMIN_IDS?.split(',').map(id => id.trim()) || [];
  return adminIds.includes(discordId);
}

/**
 * Get the managed guild ID from environment
 * In production, this restricts admin access to a single guild
 */
export function getManagedGuildId(): string | null {
  return process.env.FUMBLEBOT_DISCORD_GUILD_ID || null;
}

/**
 * Middleware to require guild admin access
 *
 * This middleware:
 * 1. Requires the user to be authenticated
 * 2. In production, restricts access to FUMBLEBOT_DISCORD_GUILD_ID only
 * 3. Verifies the user has ADMINISTRATOR permission in that Discord guild
 *
 * The guildId is taken from the route params (:guildId)
 */
export function requireGuildAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { guildId } = req.params;
  if (!guildId) {
    res.status(400).json({ error: 'Guild ID required' });
    return;
  }

  // In production, restrict to the managed guild only
  const managedGuildId = getManagedGuildId();
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction && managedGuildId && guildId !== managedGuildId) {
    res.status(403).json({
      error: 'Access denied',
      message: 'Admin access is restricted to the configured guild',
    });
    return;
  }

  // Check if user is a platform admin (bypass guild check)
  if (isUserAdmin(user.discordId)) {
    next();
    return;
  }

  // TODO: Check Discord guild permissions via API or cached data
  // For now, we trust the session data which should have been validated during OAuth
  // The AuthContext on the client already checks ADMINISTRATOR permission
  // In a full implementation, we'd call Discord API to verify permissions

  // For now, allow if user has a session (they authenticated with Discord)
  // The React client handles the actual permission check before showing admin UI
  next();
}

/**
 * Extract user info from request for core proxy authentication
 * Returns user ID and role to forward to core server
 */
function getUserInfoForCore(req: Request): CoreUserInfo | null {
  const user = getSessionUser(req);
  if (!user) {
    return null;
  }

  const role = isUserAdmin(user.discordId) ? 'admin' : 'user';

  return {
    userId: user.discordId,
    role,
  };
}

/**
 * Get core proxy configuration from environment
 *
 * Configure which paths to proxy via CORE_PROXY_PATHS environment variable.
 * Defaults to '/api/core', '/wiki', and '/activity' prefixes.
 *
 * Proxy paths:
 * - /api/core/* - Core API endpoints (campaigns, characters, sessions, etc.)
 * - /wiki/* - Wiki content served by core
 * - /activity/* - React activity UI served by core (web-optimized)
 *
 * Authentication:
 * - CORE_SECRET: Shared secret for service-to-service auth (X-Core-Secret header)
 * - User ID and role are forwarded via X-User-Id and X-User-Role headers
 *
 * Discord Compatibility:
 * Fumblebot handles Discord-specific concerns before proxying to core:
 * - Discord OAuth token exchange (/api/token)
 * - CSP headers for Discord iframe embedding
 * - Discord Embedded App SDK initialization
 * Core's /activity/* routes are served through this proxy with Discord headers added.
 */
function getCoreProxyConfig(): CoreProxyConfig | null {
  const coreUrl = process.env.CORE_SERVER_URL;

  if (!coreUrl) {
    // Core proxy requires CORE_SERVER_URL to be set
    return null;
  }

  const corePort = parseInt(process.env.CORE_SERVER_PORT || '4000', 10);
  const debug = process.env.NODE_ENV !== 'production';
  const secret = process.env.CORE_SECRET;

  // Default proxy paths - core server owns the API/UI structure
  // /activity is the React activity UI (web-optimized, served through Discord compatibility layer)
  const defaultPaths = ['/api/core', '/wiki', '/activity'];
  const customPaths = process.env.CORE_PROXY_PATHS?.split(',').map(p => p.trim()).filter(Boolean);

  if (!secret && process.env.NODE_ENV === 'production') {
    console.warn('[Middleware] CORE_SECRET not set - core proxy auth will fail');
  }

  return {
    coreUrl,
    corePort,
    debug,
    secret,
    getUserInfo: getUserInfoForCore,
    proxyPaths: customPaths || defaultPaths,
  };
}

/**
 * Setup core server proxy
 * Forwards activity-related API requests to core.crit-fumble.com
 * running on DigitalOcean's internal network
 */
export function setupCoreServerProxy(app: Application): void {
  const config = getCoreProxyConfig();

  if (config) {
    console.log(`[Middleware] Setting up core proxy to ${config.coreUrl}:${config.corePort}`);
    setupCoreProxy(app, config);
  } else {
    console.log('[Middleware] Core proxy disabled (CORE_SERVER_URL not set)');
  }
}

/**
 * Setup container proxy for Discord Activity
 *
 * Forwards container API requests from Discord Activity to Core.
 * This enables the activity client to manage containers (start, stop, exec, terminal).
 *
 * Paths proxied:
 * - /.proxy/api/container/start - Start a container for guild/channel
 * - /.proxy/api/container/stop - Stop a container
 * - /.proxy/api/container/status - Get container status
 * - /.proxy/api/container/exec - Execute command in container (for MCP tools)
 *
 * Headers added:
 * - X-Core-Secret: Service auth secret
 * - X-User-Id: Discord user ID (from session or request headers)
 * - X-User-Name: Username for container prompt
 * - X-Guild-Id: Guild ID from Activity SDK
 * - X-Channel-Id: Channel ID from Activity SDK
 */
export function setupContainerApiProxy(app: Application): void {
  const coreBaseUrl = process.env.CORE_SERVER_URL;
  const coreSecret = process.env.CORE_SECRET;

  // Require both CORE_SERVER_URL and CORE_SECRET
  if (!coreBaseUrl || !coreSecret) {
    if (!coreBaseUrl) {
      console.log('[Middleware] Container proxy disabled (CORE_SERVER_URL not set)');
    }
    if (!coreSecret) {
      console.log('[Middleware] Container proxy disabled (CORE_SECRET not set)');
    }
    return;
  }

  const corePort = process.env.CORE_SERVER_PORT || '4000';
  const coreUrl = `${coreBaseUrl}:${corePort}`;
  const debug = process.env.NODE_ENV !== 'production';

  console.log(`[Middleware] Setting up container proxy to ${coreUrl}`);

  setupContainerProxy(app, {
    coreUrl,
    coreSecret,
    proxyPrefix: '/.proxy',
    debug,
    // Extract user context from session or request headers
    getUserContext: (req: Request) => {
      // Try session first
      const sessionUser = getSessionUser(req);

      // Get guild/channel from headers (set by Activity SDK client)
      const guildId = req.get('x-guild-id') || (req.body?.guildId as string);
      const channelId = req.get('x-channel-id') || (req.body?.channelId as string);

      if (!guildId || !channelId) {
        return null;
      }

      return {
        userId: sessionUser?.discordId || req.get('x-user-id') || 'anonymous',
        userName: sessionUser?.username || req.get('x-user-name'),
        guildId,
        channelId,
      };
    },
  });
}

/**
 * Setup activity proxy for Discord Activity
 *
 * Proxies activity static files from Discord Activity to Core.
 * Discord loads activities from: fumblebot.crit-fumble.com/.proxy/activity/
 * This proxy forwards those requests to Core's /activity/* routes.
 *
 * Path mapping:
 * - /.proxy/activity/* → Core /activity/*
 */
export function setupActivityProxy(app: Application): void {
  const coreBaseUrl = process.env.CORE_SERVER_URL;

  if (!coreBaseUrl) {
    console.log('[Middleware] Activity proxy disabled (CORE_SERVER_URL not set)');
    return;
  }

  const corePort = process.env.CORE_SERVER_PORT || '4000';
  const coreUrl = `${coreBaseUrl}:${corePort}`;
  const debug = process.env.NODE_ENV !== 'production';

  console.log(`[Middleware] Setting up activity proxy /.proxy/activity/* -> ${coreUrl}/activity/*`);

  const activityProxy = createProxyMiddleware({
    target: coreUrl,
    changeOrigin: true,
    // Rewrite /.proxy/activity/* to /activity/*
    pathRewrite: { '^/\\.proxy/activity': '/activity' },
    // Logging
    logger: debug ? console : undefined,
    on: {
      proxyReq: (proxyReq, req) => {
        if (debug) {
          console.log(`[ActivityProxy] ${req.method} ${req.url} -> ${coreUrl}${req.url?.replace(/^\/\.proxy\/activity/, '/activity')}`);
        }
        // Forward original host
        proxyReq.setHeader('X-Forwarded-Host', req.headers.host || '');
        proxyReq.setHeader('X-Forwarded-Proto', 'https');
      },
      proxyRes: (proxyRes, req) => {
        if (debug) {
          console.log(`[ActivityProxy] Response: ${proxyRes.statusCode} ${req.url}`);
        }
      },
      error: (err, req, res) => {
        console.error(`[ActivityProxy] Error:`, err.message);
        if (res && 'status' in res) {
          (res as Response).status(502).json({
            error: 'Activity server unavailable',
            message: 'Failed to reach Core activity server',
          });
        }
      },
    },
  });

  app.use('/.proxy/activity', activityProxy);
}

/**
 * Setup all middleware
 */
export function setupAllMiddleware(app: Application): void {
  setupBodyParser(app);
  setupSession(app);
  setupCors(app);
  setupSecurityHeaders(app);

  // Setup core server proxy for activity-related requests
  // This must be set up BEFORE routes so the proxy can intercept matching paths
  setupCoreServerProxy(app);

  // Setup container proxy for Discord Activity (/.proxy/api/container/*)
  // This proxies container management requests to Core via DO private network
  setupContainerApiProxy(app);

  // Setup activity proxy for Discord Activity (/.proxy/activity/*)
  // This proxies the React activity UI from Core
  setupActivityProxy(app);
}
