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

// Load environment variables from .env file
import 'dotenv/config';

import express, { type Request, type Response } from 'express';
import { prisma } from './services/db/client.js';
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
  // Channel KB sources
  handleListChannelKBSources,
  handleGetChannelKBSource,
  handleCreateChannelKBSource,
  handleUpdateChannelKBSource,
  handleDeleteChannelKBSource,
  handleSyncChannelKBSource,
  handleListGuildChannels,
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
  handleVoiceStatus,
  handleVoiceSessions,
  handleVoiceJoin,
  handleVoiceLeave,
  handleVoicePlay,
  handleVoiceStop,
  handleVoiceListenStart,
  handleVoiceListenStop,
  handleVoiceTranscript,
  handleVoiceMode,
  validateVoiceSecret,
} from './controllers/voice.js';
import {
  chatRateLimiter,
  commandRateLimiter,
} from './middleware/index.js';
import { AIService } from './services/ai/service.js';
import { GradientService } from './services/ai/gradient.js';
import { FumbleBotClient, setFumbleBotClient } from './services/discord/index.js';
import { voiceAssistant } from './services/discord/voice/index.js';
import type { PlatformServerConfig } from './models/types.js';
import {
  loadOpenAIConfig,
  loadAnthropicConfig,
  loadGradientConfig,
  loadDiscordConfig,
  getServerConfig,
  getCoreProxyConfig,
} from './config.js';
import { initializePersonaSystem } from './services/persona/index.js';

// Re-export types
export type { Platform, PlatformContext, PlatformServerConfig, ActivityServerConfig } from './models/types.js';

/**
 * Initialize AI services with API keys from centralized config
 */
