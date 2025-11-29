/**
 * Platform Server
 * Multi-platform server for FumbleBot
 *
 * This server handles:
 * - Discord OAuth2 authentication and token exchange
 * - API endpoints for commands, chat, systems, and sessions
 * - Proxying to core server for React UI and activity content
 *
 * All UI content is served from the core server via the proxy.
 * This server adds Discord-specific headers (CSP for iframe embedding)
 * and handles Discord Activity SDK token exchange.
 */

import express, { type Request, type Response } from 'express';
import { routes, printRouteTable } from './routes.js';
import { setupAllMiddleware, requireAdmin, requireGuildAdmin } from './middleware.js';
import {
  handleTokenExchange,
  handleOAuthCallback,
  handleGetAuthUser,
  handleLogout,
  handleGetUserGuilds,
  handleGetUserActivities,
  handleSessionCreate,
  handleSessionGet,
  // Admin dashboard
  handleGetGuildMetrics,
  handleGetGuildSettings,
  handleUpdateGuildSettings,
  handleGetGuildActivity,
  // Prompt partials
  handleListPromptPartials,
  handleGetPromptPartial,
  handleCreatePromptPartial,
  handleUpdatePromptPartial,
  handleDeletePromptPartial,
  handleGetPromptsForContext,
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
  handleAIChat,
  handleAIComplete,
  handleAILookup,
  handleAIGenerateNPC,
  handleAIGenerateDungeon,
  handleAIGenerateEncounter,
  handleAIDMResponse,
  handleAICreatureBehavior,
  handleAIGenerateImage,
  handleAIHealth,
  validateAISecret,
} from './controllers/ai.js';
import {
  chatRateLimiter,
  commandRateLimiter,
} from './middleware/index.js';
import { AIService } from './services/ai/service.js';
import { GradientService } from './services/ai/gradient.js';
import type { PlatformServerConfig } from './models/types.js';

// Re-export types
export type { Platform, PlatformContext, PlatformServerConfig, ActivityServerConfig } from './models/types.js';

/**
 * Initialize AI services with API keys from environment
 */
