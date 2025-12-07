/**
 * Guild Context Manager
 * Manages hierarchical Discord structure cache for AI context
 *
 * Polls Discord every N minutes to maintain:
 * - Category structure
 * - Channel/thread listings
 * - Recent messages per channel
 * - User interaction tracking
 */

import type { Client, Guild, TextChannel, ThreadChannel, CategoryChannel, ChannelType } from 'discord.js'
import { prisma } from '../db/client.js'
import type {
  GuildContext,
  CategoryContext,
  ChannelContext,
  ChannelGameContext,
  MessageContext,
  UserContext,
  ContextManagerConfig,
  TrackedChannelType,
  GameSystem,
  GameSystemSource,
} from './types.js'
import { messageToContext } from './types.js'

const DEFAULT_CONFIG: ContextManagerConfig = {
  pollIntervalMs: 10 * 60 * 1000, // 10 minutes
  maxMessagesPerChannel: 50,
  maxHotMessages: 10,
  warmToHotThreshold: 5,
  summarizeAfterMessages: 100,
  enableAutoPolling: true,
}

// Discord channel type to our type mapping
const CHANNEL_TYPE_MAP: Record<number, TrackedChannelType> = {
  0: 'text',      // GUILD_TEXT
  2: 'voice',     // GUILD_VOICE
  5: 'announcement', // GUILD_ANNOUNCEMENT
  10: 'thread',   // ANNOUNCEMENT_THREAD
  11: 'thread',   // PUBLIC_THREAD
  12: 'thread',   // PRIVATE_THREAD
  15: 'forum',    // GUILD_FORUM
}

export class GuildContextManager {
  private static instance: GuildContextManager | null = null
  private client: Client | null = null
  private config: ContextManagerConfig
  private guildContexts: Map<string, GuildContext> = new Map()
  private pollInterval: NodeJS.Timeout | null = null
  private isInitialized = false

