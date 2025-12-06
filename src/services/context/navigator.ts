/**
 * Context Navigator
 * Traverses the hierarchical Discord structure for AI context
 *
 * Provides methods for the AI to navigate:
 * - Current thread → parent channel → category → guild
 * - Search for messages across channels
 * - Find related discussions
 */

import { GuildContextManager } from './guild-context-manager.js'
import { MessageCacheService } from './message-cache.js'
import type {
  GuildContext,
  CategoryContext,
  ChannelContext,
  MessageContext,
} from './types.js'
import { getMessageLink } from './types.js'

// Navigation context for AI
export interface NavigationContext {
  // Current location
  currentChannelId: string
  currentChannelName: string
  currentCategoryId: string | null
  currentCategoryName: string | null

  // Immediate context (hot)
  recentMessages: MessageContext[]

  // Peer channels in same category
  peerChannels: Array<{
    channelId: string
    name: string
    type: string
    messageCount: number
  }>

  // Parent info (for threads)
  parentChannelId: string | null
  parentChannelName: string | null

  // Guild overview
  categories: Array<{
    categoryId: string
    name: string
    channelCount: number
  }>

  // Quick stats
  totalChannels: number
  totalUsers: number
}

// Search result with context
export interface SearchResult {
  message: MessageContext
  link: string
  channelName: string
  categoryName: string | null
  relevance: number
}

export class ContextNavigator {
  private static instance: ContextNavigator | null = null
  private contextManager: GuildContextManager
  private messageCache: MessageCacheService

  private constructor() {
    this.contextManager = GuildContextManager.getInstance()
    this.messageCache = MessageCacheService.getInstance()
  }

  static getInstance(): ContextNavigator {
    if (!ContextNavigator.instance) {
      ContextNavigator.instance = new ContextNavigator()
    }
    return ContextNavigator.instance
  }

  /**
   * Get navigation context for the AI from a specific channel
   */
  getNavigationContext(guildId: string, channelId: string): NavigationContext | null {
    const guild = this.contextManager.getGuildContext(guildId)
    if (!guild) return null

    const channel = guild.channelIndex.get(channelId)
    if (!channel) return null

    // Get category info
    const category = channel.categoryId
      ? guild.categories.get(channel.categoryId)
      : null

    // Get peer channels (same category)
    const peerChannels: NavigationContext['peerChannels'] = []
    if (category) {
      for (const [id, ch] of category.channels) {
        if (id !== channelId) {
          peerChannels.push({
            channelId: ch.channelId,
            name: ch.name,
            type: ch.type,
            messageCount: ch.messageCount,
          })
        }
      }
    } else {
      // Uncategorized peers
      for (const [id, ch] of guild.uncategorizedChannels) {
        if (id !== channelId) {
          peerChannels.push({
            channelId: ch.channelId,
            name: ch.name,
            type: ch.type,
            messageCount: ch.messageCount,
          })
        }
      }
    }

    // Get parent info for threads
    let parentChannel: ChannelContext | undefined
    if (channel.parentId) {
      parentChannel = guild.channelIndex.get(channel.parentId)
    }

    // Build category overview
    const categories: NavigationContext['categories'] = []
    for (const [id, cat] of guild.categories) {
      categories.push({
        categoryId: cat.categoryId,
        name: cat.name,
        channelCount: cat.channels.size,
      })
    }

    // Add uncategorized if it has channels
    if (guild.uncategorizedChannels.size > 0) {
      categories.push({
        categoryId: 'uncategorized',
        name: 'Uncategorized',
        channelCount: guild.uncategorizedChannels.size,
      })
    }

    return {
      currentChannelId: channel.channelId,
      currentChannelName: channel.name,
      currentCategoryId: category?.categoryId ?? null,
      currentCategoryName: category?.name ?? null,
      recentMessages: channel.recentMessages.slice(-10),
      peerChannels,
      parentChannelId: parentChannel?.channelId ?? null,
      parentChannelName: parentChannel?.name ?? null,
      categories,
      totalChannels: guild.channelIndex.size,
      totalUsers: guild.userIndex.size,
    }
  }

  /**
   * Get channels in a category
   */
  getCategoryChannels(guildId: string, categoryId: string): ChannelContext[] {
    const guild = this.contextManager.getGuildContext(guildId)
    if (!guild) return []

    if (categoryId === 'uncategorized') {
      return Array.from(guild.uncategorizedChannels.values())
    }

    const category = guild.categories.get(categoryId)
    if (!category) return []

    return Array.from(category.channels.values())
  }

  /**
   * Get all categories in a guild
   */
  getCategories(guildId: string): CategoryContext[] {
    const guild = this.contextManager.getGuildContext(guildId)
    if (!guild) return []

    return Array.from(guild.categories.values())
  }