function initializeAIService(): void {
  const ai = AIService.getInstance();

  const anthropicKey = process.env.FUMBLEBOT_ANTHROPIC_API_KEY;
  if (anthropicKey) {
    ai.initializeAnthropic({
      apiKey: anthropicKey,
      model: 'claude-sonnet-4-20250514',
      maxTokens: 4096,
    });
  } else {
    console.warn('[Platform] FUMBLEBOT_ANTHROPIC_API_KEY not set - Anthropic AI unavailable');
  }

  const openaiKey = process.env.FUMBLEBOT_OPENAI_API_KEY;
  if (openaiKey) {
    ai.initializeOpenAI({
      apiKey: openaiKey,
      model: 'gpt-4o',
      maxTokens: 4096,
    });
  } else {
    console.warn('[Platform] FUMBLEBOT_OPENAI_API_KEY not set - OpenAI unavailable');
  }

  // Initialize DigitalOcean Gradient AI (Llama, Mistral, and partner models)
  const gradientKey = process.env.FUMBLEBOT_GRADIENT_INFERENCE_KEY;
  if (gradientKey) {
    const gradient = GradientService.getInstance();
    gradient.initialize({
      inferenceKey: gradientKey,
      defaultModel: process.env.FUMBLEBOT_GRADIENT_DEFAULT_MODEL || 'llama-3.3-70b-instruct',
    });
  } else {
    console.warn('[Platform] FUMBLEBOT_GRADIENT_INFERENCE_KEY not set - Gradient AI unavailable');
  }
}

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
   * All UI content is served from core via the proxy configured in middleware
   */
  private setupMiddleware(): void {
    setupAllMiddleware(this.app);
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

    // Register admin dashboard routes with guild admin authentication
    for (const route of routes.admin || []) {
      const handler = this.getHandler(route.handler);
      if (handler) {
        this.app[route.method](route.path, requireGuildAdmin, handler);
      }
    }

    // Register prompt partials routes with guild admin authentication
    for (const route of routes.prompts || []) {
      const handler = this.getHandler(route.handler);
      if (handler) {
        this.app[route.method](route.path, requireGuildAdmin, handler);
      }
    }

    // Register AI API routes with AI secret authentication
    // Health endpoint is public, all others require X-AI-Secret
    for (const route of routes.ai || []) {
      const handler = this.getHandler(route.handler);
      if (handler) {
        if (route.handler === 'handleAIHealth') {
          // Health endpoint is public
          this.app[route.method](route.path, handler);
        } else {
          // All other AI endpoints require secret
          this.app[route.method](route.path, validateAISecret, handler);
        }
      }
    }

    // Register all other routes from the routes definition
    for (const [category, categoryRoutes] of Object.entries(routes)) {
      // Skip already handled categories
      if (category === 'chat' || category === 'commands' || category === 'admin' || category === 'prompts' || category === 'ai') continue;
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

      // Auth
      handleTokenExchange: (req, res) => handleTokenExchange(req, res),
      handleOAuthCallback: (req, res) => handleOAuthCallback(req, res, this.config),
      handleGetAuthUser: (req, res) => handleGetAuthUser(req, res),
      handleLogout: (req, res) => handleLogout(req, res),
      handleGetUserGuilds: (req, res) => handleGetUserGuilds(req, res),
      handleGetUserActivities: (req, res) => handleGetUserActivities(req, res),

      // Sessions
      handleSessionCreate: (req, res) => handleSessionCreate(req, res),
      handleSessionGet: (req, res) => handleSessionGet(req, res),

      // Commands API
      handleListCommands: (req, res) => handleListCommands(req, res),
      handleExecuteCommand: (req, res) => handleExecuteCommand(req, res),
      handleExecuteCommandString: (req, res) => handleExecuteCommandString(req, res),

      // Chat API (website integration)
      handleChat: (req, res) => handleChat(req, res),
      handleChatHistory: (req, res) => handleChatHistory(req, res),

      // Admin dashboard
      handleGetGuildMetrics: (req, res) => handleGetGuildMetrics(req, res),
      handleGetGuildSettings: (req, res) => handleGetGuildSettings(req, res),
      handleUpdateGuildSettings: (req, res) => handleUpdateGuildSettings(req, res),
      handleGetGuildActivity: (req, res) => handleGetGuildActivity(req, res),

      // Prompt partials
      handleListPromptPartials: (req, res) => handleListPromptPartials(req, res),
      handleGetPromptPartial: (req, res) => handleGetPromptPartial(req, res),
      handleCreatePromptPartial: (req, res) => handleCreatePromptPartial(req, res),
      handleUpdatePromptPartial: (req, res) => handleUpdatePromptPartial(req, res),
      handleDeletePromptPartial: (req, res) => handleDeletePromptPartial(req, res),
      handleGetPromptsForContext: (req, res) => handleGetPromptsForContext(req, res),

      // AI API
      handleAIHealth: (req, res) => handleAIHealth(req, res),
      handleAIChat: (req, res) => handleAIChat(req, res),
      handleAIComplete: (req, res) => handleAIComplete(req, res),
      handleAILookup: (req, res) => handleAILookup(req, res),
      handleAIGenerateNPC: (req, res) => handleAIGenerateNPC(req, res),
      handleAIGenerateDungeon: (req, res) => handleAIGenerateDungeon(req, res),
      handleAIGenerateEncounter: (req, res) => handleAIGenerateEncounter(req, res),
      handleAIDMResponse: (req, res) => handleAIDMResponse(req, res),
      handleAICreatureBehavior: (req, res) => handleAICreatureBehavior(req, res),
      handleAIGenerateImage: (req, res) => handleAIGenerateImage(req, res),
    };

    return handlers[name] || null;
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

  // Initialize AI service with API keys
  initializeAIService();

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