  private constructor(config: Partial<ContextManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  static getInstance(config?: Partial<ContextManagerConfig>): GuildContextManager {
    if (!GuildContextManager.instance) {
      GuildContextManager.instance = new GuildContextManager(config)
    }
    return GuildContextManager.instance
  }

  /**
   * Initialize the context manager with a Discord client
   */
  async initialize(client: Client): Promise<void> {
    if (this.isInitialized) {
      console.log('[Context] Already initialized')
      return
    }

    this.client = client
    this.isInitialized = true

    // Load existing contexts from database
    await this.loadFromDatabase()

    // Start polling if enabled
    if (this.config.enableAutoPolling) {
      this.startPolling()
    }

    console.log('[Context] Guild context manager initialized')
  }

  /**
   * Start the polling interval
   */
  startPolling(): void {
    if (this.pollInterval) {
      console.log('[Context] Polling already running')
      return
    }

    console.log(`[Context] Starting polling every ${this.config.pollIntervalMs / 1000}s`)

    // Initial poll
    this.pollAllGuilds().catch(err => {
      console.error('[Context] Initial poll failed:', err)
    })

    // Set up interval
    this.pollInterval = setInterval(() => {
      this.pollAllGuilds().catch(err => {
        console.error('[Context] Poll failed:', err)
      })
    }, this.config.pollIntervalMs)
  }

  /**
   * Stop polling
   */
  stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
      console.log('[Context] Polling stopped')
    }
  }

  /**
   * Poll all guilds the bot is in
   */
  async pollAllGuilds(): Promise<void> {
    if (!this.client) {
      console.warn('[Context] No client available for polling')
      return
    }

    const guilds = this.client.guilds.cache
    console.log(`[Context] Polling ${guilds.size} guild(s)...`)

    for (const [guildId, guild] of guilds) {
      try {
        await this.pollGuild(guild)
      } catch (err) {
        console.error(`[Context] Failed to poll guild ${guildId}:`, err)
      }
    }
  }

  /**
   * Poll a specific guild for structure updates
   */
  async pollGuild(guild: Guild): Promise<GuildContext> {
    const startTime = Date.now()

    // Get or create context
    let context = this.guildContexts.get(guild.id)
    if (!context) {
      context = this.createEmptyContext(guild.id, guild.name)
      this.guildContexts.set(guild.id, context)
    }

    context.isPolling = true

    try {
      // Fetch all channels
      const channels = await guild.channels.fetch()

      // Process categories first
      const categories = channels.filter(c => c?.type === 4) // GUILD_CATEGORY
      for (const [id, channel] of categories) {
        if (!channel) continue
        const cat = channel as CategoryChannel
        await this.updateCategory(context, cat)
      }

      // Ensure "uncategorized" pseudo-category exists in DB
      await this.ensureUncategorizedCategory(guild.id)

      // Process other channels
      for (const [id, channel] of channels) {
        if (!channel || channel.type === 4) continue // Skip categories

        const channelType = CHANNEL_TYPE_MAP[channel.type]
        if (!channelType) continue // Skip unsupported types

        await this.updateChannel(context, channel as TextChannel, channelType)
      }

      // Fetch threads
      const threads = await guild.channels.fetchActiveThreads()
      for (const [id, thread] of threads.threads) {
        await this.updateThread(context, thread)
      }

      context.lastPolled = new Date()
      context.isPolling = false

      const elapsed = Date.now() - startTime
      console.log(`[Context] Polled ${guild.name} in ${elapsed}ms - ${context.channelIndex.size} channels`)

      return context
    } catch (err) {
      context.isPolling = false
      throw err
    }
  }

  /**
   * Get context for a guild
   */
  getGuildContext(guildId: string): GuildContext | undefined {
    return this.guildContexts.get(guildId)
  }

  /**
   * Get context for a specific channel
   */
  getChannelContext(guildId: string, channelId: string): ChannelContext | undefined {
    const guild = this.guildContexts.get(guildId)
    return guild?.channelIndex.get(channelId)
  }

  /**
   * Cache a message (call this when bot receives a message)
   */
  async cacheMessage(message: MessageContext): Promise<void> {
    const context = this.guildContexts.get(message.guildId)
    if (!context) return

    const channel = context.channelIndex.get(message.channelId)
    if (!channel) return

    // Add to recent messages (ring buffer)
    channel.recentMessages.push(message)
    if (channel.recentMessages.length > this.config.maxMessagesPerChannel) {
      const removed = channel.recentMessages.shift()
      // Could persist removed message to cold storage here
    }

    channel.messageCount++

    // Update user tracking
    await this.trackUser(context, message.authorId, message.authorUsername)

    // Persist to database
    await this.persistMessage(message)
  }

  /**
   * Get recent messages for a channel
   */
  getRecentMessages(guildId: string, channelId: string, limit = 10): MessageContext[] {
    const channel = this.getChannelContext(guildId, channelId)
    if (!channel) return []

    return channel.recentMessages.slice(-limit)
  }

  /**
   * Get hot messages (immediate context)
   */
  getHotMessages(guildId: string, channelId: string): MessageContext[] {
    const messages = this.getRecentMessages(guildId, channelId, this.config.maxHotMessages)
    return messages.map(m => ({ ...m, tier: 'hot' as const }))
  }

  // ===========================================
  // Game Context Management
  // ===========================================

  /**
   * Get the game context for a channel
   */
  getGameContext(guildId: string, channelId: string): ChannelGameContext | undefined {
    const guild = this.guildContexts.get(guildId)
    return guild?.gameContextIndex.get(channelId)
  }

  /**
   * Get or create game context for a channel
   */
  getOrCreateGameContext(guildId: string, channelId: string): ChannelGameContext {
    let context = this.guildContexts.get(guildId)
    if (!context) {
      context = this.createEmptyContext(guildId, 'Unknown')
      this.guildContexts.set(guildId, context)
    }

    let gameContext = context.gameContextIndex.get(channelId)
    if (!gameContext) {
      gameContext = this.createEmptyGameContext(guildId, channelId)
      context.gameContextIndex.set(channelId, gameContext)
    }

    return gameContext
  }

  /**
   * Set the active game system for a channel (explicit user action)
   */
  async setGameSystem(
    guildId: string,
    channelId: string,
    system: GameSystem,
    source: GameSystemSource = 'explicit'
  ): Promise<ChannelGameContext> {
    const gameContext = this.getOrCreateGameContext(guildId, channelId)

    gameContext.activeSystem = system
    gameContext.systemConfidence = source === 'explicit' ? 1.0 : 0.8
    gameContext.systemSource = source
    gameContext.lastSystemChange = new Date()
    gameContext.lastActivity = new Date()

    // Persist to database
    await this.persistGameContext(gameContext)

    console.log(`[Context] Set game system for ${channelId}: ${system} (${source})`)
    return gameContext
  }

  /**
   * Infer game system from message content (lower confidence)
   */
  async inferGameSystem(
    guildId: string,
    channelId: string,
    system: GameSystem,
    confidence: number
  ): Promise<ChannelGameContext> {
    const gameContext = this.getOrCreateGameContext(guildId, channelId)

    // Only update if we're more confident than current, or if no system set
    if (!gameContext.activeSystem || confidence > gameContext.systemConfidence) {
      gameContext.activeSystem = system
      gameContext.systemConfidence = confidence
      gameContext.systemSource = 'inferred'
      gameContext.lastSystemChange = new Date()

      await this.persistGameContext(gameContext)
      console.log(`[Context] Inferred game system for ${channelId}: ${system} (confidence: ${confidence})`)
    }

    gameContext.lastActivity = new Date()
    return gameContext
  }

  /**
   * Set campaign context for a channel
   */
  async setCampaignContext(
    guildId: string,
    channelId: string,
    campaignId: string | null,
    setting: string | null
  ): Promise<ChannelGameContext> {
    const gameContext = this.getOrCreateGameContext(guildId, channelId)

    gameContext.campaignId = campaignId
    gameContext.campaignSetting = setting
    gameContext.lastActivity = new Date()

    await this.persistGameContext(gameContext)
    console.log(`[Context] Set campaign for ${channelId}: ${setting || 'none'} (${campaignId || 'no ID'})`)

    return gameContext
  }

  /**
   * Add topics to the rolling window
   */
  addTopics(guildId: string, channelId: string, topics: string[]): ChannelGameContext {
    const gameContext = this.getOrCreateGameContext(guildId, channelId)

    // Add new topics, keeping only unique recent ones (max 10)
    const allTopics = [...gameContext.recentTopics, ...topics]
    const uniqueTopics = [...new Set(allTopics)]
    gameContext.recentTopics = uniqueTopics.slice(-10)
    gameContext.lastActivity = new Date()

    return gameContext
  }

  /**
   * Get effective game system for a channel (falls back to guild default)
   */
  getEffectiveGameSystem(guildId: string, channelId: string): { system: GameSystem | null; source: GameSystemSource } {
    const gameContext = this.getGameContext(guildId, channelId)
    if (gameContext?.activeSystem) {
      return { system: gameContext.activeSystem, source: gameContext.systemSource }
    }

    const guildContext = this.guildContexts.get(guildId)
    if (guildContext?.defaultGameSystem) {
      return { system: guildContext.defaultGameSystem, source: 'default' }
    }

    return { system: null, source: 'default' }
  }

  /**
   * Set guild-level default game system
   */
  async setGuildDefaultSystem(guildId: string, system: GameSystem | null): Promise<void> {
    let context = this.guildContexts.get(guildId)
    if (!context) {
      context = this.createEmptyContext(guildId, 'Unknown')
      this.guildContexts.set(guildId, context)
    }

    context.defaultGameSystem = system
    console.log(`[Context] Set guild ${guildId} default system: ${system || 'none'}`)

    // Persist to GuildContext table (if we have one) or GuildSettings
    // For now, we'll store this in GuildContext prisma model when we add it
  }

  // ===========================================
  // Private helpers
  // ===========================================

  private createEmptyGameContext(guildId: string, channelId: string): ChannelGameContext {
    return {
      channelId,
      guildId,
      activeSystem: null,
      systemConfidence: 0,
      systemSource: 'default',
      campaignId: null,
      campaignSetting: null,
      recentTopics: [],
      lastActivity: new Date(),
      lastSystemChange: null,
    }
  }

  private async persistGameContext(gameContext: ChannelGameContext): Promise<void> {
    await prisma.channelGameContext.upsert({
      where: {
        guildId_channelId: {
          guildId: gameContext.guildId,
          channelId: gameContext.channelId,
        },
      },
      create: {
        guildId: gameContext.guildId,
        channelId: gameContext.channelId,
        activeSystem: gameContext.activeSystem,
        systemConfidence: gameContext.systemConfidence,
        systemSource: gameContext.systemSource,
        campaignId: gameContext.campaignId,
        campaignSetting: gameContext.campaignSetting,
        recentTopics: gameContext.recentTopics,
        lastActivity: gameContext.lastActivity,
        lastSystemChange: gameContext.lastSystemChange,
      },
      update: {
        activeSystem: gameContext.activeSystem,
        systemConfidence: gameContext.systemConfidence,
        systemSource: gameContext.systemSource,
        campaignId: gameContext.campaignId,
        campaignSetting: gameContext.campaignSetting,
        recentTopics: gameContext.recentTopics,
        lastActivity: gameContext.lastActivity,
        lastSystemChange: gameContext.lastSystemChange,
      },
    })
  }

  private createEmptyContext(guildId: string, guildName: string): GuildContext {
    return {
      guildId,
      guildName,
      categories: new Map(),
      uncategorizedChannels: new Map(),
      channelIndex: new Map(),
      userIndex: new Map(),
      gameContextIndex: new Map(),
      defaultGameSystem: null,
      lastPolled: new Date(0),
      isPolling: false,
    }
  }

  private async updateCategory(context: GuildContext, category: CategoryChannel): Promise<void> {
    const categoryContext: CategoryContext = {
      categoryId: category.id,
      guildId: context.guildId,
      name: category.name,
      position: category.position,
      channels: context.categories.get(category.id)?.channels ?? new Map(),
    }

    context.categories.set(category.id, categoryContext)

    // Persist to database
    await prisma.cachedCategory.upsert({
      where: { categoryId: category.id },
      create: {
        categoryId: category.id,
        guildId: context.guildId,
        name: category.name,
        position: category.position,
      },
      update: {
        name: category.name,
        position: category.position,
        lastPolled: new Date(),
      },
    })
  }

  private async ensureUncategorizedCategory(guildId: string): Promise<void> {
    await prisma.cachedCategory.upsert({
      where: { categoryId: `${guildId}-uncategorized` },
      create: {
        categoryId: `${guildId}-uncategorized`,
        guildId,
        name: 'Uncategorized',
        position: 999,
      },
      update: {
        lastPolled: new Date(),
      },
    })
  }

  private async updateChannel(
    context: GuildContext,
    channel: TextChannel,
    type: TrackedChannelType
  ): Promise<void> {
    const existing = context.channelIndex.get(channel.id)

    const channelContext: ChannelContext = {
      channelId: channel.id,
      guildId: context.guildId,
      categoryId: channel.parentId,
      parentId: null,
      name: channel.name,
      type,
      topic: channel.topic,
      position: channel.position,
      isThread: false,
      threadOwnerId: null,
      recentMessages: existing?.recentMessages ?? [],
      messageCount: existing?.messageCount ?? 0,
    }

    // Add to appropriate category
    if (channel.parentId) {
      const category = context.categories.get(channel.parentId)
      category?.channels.set(channel.id, channelContext)
    } else {
      context.uncategorizedChannels.set(channel.id, channelContext)
    }

    // Add to index
    context.channelIndex.set(channel.id, channelContext)

    // Persist to database
    await prisma.cachedChannel.upsert({
      where: { channelId: channel.id },
      create: {
        channelId: channel.id,
        guildId: context.guildId,
        categoryId: channel.parentId,
        name: channel.name,
        type,
        topic: channel.topic,
        position: channel.position,
        isThread: false,
      },
      update: {
        categoryId: channel.parentId,
        name: channel.name,
        type,
        topic: channel.topic,
        position: channel.position,
        lastPolled: new Date(),
      },
    })
  }

  private async updateThread(context: GuildContext, thread: ThreadChannel): Promise<void> {
    const existing = context.channelIndex.get(thread.id)

    const channelContext: ChannelContext = {
      channelId: thread.id,
      guildId: context.guildId,
      categoryId: thread.parent?.parentId ?? null,
      parentId: thread.parentId,
      name: thread.name,
      type: 'thread',
      topic: null,
      position: 0,
      isThread: true,
      threadOwnerId: thread.ownerId,
      recentMessages: existing?.recentMessages ?? [],
      messageCount: existing?.messageCount ?? 0,
    }

    context.channelIndex.set(thread.id, channelContext)

    // Persist to database
    await prisma.cachedChannel.upsert({
      where: { channelId: thread.id },
      create: {
        channelId: thread.id,
        guildId: context.guildId,
        categoryId: thread.parent?.parentId ?? null,
        parentId: thread.parentId,
        name: thread.name,
        type: 'thread',
        isThread: true,
        threadOwnerId: thread.ownerId,
      },
      update: {
        name: thread.name,
        parentId: thread.parentId,
        lastPolled: new Date(),
      },
    })
  }

  private async trackUser(
    context: GuildContext,
    discordId: string,
    username: string
  ): Promise<void> {
    let user = context.userIndex.get(discordId)

    if (user) {
      user.interactionCount++
      user.lastSeen = new Date()
    } else {
      user = {
        discordId,
        username,
        displayName: null,
        avatarUrl: null,
        interactionCount: 1,
        lastSeen: new Date(),
      }
      context.userIndex.set(discordId, user)
    }

    // Persist to database
    await prisma.discordUser.upsert({
      where: { discordId },
      create: {
        discordId,
        username,
      },
      update: {
        username,
        interactionCount: { increment: 1 },
      },
    })
  }

  private async persistMessage(message: MessageContext): Promise<void> {
    // Ensure user exists first
    await prisma.discordUser.upsert({
      where: { discordId: message.authorId },
      create: {
        discordId: message.authorId,
        username: message.authorUsername,
      },
      update: {
        username: message.authorUsername,
      },
    })

    // Ensure channel exists
    await prisma.cachedChannel.upsert({
      where: { channelId: message.channelId },
      create: {
        channelId: message.channelId,
        guildId: message.guildId,
        name: 'Unknown',
        type: 'text',
      },
      update: {},
    })

    // Persist message
    await prisma.cachedMessage.upsert({
      where: { messageId: message.messageId },
      create: {
        messageId: message.messageId,
        guildId: message.guildId,
        channelId: message.channelId,
        threadId: message.threadId,
        authorId: message.authorId,
        content: message.content,
        attachments: message.attachments,
        embeds: message.embeds,
        replyToId: message.replyToId,
        createdAt: message.createdAt,
        editedAt: message.editedAt,
        tier: message.tier,
      },
      update: {
        content: message.content,
        editedAt: message.editedAt,
        attachments: message.attachments,
        embeds: message.embeds,
      },
    })
  }

  private async loadFromDatabase(): Promise<void> {
    // Load categories
    const categories = await prisma.cachedCategory.findMany()
    const channels = await prisma.cachedChannel.findMany()

    for (const cat of categories) {
      let context = this.guildContexts.get(cat.guildId)
      if (!context) {
        context = this.createEmptyContext(cat.guildId, 'Unknown')
        this.guildContexts.set(cat.guildId, context)
      }

      context.categories.set(cat.categoryId, {
        categoryId: cat.categoryId,
        guildId: cat.guildId,
        name: cat.name,
        position: cat.position,
        channels: new Map(),
      })
    }

    for (const ch of channels) {
      let context = this.guildContexts.get(ch.guildId)
      if (!context) {
        context = this.createEmptyContext(ch.guildId, 'Unknown')
        this.guildContexts.set(ch.guildId, context)
      }

      const channelContext: ChannelContext = {
        channelId: ch.channelId,
        guildId: ch.guildId,
        categoryId: ch.categoryId,
        parentId: ch.parentId,
        name: ch.name,
        type: ch.type as TrackedChannelType,
        topic: ch.topic,
        position: ch.position,
        isThread: ch.isThread,
        threadOwnerId: ch.threadOwnerId,
        recentMessages: [],
        messageCount: ch.messageCount,
      }

      context.channelIndex.set(ch.channelId, channelContext)

      if (ch.categoryId) {
        const cat = context.categories.get(ch.categoryId)
        cat?.channels.set(ch.channelId, channelContext)
      } else {
        context.uncategorizedChannels.set(ch.channelId, channelContext)
      }
    }

    // Load game contexts
    await this.loadGameContextsFromDatabase()

    console.log(`[Context] Loaded ${this.guildContexts.size} guild(s) from database`)
  }

  private async loadGameContextsFromDatabase(): Promise<void> {
    try {
      const gameContexts = await prisma.channelGameContext.findMany()

      for (const gc of gameContexts) {
        let context = this.guildContexts.get(gc.guildId)
        if (!context) {
          context = this.createEmptyContext(gc.guildId, 'Unknown')
          this.guildContexts.set(gc.guildId, context)
        }

        const gameContext: ChannelGameContext = {
          channelId: gc.channelId,
          guildId: gc.guildId,
          activeSystem: gc.activeSystem as GameSystem | null,
          systemConfidence: gc.systemConfidence,
          systemSource: gc.systemSource as GameSystemSource,
          campaignId: gc.campaignId,
          campaignSetting: gc.campaignSetting,
          recentTopics: gc.recentTopics as string[],
          lastActivity: gc.lastActivity,
          lastSystemChange: gc.lastSystemChange,
        }

        context.gameContextIndex.set(gc.channelId, gameContext)
      }

      console.log(`[Context] Loaded ${gameContexts.length} game context(s)`)
    } catch (error) {
      // Table might not exist yet if migration hasn't run
      console.log('[Context] Game context table not ready, skipping load')
    }
  }
}