function initializeAIService(): void {
  const ai = AIService.getInstance();

  try {
    const anthropicConfig = loadAnthropicConfig();
    if (anthropicConfig.apiKey) {
      ai.initializeAnthropic({
        apiKey: anthropicConfig.apiKey,
        model: anthropicConfig.model,
        maxTokens: 4096,
      });
    }
  } catch {
    console.warn('[Platform] Anthropic API key not configured - Anthropic AI unavailable');
  }

  try {
    const openaiConfig = loadOpenAIConfig();
    if (openaiConfig.apiKey) {
      ai.initializeOpenAI({
        apiKey: openaiConfig.apiKey,
        model: openaiConfig.model,
        maxTokens: 4096,
      });
    }
  } catch {
    console.warn('[Platform] OpenAI API key not configured - OpenAI unavailable');
  }

  // Initialize DigitalOcean Gradient AI (Llama, Mistral, and partner models)
  const gradientConfig = loadGradientConfig();
  if (gradientConfig) {
    const gradient = GradientService.getInstance();
    gradient.initialize({
      inferenceKey: gradientConfig.inferenceKey,
      defaultModel: gradientConfig.defaultModel,
    });
  } else {
    console.warn('[Platform] Gradient API key not configured - Gradient AI unavailable');
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

    // Register channel KB sources routes with guild admin authentication
    for (const route of routes.channelKB || []) {
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

    // Register voice routes with API secret authentication
    for (const route of routes.voice || []) {
      const handler = this.getHandler(route.handler);
      if (handler) {
        this.app[route.method](route.path, validateVoiceSecret, handler);
      }
    }

    // Register all other routes from the routes definition
    for (const [category, categoryRoutes] of Object.entries(routes)) {
      // Skip already handled categories
      if (category === 'chat' || category === 'commands' || category === 'admin' || category === 'prompts' || category === 'channelKB' || category === 'ai' || category === 'voice') continue;
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
    if (!getServerConfig().isProduction) {
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
      handleHealthDetailed: async (req, res) => {
        const timestamp = new Date().toISOString();
        const results: {
          status: 'ok' | 'degraded' | 'error';
          timestamp: string;
          database: { status: 'ok' | 'error'; latencyMs?: number; error?: string };
          core: { status: 'ok' | 'error'; latencyMs?: number; error?: string };
        } = {
          status: 'ok',
          timestamp,
          database: { status: 'error' },
          core: { status: 'error' },
        };

        // Check database connection
        try {
          const dbStart = Date.now();
          await prisma.$queryRaw`SELECT 1`;
          results.database = { status: 'ok', latencyMs: Date.now() - dbStart };
        } catch (err) {
          results.database = { status: 'error', error: err instanceof Error ? err.message : 'Unknown error' };
        }

        // Check Core API connection
        try {
          const coreProxyConfig = getCoreProxyConfig();
          const coreUrl = coreProxyConfig
            ? (coreProxyConfig.url.includes(':') ? coreProxyConfig.url : `${coreProxyConfig.url}:${coreProxyConfig.port}`)
            : 'https://core.crit-fumble.com';
          const coreStart = Date.now();
          const coreResponse = await fetch(`${coreUrl}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000),
          });
          if (coreResponse.ok) {
            results.core = { status: 'ok', latencyMs: Date.now() - coreStart };
          } else {
            results.core = { status: 'error', error: `HTTP ${coreResponse.status}` };
          }
        } catch (err) {
          results.core = { status: 'error', error: err instanceof Error ? err.message : 'Unknown error' };
        }

        // Overall status
        if (results.database.status === 'error' && results.core.status === 'error') {
          results.status = 'error';
        } else if (results.database.status === 'error' || results.core.status === 'error') {
          results.status = 'degraded';
        }

        const httpStatus = results.status === 'error' ? 503 : results.status === 'degraded' ? 207 : 200;
        res.status(httpStatus).json(results);
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

      // Channel KB sources
      handleListChannelKBSources: (req, res) => handleListChannelKBSources(req, res),
      handleGetChannelKBSource: (req, res) => handleGetChannelKBSource(req, res),
      handleCreateChannelKBSource: (req, res) => handleCreateChannelKBSource(req, res),
      handleUpdateChannelKBSource: (req, res) => handleUpdateChannelKBSource(req, res),
      handleDeleteChannelKBSource: (req, res) => handleDeleteChannelKBSource(req, res),
      handleSyncChannelKBSource: (req, res) => handleSyncChannelKBSource(req, res),
      handleListGuildChannels: (req, res) => handleListGuildChannels(req, res),

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

      // Voice API
      handleVoiceStatus: (req, res) => handleVoiceStatus(req, res),
      handleVoiceSessions: (req, res) => handleVoiceSessions(req, res),
      handleVoiceJoin: (req, res) => handleVoiceJoin(req, res),
      handleVoiceLeave: (req, res) => handleVoiceLeave(req, res),
      handleVoicePlay: (req, res) => handleVoicePlay(req, res),
      handleVoiceStop: (req, res) => handleVoiceStop(req, res),
      handleVoiceListenStart: (req, res) => handleVoiceListenStart(req, res),
      handleVoiceListenStop: (req, res) => handleVoiceListenStop(req, res),
      handleVoiceTranscript: (req, res) => handleVoiceTranscript(req, res),
      handleVoiceMode: (req, res) => handleVoiceMode(req, res),
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
// Check if running as main module - works with node, tsx, and PM2
const isMainModule = import.meta.url.endsWith('server.ts') || import.meta.url.endsWith('server.js');

if (isMainModule) {
  const serverConfig = getServerConfig();
  const config = {
    port: serverConfig.port,
    host: serverConfig.host,
    publicUrl: serverConfig.publicUrl,
  };

  console.log('[Platform] Starting server on port', config.port);

  // Initialize AI service with API keys
  initializeAIService();

  const server = new PlatformServer(config);

  // Initialize Discord bot if credentials are provided
  let discordBot: FumbleBotClient | null = null;
  let discordConfig: ReturnType<typeof loadDiscordConfig> | null = null;
  try {
    discordConfig = loadDiscordConfig();
  } catch {
    console.warn('[Platform] Discord config not available - Discord bot disabled');
  }

  server.start().then(async () => {
    console.log('[Platform] Ready at http://localhost:' + config.port + '/discord/activity');

    // Start Discord bot
    if (discordConfig?.token && discordConfig?.clientId) {
      try {
        discordBot = new FumbleBotClient({
          token: discordConfig.token,
          clientId: discordConfig.clientId,
          clientSecret: discordConfig.clientSecret,
          publicKey: discordConfig.publicKey,
          guildId: discordConfig.guildId,
        });
        await discordBot.start();
        setFumbleBotClient(discordBot); // Make bot available to voice API
        voiceAssistant.setDiscordClient(discordBot.client); // Enable voice state tracking
        console.log('[Platform] Discord bot started');

        // Initialize persona system (seeds default persona and skills)
        try {
          await initializePersonaSystem();
          console.log('[Platform] Persona system initialized');
        } catch (err) {
          console.error('[Platform] Failed to initialize persona system:', err);
          // Continue running - persona features will be limited
        }
      } catch (err) {
        console.error('[Platform] Failed to start Discord bot:', err);
        // Continue running API server even if bot fails
      }
    } else {
      console.warn('[Platform] Discord credentials not configured - Discord bot disabled');
    }
  }).catch((err) => {
    console.error('[Platform] Failed to start:', err);
    process.exit(1);
  });

  process.on('SIGINT', async () => {
    console.log('\n[Platform] Shutting down...');
    setFumbleBotClient(null);
    if (discordBot) await discordBot.stop();
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n[Platform] Shutting down...');
    setFumbleBotClient(null);
    if (discordBot) await discordBot.stop();
    await server.stop();
    process.exit(0);
  });
}
