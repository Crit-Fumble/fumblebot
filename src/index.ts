/**
 * FumbleBot
 * AI-powered Discord bot for Crit-Fumble Gaming
 *
 * Main entry point - initializes and starts the bot
 */

import 'dotenv/config'
import { FumbleBotClient } from './discord/client.js'
import { AIService } from './ai/service.js'
import { APIClient } from './api/client.js'
import { APIServer } from './api/server.js'
import { ActivityServer } from './discord/activity/server.js'
import { db } from './db/index.js'
import {
  loadConfig,
  validateConfig,
  loadDiscordConfig,
  loadOpenAIConfig,
  loadAnthropicConfig,
  loadAPIConfig,
  loadDatabaseConfig,
} from './config.js'

// Export types
export * from './types.js'

// Export modules
export { FumbleBotClient } from './discord/index.js'
export { AIService } from './ai/index.js'
export { APIClient, APIServer } from './api/index.js'
export { db, DatabaseService } from './db/index.js'
export {
  loadConfig,
  validateConfig,
  loadDiscordConfig,
  loadOpenAIConfig,
  loadAnthropicConfig,
  loadAPIConfig,
  loadDatabaseConfig,
} from './config.js'

/**
 * Main FumbleBot class
 * Orchestrates Discord client, AI services, and API communication
 */
export class FumbleBot {
  public discordClient: FumbleBotClient | null = null
  public aiService: AIService
  public apiClient: APIClient
  public apiServer: APIServer
  public activityServer: ActivityServer | null = null

  constructor() {
    this.aiService = AIService.getInstance()
    this.apiClient = APIClient.getInstance()
    this.apiServer = new APIServer()
  }

  /**
   * Initialize all services
   */
  async initialize(): Promise<void> {
    console.log('[FumbleBot] Initializing...')

    // Load and validate configuration
    let config
    try {
      config = loadConfig()
    } catch (error) {
      console.error('[FumbleBot] Configuration error:', error)
      throw error
    }

    const errors = validateConfig(config)
    if (errors.length > 0) {
      console.error('[FumbleBot] Configuration validation failed:')
      errors.forEach((err) => console.error(`  - ${err}`))
      throw new Error('Invalid configuration')
    }

    // Initialize database
    db.initialize(config.discord.guildId)
    console.log('[FumbleBot] Database initialized')

    // Initialize AI services
    if (config.openai.apiKey) {
      this.aiService.initializeOpenAI(config.openai)
    }

    if (config.anthropic.apiKey) {
      this.aiService.initializeAnthropic(config.anthropic)
    }

    // Initialize API client
    APIClient.initialize(config.api)

    // Initialize Discord client
    this.discordClient = new FumbleBotClient(config.discord)

    console.log('[FumbleBot] Initialization complete')
  }

  /**
   * Start the bot
   */
  async start(
    apiPort = 3001,
    apiHost = '0.0.0.0',
    options: { startActivityServer?: boolean; activityPort?: number; activityPublicUrl?: string } = {}
  ): Promise<void> {
    if (!this.discordClient) {
      throw new Error('FumbleBot not initialized. Call initialize() first.')
    }

    console.log('[FumbleBot] Starting...')

    // Start API server
    await this.apiServer.start({ port: apiPort, host: apiHost })

    // Start Activity server if enabled
    if (options.startActivityServer) {
      const activityPort = options.activityPort || parseInt(process.env.FUMBLEBOT_ACTIVITY_PORT || '3000');
      const publicUrl = options.activityPublicUrl || process.env.FUMBLEBOT_ACTIVITY_PUBLIC_URL || `http://localhost:${activityPort}`;

      this.activityServer = new ActivityServer({
        port: activityPort,
        host: apiHost,
        publicUrl,
      });

      await this.activityServer.start();
      console.log('[FumbleBot] ✅ Discord Activity server started');
    }

    // Start Discord client
    await this.discordClient.start()

    // After Discord client is ready, pass it to API server for admin checks
    this.apiServer.setDiscordClient(this.discordClient)
  }

  /**
   * Stop the bot
   */
  async stop(): Promise<void> {
    console.log('[FumbleBot] Stopping...')

    // Stop Activity server
    if (this.activityServer) {
      await this.activityServer.stop()
    }

    // Stop API server
    await this.apiServer.stop()

    // Stop Discord client
    if (this.discordClient) {
      await this.discordClient.stop()
    }
  }

  /**
   * Get bot status
   */
  getStatus(): {
    discord: { ready: boolean; user: string | null }
    ai: { openai: boolean; anthropic: boolean }
    api: { connected: boolean }
  } {
    return {
      discord: {
        ready: this.discordClient?.ready ?? false,
        user: this.discordClient?.user?.tag ?? null,
      },
      ai: {
        openai: this.aiService.isProviderAvailable('openai'),
        anthropic: this.aiService.isProviderAvailable('anthropic'),
      },
      api: {
        connected: true, // Would need health check for accurate status
      },
    }
  }
}

/**
 * Quick start helper - initializes and starts the bot
 */
export async function startBot(): Promise<FumbleBot> {
  const bot = new FumbleBot()
  await bot.initialize()

  // Check if activity server should be enabled
  const activityEnabled = process.env.FUMBLEBOT_ACTIVITY_ENABLED === 'true'

  await bot.start(3001, '0.0.0.0', {
    startActivityServer: activityEnabled,
  })

  return bot
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`.replace(/\\/g, '/')) {
  console.log('╔════════════════════════════════════════╗')
  console.log('║         FumbleBot Starting...          ║')
  console.log('║     AI-Powered TTRPG Discord Bot       ║')
  console.log('╚════════════════════════════════════════╝')
  console.log('')

  startBot()
    .then((bot) => {
      const status = bot.getStatus()
      console.log('')
      console.log('[FumbleBot] Status:')
      console.log(`  Discord: ${status.discord.ready ? '✅' : '⏳'} ${status.discord.user || 'Connecting...'}`)
      console.log(`  OpenAI:  ${status.ai.openai ? '✅ Available' : '❌ Not configured'}`)
      console.log(`  Claude:  ${status.ai.anthropic ? '✅ Available' : '❌ Not configured'}`)
      console.log('')
    })
    .catch((error) => {
      console.error('[FumbleBot] Failed to start:', error)
      process.exit(1)
    })

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n[FumbleBot] Received SIGINT, shutting down...')
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    console.log('\n[FumbleBot] Received SIGTERM, shutting down...')
    process.exit(0)
  })
}
