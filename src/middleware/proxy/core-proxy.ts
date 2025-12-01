/**
 * Core Server Proxy
 *
 * Routes requests to the core.crit-fumble.com server running on
 * DigitalOcean's internal network.
 *
 * Authentication:
 * - Forwards X-Core-Secret header for service-to-service auth
 * - Forwards X-User-Id and X-User-Role for user authorization
 * - Core validates the secret and uses user info for access control
 */

import { createProxyMiddleware, type Options as ProxyOptions } from 'http-proxy-middleware';
import type { Request, Response, NextFunction, Application, RequestHandler } from 'express';
import type { IncomingMessage, ServerResponse } from 'http';

/**
 * User info to forward to core server
 */
export interface CoreUserInfo {
  /** User's unique ID (Discord ID) */
  userId: string;
  /** User's role: 'admin', 'user', or 'guest' */
  role: 'admin' | 'user' | 'guest';
}

/**
 * Function to extract user info from the request
 * Return null if user is not authenticated
 */
export type GetUserInfoFn = (req: Request) => CoreUserInfo | null;

export interface CoreProxyConfig {
  /**
   * Core server URL (internal DO network)
   * Required - set via CORE_SERVER_URL environment variable
   */
  coreUrl: string;

  /**
   * Port the core server is running on
   * @default 4000
   */
  corePort?: number;

  /**
   * Paths to proxy to core server
   * Requests matching these prefixes will be forwarded
   */
  proxyPaths?: string[];

  /**
   * Shared secret for service-to-service authentication
   * Sent as X-Core-Secret header - core validates this
   */
  secret?: string;

  /**
   * Function to extract user info from request for authorization
   * If provided, X-User-Id and X-User-Role headers will be forwarded
   */
  getUserInfo?: GetUserInfoFn;

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean;

  /**
   * Custom error handler
   */
  onError?: (err: Error, req: IncomingMessage, res: ServerResponse) => void;

  /**
   * Timeout for proxy requests in milliseconds
   * @default 30000
   */
  timeout?: number;
}

const DEFAULT_CONFIG: Omit<Required<Omit<CoreProxyConfig, 'coreUrl' | 'onError' | 'secret' | 'getUserInfo'>>, 'coreUrl'> & {
  secret: string | undefined;
  getUserInfo: GetUserInfoFn | undefined;
} = {
  corePort: 4000,
  // Default proxy paths - core server defines its own API structure
  proxyPaths: [
    '/api/core',
    '/wiki',
  ],
  secret: undefined,
  getUserInfo: undefined,
  debug: false,
  timeout: 30000,
};

/**
 * Build the full core server URL
 */
export function buildCoreUrl(config: CoreProxyConfig): string {
  const url = config.coreUrl;
  const port = config.corePort || DEFAULT_CONFIG.corePort;

  // If URL already has a port, use it as-is
  if (url.match(/:\d+$/)) {
    return url;
  }

  return `${url}:${port}`;
}

/**
 * Create proxy middleware for a specific path
 */
