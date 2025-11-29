/**
 * FumbleBot Discord Client
 * Main Discord.js client with full integration support
 */

import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  REST,
  Routes,
  type Interaction,
  type Message,
  ActivityType,
} from 'discord.js'
import type { DiscordConfig } from '../../models/types.js'
import { CommandRegistry } from './commands/registry.js'
import { handleInteraction } from './handlers/interaction.js'
import { handleMessage } from './handlers/message.js'

export class FumbleBotClient {
  public client: Client
  public rest: REST
  public commandRegistry: CommandRegistry
  private config: DiscordConfig
  private isReady = false

  constructor(config: DiscordConfig) {
    this.config = config
    this.commandRegistry = new CommandRegistry()

    // Initialize Discord.js client with comprehensive intents
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
      ],
      partials: [
        Partials.Channel,
        Partials.Message,
        Partials.Reaction,
        Partials.User,
        Partials.GuildMember,
      ],
    })

    // Initialize REST client for API calls
    this.rest = new REST({ version: '10' }).setToken(config.token)

    this.setupEventHandlers()
  }

  private setupEventHandlers(): void {
    // Ready event
    this.client.once(Events.ClientReady, (readyClient) => {
      console.log(`[FumbleBot] Logged in as ${readyClient.user.tag}`)
      this.isReady = true

      // Set bot presence
      readyClient.user.setPresence({
        activities: [
          {
            name: 'Crit-Fumble Gaming',
            type: ActivityType.Playing,
          },
        ],
        status: 'online',
      })
    })

    // Interaction handler (slash commands, buttons, context menus, modals)
    this.client.on(Events.InteractionCreate, async (interaction: Interaction) => {
      try {
        await handleInteraction(interaction, this)
      } catch (error) {
        console.error('[FumbleBot] Error handling interaction:', error)
      }
    })

    // Message handler (for bot mentions and DMs)
    this.client.on(Events.MessageCreate, async (message: Message) => {
      try {
        await handleMessage(message, this)
      } catch (error) {
        console.error('[FumbleBot] Error handling message:', error)
      }
    })

    // Guild member events for welcome messages
    this.client.on(Events.GuildMemberAdd, async (member) => {
      console.log(`[FumbleBot] New member joined: ${member.user.tag}`)
      // TODO: Send welcome message / assign default roles
    })

    // Error handling
    this.client.on(Events.Error, (error) => {
      console.error('[FumbleBot] Client error:', error)
    })

    this.client.on(Events.Warn, (warning) => {
      console.warn('[FumbleBot] Client warning:', warning)
    })
  }

  /**
   * Start the bot and connect to Discord
   */
  async start(): Promise<void> {
    console.log('[FumbleBot] Starting bot...')

    // Login to Discord first
    await this.client.login(this.config.token)

    // Wait for client to be ready, then register commands
    await new Promise<void>((resolve) => {
      if (this.isReady) {
        resolve()
      } else {
        this.client.once(Events.ClientReady, () => resolve())
      }
    })

    // Register commands after client is ready
    await this.registerCommands()
  }

  /**
   * Stop the bot and disconnect from Discord
   */
  async stop(): Promise<void> {
    console.log('[FumbleBot] Stopping bot...')
    this.client.destroy()
    this.isReady = false
  }

  /**
   * Register all slash commands and context menus with Discord
   */
  async registerCommands(): Promise<void> {
    const commands = this.commandRegistry.getCommandsJSON()

    console.log(`[FumbleBot] Registering ${commands.length} commands...`)

    try {
      if (this.config.guildId) {
        // Register to specific guild (faster for development)
        const guild = await this.client.guilds.fetch(this.config.guildId)

        // Get existing commands to preserve Entry Point commands
        const existingCommands = await guild.commands.fetch()
        const entryPointCommands = Array.from(existingCommands.values())
          .filter(cmd => !cmd.defaultMemberPermissions)
          .map(cmd => cmd.toJSON())

        // Get command names from our commands
        const commandNames = new Set(commands.map((cmd: any) => cmd.name))

        // Filter out Entry Point commands that have the same name as our commands
        const uniqueEntryPointCommands = entryPointCommands.filter((cmd: any) => !commandNames.has(cmd.name))

        // Combine our commands with non-duplicate Entry Point commands
        const allCommands = [...commands, ...uniqueEntryPointCommands] as any

        await guild.commands.set(allCommands)
        console.log(`[FumbleBot] Registered ${commands.length} commands to guild ${this.config.guildId}`)
      } else {
        // Register globally (takes up to an hour to propagate)
        // Get existing commands to preserve Entry Point commands
        const existingCommands = await this.client.application?.commands.fetch()
        const entryPointCommands = existingCommands
          ? Array.from(existingCommands.values())
              .filter(cmd => !cmd.defaultMemberPermissions)
              .map(cmd => cmd.toJSON())
          : []

        // Get command names from our commands
        const commandNames = new Set(commands.map((cmd: any) => cmd.name))

        // Filter out Entry Point commands that have the same name as our commands
        const uniqueEntryPointCommands = entryPointCommands.filter((cmd: any) => !commandNames.has(cmd.name))

        // Combine our commands with non-duplicate Entry Point commands
        const allCommands = [...commands, ...uniqueEntryPointCommands] as any

        await this.client.application?.commands.set(allCommands)
        console.log(`[FumbleBot] Registered ${commands.length} commands globally`)
      }
    } catch (error: any) {
      // If guild command registration fails, fall back to global registration
      if (this.config.guildId && error.code === 10004) {
        console.warn(`[FumbleBot] Guild ${this.config.guildId} not found, falling back to global registration`)
        try {
          const existingCommands = await this.client.application?.commands.fetch()
          const entryPointCommands = existingCommands
            ? Array.from(existingCommands.values())
                .filter(cmd => !cmd.defaultMemberPermissions)
                .map(cmd => cmd.toJSON())
            : []

          const commandNames = new Set(commands.map((cmd: any) => cmd.name))
          const uniqueEntryPointCommands = entryPointCommands.filter((cmd: any) => !commandNames.has(cmd.name))
          const allCommands = [...commands, ...uniqueEntryPointCommands] as any

          await this.client.application?.commands.set(allCommands)
          console.log(`[FumbleBot] Registered ${commands.length} commands globally (fallback)`)
          return
        } catch (fallbackError) {
          console.error('[FumbleBot] Failed to register commands globally:', fallbackError)
        }
      }
      console.error('[FumbleBot] Failed to register commands:', error)
      // Don't throw - let the bot continue running even if command registration fails
      console.warn('[FumbleBot] Bot will continue running but slash commands may not work')
    }
  }

  /**
   * Get the bot user
   */
  get user() {
    return this.client.user
  }

  /**
   * Check if bot is ready
   */
  get ready(): boolean {
    return this.isReady
  }
}