  /**
   * Search messages across the guild
   */
  async searchGuild(
    guildId: string,
    query: string,
    options: {
      channelId?: string
      categoryId?: string
      authorId?: string
      limit?: number
    } = {}
  ): Promise<SearchResult[]> {
    const guild = this.contextManager.getGuildContext(guildId)
    if (!guild) return []

    // Determine which channels to search
    let channelIds: string[] = []

    if (options.channelId) {
      channelIds = [options.channelId]
    } else if (options.categoryId) {
      const channels = this.getCategoryChannels(guildId, options.categoryId)
      channelIds = channels.map(c => c.channelId)
    } else {
      channelIds = Array.from(guild.channelIndex.keys())
    }

    // Search each channel
    const results: SearchResult[] = []
    const queryLower = query.toLowerCase()

    for (const channelId of channelIds) {
      const searchResult = await this.messageCache.searchMessages({
        guildId,
        channelId,
        authorId: options.authorId,
        limit: options.limit ?? 10,
      })

      for (const msg of searchResult.messages) {
        // Simple text matching (could be enhanced with embeddings)
        if (msg.content.toLowerCase().includes(queryLower)) {
          const channel = guild.channelIndex.get(channelId)
          const category = channel?.categoryId
            ? guild.categories.get(channel.categoryId)
            : null

          results.push({
            message: msg,
            link: getMessageLink(guildId, channelId, msg.messageId),
            channelName: channel?.name ?? 'Unknown',
            categoryName: category?.name ?? null,
            relevance: this.calculateRelevance(msg, query),
          })
        }
      }
    }

    // Sort by relevance
    return results.sort((a, b) => b.relevance - a.relevance).slice(0, options.limit ?? 20)
  }

  /**
   * Find messages from a specific user
   */
  async findUserMessages(
    guildId: string,
    discordId: string,
    limit = 20
  ): Promise<SearchResult[]> {
    const guild = this.contextManager.getGuildContext(guildId)
    if (!guild) return []

    const messages = await this.messageCache.getUserMessages(discordId, guildId, limit)

    return messages.map(msg => {
      const channel = guild.channelIndex.get(msg.channelId)
      const category = channel?.categoryId
        ? guild.categories.get(channel.categoryId)
        : null

      return {
        message: msg,
        link: getMessageLink(guildId, msg.channelId, msg.messageId),
        channelName: channel?.name ?? 'Unknown',
        categoryName: category?.name ?? null,
        relevance: 1,
      }
    })
  }

  /**
   * Get context for AI prompt building
   * Returns a structured summary for inclusion in AI prompts
   */
  buildContextForAI(guildId: string, channelId: string): string {
    const nav = this.getNavigationContext(guildId, channelId)
    if (!nav) return ''

    const lines: string[] = []

    // Current location
    lines.push(`## Current Location`)
    lines.push(`Channel: #${nav.currentChannelName}`)
    if (nav.currentCategoryName) {
      lines.push(`Category: ${nav.currentCategoryName}`)
    }
    if (nav.parentChannelName) {
      lines.push(`Parent Channel: #${nav.parentChannelName} (this is a thread)`)
    }

    // Recent conversation
    if (nav.recentMessages.length > 0) {
      lines.push('')
      lines.push(`## Recent Messages (${nav.recentMessages.length})`)
      for (const msg of nav.recentMessages.slice(-5)) {
        const timestamp = msg.createdAt.toISOString().split('T')[0]
        lines.push(`[${timestamp}] ${msg.authorUsername}: ${msg.content.substring(0, 200)}`)
      }
    }

    // Peer channels
    if (nav.peerChannels.length > 0) {
      lines.push('')
      lines.push(`## Related Channels (same category)`)
      for (const ch of nav.peerChannels.slice(0, 5)) {
        lines.push(`- #${ch.name} (${ch.messageCount} messages)`)
      }
    }

    // Server overview
    lines.push('')
    lines.push(`## Server Overview`)
    lines.push(`Categories: ${nav.categories.length}`)
    lines.push(`Total Channels: ${nav.totalChannels}`)
    lines.push(`Known Users: ${nav.totalUsers}`)

    return lines.join('\n')
  }

  /**
   * Calculate relevance score for search
   */
  private calculateRelevance(message: MessageContext, query: string): number {
    const queryLower = query.toLowerCase()
    const contentLower = message.content.toLowerCase()

    let score = 0

    // Exact match bonus
    if (contentLower.includes(queryLower)) {
      score += 10
    }

    // Word match bonus
    const queryWords = queryLower.split(/\s+/)
    for (const word of queryWords) {
      if (contentLower.includes(word)) {
        score += 2
      }
    }

    // Recency bonus (newer = higher)
    const ageHours = (Date.now() - message.createdAt.getTime()) / (1000 * 60 * 60)
    if (ageHours < 24) score += 5
    else if (ageHours < 168) score += 3 // < 1 week
    else if (ageHours < 720) score += 1 // < 1 month

    // Hot tier bonus
    if (message.tier === 'hot') score += 3

    return score
  }
}
