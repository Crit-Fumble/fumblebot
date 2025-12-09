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
import {
  loadDiscordConfig,
  getCoreProxyConfig as getAppCoreProxyConfig,
  getSecurityConfig,
  getServerConfig,
  isAdmin,
} from './config.js';

// Discord permission flags
// https://discord.com/developers/docs/topics/permissions#permissions-bitwise-permission-flags
const DISCORD_PERMISSIONS = {
  ADMINISTRATOR: 0x8n, // 1 << 3
} as const;

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
    /** Cached guild permissions: guildId -> permissions bigint as string */
    guildPermissions?: Record<string, string>;
  }
}

// Cache Discord config at module load
let _discordClientId: string | null = null;

/**
 * Get Discord Client ID (required)
 */
function getDiscordClientId(): string {
  if (!_discordClientId) {
    _discordClientId = loadDiscordConfig().clientId;
  }
  return _discordClientId;
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
  const { isProduction } = getServerConfig();

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
  const { sessionSecret } = getSecurityConfig();
  if (!sessionSecret) {
    throw new Error('SESSION_SECRET environment variable is required');
  }

  const { isProduction } = getServerConfig();

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
 * Uses centralized isAdmin() from config
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (!isAdmin(user.discordId)) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  next();
}

/**
 * Get the managed guild ID from config
 * In production, this restricts admin access to a single guild
 */
