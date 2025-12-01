/**
 * Container Proxy Middleware
 *
 * Proxies container API requests from Discord Activity to Core.
 * Handles HTTP and WebSocket requests for container operations.
 *
 * HTTP: /.proxy/api/container/* → ${CORE_SERVER_URL}/api/container/*
 * WS:   /.proxy/api/container/terminal → ws://${CORE_SERVER_URL}/api/container/terminal
 *
 * @see https://core.crit-fumble.com README for proxy requirements
 */

import type { Application, Request, Response } from 'express';
import { createProxyMiddleware, type Options as ProxyOptions } from 'http-proxy-middleware';
import type { IncomingMessage } from 'http';
import type { Socket } from 'net';

export interface ContainerProxyConfig {
  /** Core API URL */
  coreUrl: string;
  /** Shared secret for service auth */
  coreSecret: string;
  /** Proxy path prefix (default: /.proxy) */
  proxyPrefix?: string;
  /** Enable debug logging */
  debug?: boolean;
  /** Function to extract user context from request */
  getUserContext?: (req: Request) => UserContext | null;
}

interface UserContext {
  userId: string;
  userName?: string;
  guildId: string;
  channelId: string;
}

/**
 * Setup container proxy routes
 *
 * This sets up HTTP proxy for container API endpoints.
 * WebSocket proxy for terminal can be added separately when needed.
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { setupContainerProxy } from './services/container';
 * import { getCoreProxyConfig } from './config';
 *
 * const app = express();
 * const coreConfig = getCoreProxyConfig();
 *
 * if (coreConfig) {
 *   const coreUrl = coreConfig.url.includes(':')
 *     ? coreConfig.url
 *     : `${coreConfig.url}:${coreConfig.port}`;
 *
 *   setupContainerProxy(app, {
 *     coreUrl,
 *     coreSecret: coreConfig.secret,
 *   });
 * }
 * ```
 */
export function setupContainerProxy(
  app: Application,
  config: ContainerProxyConfig
): void {
  const prefix = config.proxyPrefix || '/.proxy';
  const containerPath = `${prefix}/api/container`;

  if (config.debug) {
    console.log(`[ContainerProxy] Setting up proxy at ${containerPath} -> ${config.coreUrl}`);
  }

  // Proxy options for both HTTP and WebSocket
  const proxyOptions: ProxyOptions = {
    target: config.coreUrl,
    changeOrigin: true,
    ws: true, // Enable WebSocket proxying
    pathRewrite: {
      [`^${prefix}`]: '', // Remove proxy prefix: /.proxy/api/container → /api/container
    },
    on: {
      proxyReq: (proxyReq, req) => {
        // Add Core auth headers for HTTP requests
        proxyReq.setHeader('X-Core-Secret', config.coreSecret);

        // Extract user context from request
        const userContext = config.getUserContext
          ? config.getUserContext(req as Request)
          : extractUserContextFromRequest(req as Request);

        if (userContext) {
          proxyReq.setHeader('X-User-Id', userContext.userId);
          if (userContext.userName) {
            proxyReq.setHeader('X-User-Name', userContext.userName);
          }
          proxyReq.setHeader('X-Guild-Id', userContext.guildId);
          proxyReq.setHeader('X-Channel-Id', userContext.channelId);
        }

        // Forward original host info
        const originalHost = (req as Request).get?.('host');
        if (originalHost) {
          proxyReq.setHeader('X-Forwarded-Host', originalHost);
        }
        proxyReq.setHeader('X-Forwarded-Proto', 'https');

        if (config.debug) {
          console.log(`[ContainerProxy] Proxying HTTP ${req.method} ${req.url}`);
        }
      },
      proxyReqWs: (proxyReq, req, socket, options, head) => {
        // Add Core auth header for WebSocket upgrade requests
        proxyReq.setHeader('X-Core-Secret', config.coreSecret);

        // For WebSocket, user context is passed via query params
        // The client sends: /.proxy/api/container/terminal?guildId=X&channelId=Y&userId=Z&secret=S
        // We forward these params and add the X-Core-Secret header
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const guildId = url.searchParams.get('guildId');
        const channelId = url.searchParams.get('channelId');
        const userId = url.searchParams.get('userId');
        const userName = url.searchParams.get('userName');

        if (guildId) proxyReq.setHeader('X-Guild-Id', guildId);
        if (channelId) proxyReq.setHeader('X-Channel-Id', channelId);
        if (userId) proxyReq.setHeader('X-User-Id', userId);
        if (userName) proxyReq.setHeader('X-User-Name', userName);

        if (config.debug) {
          console.log(`[ContainerProxy] Proxying WebSocket upgrade ${req.url}`);
        }
      },
      proxyRes: (proxyRes, req) => {
        if (config.debug) {
          console.log(`[ContainerProxy] Response: ${proxyRes.statusCode} ${req.url}`);
        }
      },
      error: (err, req, res) => {
        console.error(`[ContainerProxy] Error:`, err.message);
        if (res && 'status' in res) {
          (res as Response).status(502).json({
            error: 'Proxy Error',
            message: 'Failed to reach Core API',
          });
        }
      },
    },
  };

  // Create HTTP proxy middleware
  const httpProxy = createProxyMiddleware(proxyOptions);

  // Mount HTTP proxy for container API
  app.use(containerPath, httpProxy);

  console.log(`[ContainerProxy] Container proxy configured at ${containerPath}`);
}

/**
 * Extract user context from request
 *
 * Looks for context in:
 * 1. Request headers (X-User-Id, X-Guild-Id, X-Channel-Id)
 * 2. Request body (userId, guildId, channelId)
 * 3. Query params
 */
function extractUserContextFromRequest(req: Request): UserContext | null {
  // Try headers first
  const headerUserId = req.get('x-user-id');
  const headerGuildId = req.get('x-guild-id');
  const headerChannelId = req.get('x-channel-id');

  if (headerUserId && headerGuildId && headerChannelId) {
    return {
      userId: headerUserId,
      userName: req.get('x-user-name'),
      guildId: headerGuildId,
      channelId: headerChannelId,
    };
  }

  // Try body
  const body = req.body || {};
  if (body.userId && body.guildId && body.channelId) {
    return {
      userId: body.userId,
      userName: body.userName,
      guildId: body.guildId,
      channelId: body.channelId,
    };
  }

  // Try query params
  const query = req.query || {};
  if (query.userId && query.guildId && query.channelId) {
    return {
      userId: query.userId as string,
      userName: query.userName as string,
      guildId: query.guildId as string,
      channelId: query.channelId as string,
    };
  }

  return null;
}
