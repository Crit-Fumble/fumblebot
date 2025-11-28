/**
 * Platform Server
 * Multi-platform server for FumbleBot
 *
 * Supports multiple client platforms:
 * - Discord: Activity SDK integration with OAuth2 and permission checking
 * - Web: Browser-based access via www.crit-fumble.com
 * - Mobile (iOS/Android): Responsive web with mobile optimizations
 *
 * All platforms share the same underlying API and core functionality,
 * but serve platform-optimized UIs based on the detected context.
 */

import express, { type Request, type Response } from 'express';
import { routes, printRouteTable } from './routes.js';
import { setupAllMiddleware } from './middleware.js';
import { detectPlatform } from './controllers/detection.js';
import {
  handleTokenExchange,
  handleOAuthCallback,
  handleGetAuthUser,
  handleSessionCreate,
  handleSessionGet,
} from './controllers/index.js';
import {
  getDiscordActivityHtml,
  getWebDashboardHtml,
  getCharacterSheetHtml,
  getDiceRollerHtml,
  getMapViewerHtml,
  getInitiativeTrackerHtml,
  getSpellLookupHtml,
} from './views/index.js';
import type { Platform, PlatformContext, PlatformServerConfig } from './models/types.js';

// Re-export types
export type { Platform, PlatformContext, PlatformServerConfig };
export type { ActivityServerConfig } from './models/types.js';

export class PlatformServer {
  private app: express.Application;
  private server: any;
  private config: PlatformServerConfig;

  constructor(config: PlatformServerConfig) {
    this.config = config;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    setupAllMiddleware(this.app);
  }

  /**
   * Setup Express routes from routes.ts definitions
   */
  private setupRoutes(): void {
    // Register all routes from the routes definition
    for (const categoryRoutes of Object.values(routes)) {
      for (const route of categoryRoutes) {
        const handler = this.getHandler(route.handler);
        if (handler) {
          this.app[route.method](route.path, handler);
        } else {
          console.warn(`[Platform] Handler not found: ${route.handler}`);
        }
      }
    }

    // 404 handler (must be last)
    this.app.use((req, res) => {
      res.status(404).json({ error: 'Not found' });
    });

    // Log routes in development
    if (process.env.NODE_ENV !== 'production') {
      printRouteTable();
    }
  }

  /**
   * Get a handler function by name
   * Maps route handler names to actual methods
   */
  private getHandler(name: string): ((req: Request, res: Response) => void) | null {
    const handlers: Record<string, (req: Request, res: Response) => void> = {
      // System
      handleHealth: (req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
      },
      handlePlatformInfo: (req, res) => {
        const ctx = detectPlatform(req);
        res.json(ctx);
      },

      // Auth
      handleTokenExchange: (req, res) => handleTokenExchange(req, res),
      handleOAuthCallback: (req, res) => handleOAuthCallback(req, res, this.config),
      handleGetAuthUser: (req, res) => handleGetAuthUser(req, res),

      // Platform routes
      handleRoot: (req, res) => {
        const ctx = detectPlatform(req);
        if (ctx.isDiscordActivity) {
          this.serveDiscordActivity(req, res);
        } else {
          this.serveWebActivity(req, res, ctx);
        }
      },
      handleDiscordRoute: (req, res) => this.serveDiscordActivity(req, res),
      handleWebRoute: (req, res) => {
        const ctx = detectPlatform(req);
        this.serveWebActivity(req, res, ctx);
      },

      // Activities
      serveCharacterSheet: (req, res) => this.serveCharacterSheet(req, res),
      serveDiceRoller: (req, res) => this.serveDiceRoller(req, res),
      serveMapViewer: (req, res) => this.serveMapViewer(req, res),
      serveInitiativeTracker: (req, res) => this.serveInitiativeTracker(req, res),
      serveSpellLookup: (req, res) => this.serveSpellLookup(req, res),

      // Sessions
      handleSessionCreate: (req, res) => handleSessionCreate(req, res),
      handleSessionGet: (req, res) => handleSessionGet(req, res),
    };

    return handlers[name] || null;
  }

  /**
   * Serve Discord Activity landing page
   */
  private serveDiscordActivity(req: Request, res: Response): void {
    const clientId = process.env.FUMBLEBOT_DISCORD_CLIENT_ID || '';
    res.send(getDiscordActivityHtml(clientId));
  }

  /**
   * Serve Web Dashboard landing page
   */
  private serveWebActivity(req: Request, res: Response, ctx: PlatformContext): void {
    const clientId = process.env.FUMBLEBOT_DISCORD_CLIENT_ID || '';
    res.send(getWebDashboardHtml(clientId, this.config.publicUrl, ctx));
  }

  /**
   * Serve character sheet viewer
   */
  private serveCharacterSheet(req: Request, res: Response): void {
    const characterId = req.params.characterId;
    res.send(getCharacterSheetHtml(characterId));
  }

  /**
   * Serve dice roller activity
   */
  private serveDiceRoller(req: Request, res: Response): void {
    res.send(getDiceRollerHtml());
  }

  /**
   * Serve map viewer activity
   */
  private serveMapViewer(req: Request, res: Response): void {
    res.send(getMapViewerHtml());
  }

  /**
   * Serve initiative tracker activity
   */
  private serveInitiativeTracker(req: Request, res: Response): void {
    res.send(getInitiativeTrackerHtml());
  }

  /**
   * Serve spell lookup activity
   */
  private serveSpellLookup(req: Request, res: Response): void {
    res.send(getSpellLookupHtml());
  }

  /**
   * Start the platform server
   */
  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.config.port, this.config.host || '0.0.0.0', () => {
        console.log(`[Platform] Server running on ${this.config.publicUrl}`);
        console.log(`[Platform] Local: http://localhost:${this.config.port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the platform server
   */
  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((err: Error) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// Legacy alias for backwards compatibility
export const ActivityServer = PlatformServer;
export type ActivityServer = PlatformServer;
