/**
 * Proxy Middleware for Discord Activity Routing
 *
 * Enables proxying requests between different servers:
 * - Activity server proxying for multi-service architectures
 * - Path-based routing to different backends
 */

import { createProxyMiddleware, type Options as ProxyOptions } from 'http-proxy-middleware';
import type { Request, Response, NextFunction, Application, RequestHandler } from 'express';
import type { IncomingMessage, ServerResponse } from 'http';

export interface ActivityProxyConfig {
  /** Target server URL (e.g., 'http://localhost:3000') */
  target: string;
  /** Path prefix to match (e.g., '/discord/activity') */
  pathPrefix: string;
  /** Whether to change the origin header */
  changeOrigin?: boolean;
  /** Path rewrite rules */
  pathRewrite?: Record<string, string>;
  /** WebSocket support */
  ws?: boolean;
  /** Custom error handler */
  onError?: (err: Error, req: IncomingMessage, res: ServerResponse | import('net').Socket) => void;
}

/**
 * Create proxy middleware for activity server routing
 */
export function createActivityProxy(config: ActivityProxyConfig): RequestHandler {
  const {
    target,
    pathPrefix,
    changeOrigin = true,
    pathRewrite,
    ws = false,
    onError,
  } = config;

  const proxyOptions: ProxyOptions = {
    target,
    changeOrigin,
    ws,
  };

  // Use path rewrite if provided, otherwise keep paths as-is
  if (pathRewrite) {
    proxyOptions.pathRewrite = pathRewrite;
  } else {
    // Default: keep the path prefix intact
    proxyOptions.pathRewrite = {
      [`^${pathPrefix}`]: pathPrefix,
    };
  }

  // Add error handler if provided
  if (onError) {
    proxyOptions.on = {
      error: onError,
    };
  }

  return createProxyMiddleware(proxyOptions);
}

/**
 * Create a handler that proxies requests to an activity server
 * Useful for inline proxying in route handlers
 */
export function proxyToActivityServer(
  target: string,
  pathPrefix: string = '/discord/activity'
): (req: Request, res: Response, next: NextFunction) => void {
  const proxy = createActivityProxy({ target, pathPrefix });

  return (req: Request, res: Response, next: NextFunction) => {
    proxy(req, res, next);
  };
}

/**
 * Setup activity proxy on an Express application
 */
export function setupActivityProxy(app: Application, config: ActivityProxyConfig): void {
  const proxy = createActivityProxy(config);
  app.use(config.pathPrefix, proxy);
}

export interface MultiProxyConfig {
  /** Map of path prefixes to target servers */
  routes: Record<string, string>;
  /** Default proxy options applied to all routes */
  defaultOptions?: Partial<ActivityProxyConfig>;
}

/**
 * Setup multiple proxies for different path prefixes
 */
export function setupMultiProxy(app: Application, config: MultiProxyConfig): void {
  const { routes, defaultOptions = {} } = config;

  for (const [pathPrefix, target] of Object.entries(routes)) {
    const proxyConfig: ActivityProxyConfig = {
      target,
      pathPrefix,
      ...defaultOptions,
    };
    setupActivityProxy(app, proxyConfig);
  }
}

/**
 * Create a conditional proxy that only proxies if a condition is met
 */
export function createConditionalProxy(
  config: ActivityProxyConfig,
  condition: (req: Request) => boolean
): RequestHandler {
  const proxy = createActivityProxy(config);

  return (req: Request, res: Response, next: NextFunction) => {
    if (condition(req)) {
      proxy(req, res, next);
    } else {
      next();
    }
  };
}