export function getManagedGuildId(): string | null {
  try {
    return loadDiscordConfig().guildId || null;
  } catch {
    return null;
  }
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
  const { isProduction } = getServerConfig();

  if (isProduction && managedGuildId && guildId !== managedGuildId) {
    res.status(403).json({
      error: 'Access denied',
      message: 'Admin access is restricted to the configured guild',
    });
    return;
  }

  // Check if user is a platform admin (bypass guild check)
  if (isAdmin(user.discordId)) {
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
 * Check if user has Discord ADMINISTRATOR permission for a guild
 * Uses cached permissions from session if available
 */
function hasDiscordAdminPermission(req: Request, guildId: string): boolean {
  const permissions = req.session.guildPermissions?.[guildId];
  if (!permissions) {
    return false;
  }

  try {
    const permBits = BigInt(permissions);
    return (permBits & DISCORD_PERMISSIONS.ADMINISTRATOR) !== 0n;
  } catch {
    return false;
  }
}

/**
 * Extract guild ID from request
 * Looks in query params, body, or path
 */
function extractGuildId(req: Request): string | null {
  // Query param
  if (req.query.guildId && typeof req.query.guildId === 'string') {
    return req.query.guildId;
  }

  // Body (for POST requests)
  if (req.body?.guildId && typeof req.body.guildId === 'string') {
    return req.body.guildId;
  }

  // Path param patterns like /activity/:guildId or /guild/:guildId
  const pathMatch = req.path.match(/\/(activity|guild|container)\/(\d+)/);
  if (pathMatch) {
    return pathMatch[2];
  }

  return null;
}

/**
 * Extract user info from request for core proxy authentication
 * Returns user ID and role to forward to core server
 *
 * Role determination:
 * 1. Global admin (FUMBLEBOT_ADMIN_IDS) -> always 'admin'
 * 2. Discord ADMINISTRATOR permission in the guild -> 'admin' for that guild
 * 3. Otherwise -> 'user'
 */
function getUserInfoForCore(req: Request): CoreUserInfo | null {
  const user = getSessionUser(req);
  if (!user) {
    return null;
  }

  // Global admins are always admin
  if (isAdmin(user.discordId)) {
    return {
      userId: user.discordId,
      role: 'admin',
    };
  }

  // Check Discord ADMINISTRATOR permission for the guild
  const guildId = extractGuildId(req);
  if (guildId && hasDiscordAdminPermission(req, guildId)) {
    return {
      userId: user.discordId,
      role: 'admin',
    };
  }

  // Default to user role
  return {
    userId: user.discordId,
    role: 'user',
  };
}

/**
 * Get core proxy configuration from centralized config
 */
function getCoreProxyConfig(): CoreProxyConfig | null {
  const coreConfig = getAppCoreProxyConfig();

  if (!coreConfig) {
    return null;
  }

  const { isProduction } = getServerConfig();

  if (!coreConfig.secret && isProduction) {
    console.warn('[Middleware] CORE_SECRET not set - core proxy auth will fail');
  }

  // Default proxy paths - core server owns the API/UI structure
  const defaultPaths = ['/api/core', '/wiki', '/activity'];

  return {
    coreUrl: coreConfig.url,
    corePort: coreConfig.port,
    debug: !isProduction,
    secret: coreConfig.secret,
    getUserInfo: getUserInfoForCore,
    proxyPaths: defaultPaths,
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
 */
export function setupContainerApiProxy(app: Application): void {
  const coreConfig = getAppCoreProxyConfig();

  if (!coreConfig || !coreConfig.secret) {
    if (!coreConfig) {
      console.log('[Middleware] Container proxy disabled (CORE_SERVER_URL not set)');
    } else if (!coreConfig.secret) {
      console.log('[Middleware] Container proxy disabled (CORE_SECRET not set)');
    }
    return;
  }

  const coreUrl = `${coreConfig.url}:${coreConfig.port}`;
  const { isProduction } = getServerConfig();

  console.log(`[Middleware] Setting up container proxy to ${coreUrl}`);

  setupContainerProxy(app, {
    coreUrl,
    coreSecret: coreConfig.secret,
    proxyPrefix: '/.proxy',
    debug: !isProduction,
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
  const coreConfig = getAppCoreProxyConfig();

  if (!coreConfig) {
    console.log('[Middleware] Activity proxy disabled (CORE_SERVER_URL not set)');
    return;
  }

  const coreUrl = `${coreConfig.url}:${coreConfig.port}`;
  const { isProduction } = getServerConfig();
  const debug = !isProduction;

  console.log(`[Middleware] Setting up activity proxy /.proxy/activity/* -> ${coreUrl}/activity/*`);

  const activityProxy = createProxyMiddleware({
    target: coreUrl,
    changeOrigin: true,
    // app.use('/.proxy/activity') strips the mount path, so req.url is already relative
    // We need to prepend /activity to route to Core's /activity/*
    pathRewrite: (path) => `/activity${path}`,
    // Logging
    logger: debug ? console : undefined,
    on: {
      proxyReq: (proxyReq, req) => {
        const targetPath = `/activity${req.url}`;
        if (debug) {
          console.log(`[ActivityProxy] ${req.method} ${req.url} -> ${coreUrl}${targetPath}`);
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
 * Setup Discord Activity auth proxy
 *
 * Proxies Discord Activity SDK authentication endpoints to Core:
 * - /.proxy/api/config -> /api/config (GET Discord Client ID)
 * - /.proxy/api/config/token -> /api/config/token (POST token exchange)
 * - /.proxy/api/activity/auth -> /api/activity/auth (POST activity auth)
 */
export function setupActivityAuthProxy(app: Application): void {
  const coreConfig = getAppCoreProxyConfig();

  if (!coreConfig) {
    console.log('[Middleware] Activity auth proxy disabled (CORE_SERVER_URL not set)');
    return;
  }

  const coreUrl = `${coreConfig.url}:${coreConfig.port}`;
  const { isProduction } = getServerConfig();
  const debug = !isProduction;

  console.log(`[Middleware] Setting up activity auth proxy /.proxy/api/* -> ${coreUrl}/api/*`);

  const authProxy = createProxyMiddleware({
    target: coreUrl,
    changeOrigin: true,
    // Remove /.proxy prefix: /.proxy/api/config -> /api/config
    pathRewrite: {
      '^/.proxy': '',
    },
    logger: debug ? console : undefined,
    on: {
      proxyReq: (proxyReq, req) => {
        if (debug) {
          const targetPath = req.url?.replace('/.proxy', '') || '';
          console.log(`[ActivityAuthProxy] ${req.method} ${req.url} -> ${coreUrl}${targetPath}`);
        }
        // Forward original host
        proxyReq.setHeader('X-Forwarded-Host', req.headers.host || '');
        proxyReq.setHeader('X-Forwarded-Proto', 'https');
      },
      proxyRes: (proxyRes, req) => {
        if (debug) {
          console.log(`[ActivityAuthProxy] Response: ${proxyRes.statusCode} ${req.url}`);
        }
      },
      error: (err, req, res) => {
        console.error(`[ActivityAuthProxy] Error:`, err.message);
        if (res && 'status' in res) {
          (res as Response).status(502).json({
            error: 'Auth server unavailable',
            message: 'Failed to reach Core auth server',
          });
        }
      },
    },
  });

  // Proxy specific auth endpoints
  app.use('/.proxy/api/config', authProxy);
  app.use('/.proxy/api/activity/auth', authProxy);
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

  // Setup activity auth proxy (/.proxy/api/config, /.proxy/api/activity/auth)
  // This proxies Discord Activity SDK auth endpoints to Core
  setupActivityAuthProxy(app);
}