export function createCoreProxyMiddleware(
  pathPrefix: string,
  config: CoreProxyConfig
): RequestHandler {
  const target = buildCoreUrl(config);
  const debug = config.debug ?? DEFAULT_CONFIG.debug;
  const timeout = config.timeout ?? DEFAULT_CONFIG.timeout;
  const secret = config.secret;
  const getUserInfo = config.getUserInfo;

  const proxyOptions: ProxyOptions = {
    target,
    changeOrigin: true,
    // Keep the path as-is (don't rewrite)
    pathRewrite: undefined,
    // Timeout settings
    proxyTimeout: timeout,
    timeout: timeout,
    // Logging
    logger: debug ? console : undefined,
    on: {
      proxyReq: (proxyReq, req) => {
        if (debug) {
          console.log(`[CoreProxy] ${req.method} ${req.url} -> ${target}${req.url}`);
        }

        // Forward the original host for proper routing
        proxyReq.setHeader('X-Forwarded-Host', req.headers.host || '');
        proxyReq.setHeader('X-Forwarded-Proto', 'https');

        // Service-to-service authentication
        if (secret) {
          proxyReq.setHeader('X-Core-Secret', secret);
        }

        // Forward user info for authorization
        if (getUserInfo) {
          const userInfo = getUserInfo(req as unknown as Request);
          if (userInfo) {
            proxyReq.setHeader('X-User-Id', userInfo.userId);
            proxyReq.setHeader('X-User-Role', userInfo.role);
            if (debug) {
              console.log(`[CoreProxy] Forwarding user: ${userInfo.userId} (${userInfo.role})`);
            }
          } else {
            // Explicitly indicate no authenticated user
            proxyReq.setHeader('X-User-Role', 'guest');
            if (debug) {
              console.log(`[CoreProxy] No authenticated user, forwarding as guest`);
            }
          }
        }
      },
      proxyRes: (proxyRes, req) => {
        if (debug) {
          console.log(`[CoreProxy] ${req.method} ${req.url} <- ${proxyRes.statusCode}`);
        }
      },
      error: (err, req, res) => {
        console.error(`[CoreProxy] Error proxying ${req.url}:`, err.message);
        if (config.onError) {
          config.onError(err, req, res as ServerResponse);
        } else if (res && 'writeHead' in res) {
          const serverRes = res as ServerResponse;
          if (!serverRes.headersSent) {
            serverRes.writeHead(502, { 'Content-Type': 'application/json' });
            serverRes.end(JSON.stringify({
              error: 'Core server unavailable',
              message: 'Unable to connect to core server',
            }));
          }
        }
      },
    },
  };

  return createProxyMiddleware(proxyOptions);
}

/**
 * Setup core proxy routes on an Express application
 *
 * @example
 * ```typescript
 * import { setupCoreProxy } from './middleware/proxy/core-proxy.js'
 *
 * const app = express()
 *
 * if (process.env.CORE_SERVER_URL) {
 *   setupCoreProxy(app, {
 *     coreUrl: process.env.CORE_SERVER_URL,
 *     corePort: 4000,
 *     debug: process.env.NODE_ENV !== 'production',
 *   })
 * }
 * ```
 */
export function setupCoreProxy(app: Application, config: CoreProxyConfig): void {
  const paths = config.proxyPaths || DEFAULT_CONFIG.proxyPaths;
  const target = buildCoreUrl(config);
  const debug = config.debug ?? DEFAULT_CONFIG.debug;

  if (debug) {
    console.log(`[CoreProxy] Setting up proxy to ${target}`);
    console.log(`[CoreProxy] Proxying paths: ${paths.join(', ')}`);
  }

  for (const pathPrefix of paths) {
    const middleware = createCoreProxyMiddleware(pathPrefix, config);
    app.use(pathPrefix, middleware);

    if (debug) {
      console.log(`[CoreProxy] Registered: ${pathPrefix} -> ${target}`);
    }
  }
}

/**
 * Create a conditional proxy that checks if core server is available
 * Falls back to local handling if core is unreachable
 */
export function createCoreProxyWithFallback(
  config: CoreProxyConfig,
  fallbackHandler: RequestHandler
): RequestHandler {
  const proxy = createCoreProxyMiddleware('/', config);

  return async (req: Request, res: Response, next: NextFunction) => {
    // Try to proxy, but catch connection errors
    try {
      proxy(req, res, (err) => {
        if (err) {
          console.warn('[CoreProxy] Falling back to local handler:', err.message);
          fallbackHandler(req, res, next);
        } else {
          next();
        }
      });
    } catch {
      console.warn('[CoreProxy] Proxy failed, using fallback');
      fallbackHandler(req, res, next);
    }
  };
}

/**
 * Health check for core server connectivity
 */
export async function checkCoreHealth(config: CoreProxyConfig): Promise<boolean> {
  const target = buildCoreUrl(config);
  const timeout = config.timeout ?? 5000;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(`${target}/health`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}
