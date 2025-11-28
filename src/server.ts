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
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { routes, printRouteTable } from './routes.js';
import { setupAllMiddleware } from './middleware.js';
import { detectPlatform } from './controllers/detection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import {
  handleTokenExchange,
  handleOAuthCallback,
  handleGetAuthUser,
  handleLogout,
  handleGetUserGuilds,
  handleSessionCreate,
  handleSessionGet,
  handleListSystems,
  handleGetSystem,
  handleAddSystem,
  handlePreviewSystem,
  handleDeleteSystem,
  handleSeedSystems,
} from './controllers/index.js';
import {
  handleExecuteCommand,
  handleListCommands,
  handleExecuteCommandString,
} from './controllers/commands.js';
import {
  handleChat,
  handleChatHistory,
  validateBotSecret,
} from './controllers/chat.js';
import {
  chatRateLimiter,
  commandRateLimiter,
} from './middleware/index.js';
import {
  getDiscordActivityHtml,
  getWebDashboardHtml,
  getWebActivityHtml,
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

    // Serve static files from React build output (dist/public)
    const publicPath = path.join(__dirname, 'public');
    if (fs.existsSync(publicPath)) {
      this.app.use(express.static(publicPath, {
        // Cache static assets for 1 year (they have content hashes)
        maxAge: '1y',
        // But not index.html
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      }));
    }
  }

  /**
   * Setup Express routes from routes.ts definitions
   */
  private setupRoutes(): void {
    // Register chat routes with bot secret middleware + rate limiting
    for (const route of routes.chat || []) {
      const handler = this.getHandler(route.handler);
      if (handler) {
        this.app[route.method](route.path, validateBotSecret, chatRateLimiter, handler);
      }
    }

    // Register command routes with rate limiting
    for (const route of routes.commands || []) {
      const handler = this.getHandler(route.handler);
      if (handler) {
        this.app[route.method](route.path, commandRateLimiter, handler);
      }
    }

    // Register all other routes from the routes definition
    for (const [category, categoryRoutes] of Object.entries(routes)) {
      if (category === 'chat' || category === 'commands') continue; // Already handled above
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
      handleLogout: (req, res) => handleLogout(req, res),
      handleGetUserGuilds: (req, res) => handleGetUserGuilds(req, res),

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
      handleWebActivityRoute: (req, res) => this.serveWebActivityPanel(req, res),

      // Activities
      serveCharacterSheet: (req, res) => this.serveCharacterSheet(req, res),
      serveDiceRoller: (req, res) => this.serveDiceRoller(req, res),
      serveMapViewer: (req, res) => this.serveMapViewer(req, res),
      serveInitiativeTracker: (req, res) => this.serveInitiativeTracker(req, res),
      serveSpellLookup: (req, res) => this.serveSpellLookup(req, res),

      // Sessions
      handleSessionCreate: (req, res) => handleSessionCreate(req, res),
      handleSessionGet: (req, res) => handleSessionGet(req, res),

      // Foundry Systems
      handleListSystems: (req, res) => handleListSystems(req, res),
      handleGetSystem: (req, res) => handleGetSystem(req, res),
      handleAddSystem: (req, res) => handleAddSystem(req, res),
      handlePreviewSystem: (req, res) => handlePreviewSystem(req, res),
      handleDeleteSystem: (req, res) => handleDeleteSystem(req, res),
      handleSeedSystems: (req, res) => handleSeedSystems(req, res),

      // Commands API
      handleListCommands: (req, res) => handleListCommands(req, res),
      handleExecuteCommand: (req, res) => handleExecuteCommand(req, res),
      handleExecuteCommandString: (req, res) => handleExecuteCommandString(req, res),

      // Chat API (website integration)
      handleChat: (req, res) => handleChat(req, res),
      handleChatHistory: (req, res) => handleChatHistory(req, res),
    };

    return handlers[name] || null;
  }

  /**
   * Serve Discord Activity landing page (React app)
   */
  private serveDiscordActivity(req: Request, res: Response): void {
    // Serve the built React app's index.html
    const indexPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      // Fallback to legacy HTML if React app isn't built
      const clientId = process.env.FUMBLEBOT_DISCORD_CLIENT_ID || '';
      res.send(getDiscordActivityHtml(clientId));
    }
  }

  /**
   * Serve Web Dashboard landing page
   */
  private serveWebActivity(req: Request, res: Response, ctx: PlatformContext): void {
    const clientId = process.env.FUMBLEBOT_DISCORD_CLIENT_ID || '';
    res.send(getWebDashboardHtml(clientId, this.config.publicUrl, ctx));
  }

  /**
   * Serve Web Activity Panel (React app with OAuth session auth)
   * Now uses the same React app as Discord, with platform detection
   */
  private serveWebActivityPanel(req: Request, res: Response): void {
    // Serve the built React app's index.html (same app, different auth flow)
    const indexPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      // Fallback to legacy HTML if React app isn't built
      const clientId = process.env.FUMBLEBOT_DISCORD_CLIENT_ID || '';
      res.send(getWebActivityHtml(clientId, this.config.publicUrl));
    }
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

// Standalone server entry point
// Check if this file is being run directly (works with both node and tsx)
const isMainModule = import.meta.url.includes('server.ts') || import.meta.url.includes('server.js');

if (isMainModule && process.argv[1]?.includes('server')) {
  const port = parseInt(process.env.PORT || '3000');
  const config = {
    port,
    host: '0.0.0.0',
    publicUrl: process.env.PUBLIC_URL || 'https://fumblebot.crit-fumble.com',
  };

  console.log('[Platform] Starting server on port', port);

  const server = new PlatformServer(config);

  server.start().then(() => {
    console.log('[Platform] Ready at http://localhost:' + port + '/discord/activity');
  }).catch((err) => {
    console.error('[Platform] Failed to start:', err);
    process.exit(1);
  });

  process.on('SIGINT', async () => {
    console.log('\n[Platform] Shutting down...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n[Platform] Shutting down...');
    await server.stop();
    process.exit(0);
  });
}
