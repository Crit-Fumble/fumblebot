/**
 * Discord Channel Reader Service
 * Reads content from Discord channels (text, forums, threads) for knowledge base indexing
 */

import {
  type Client,
  type TextChannel,
  type ForumChannel,
  type ThreadChannel,
  type Message,
  type Collection,
  ChannelType,
  type AnyThreadChannel,
} from 'discord.js'

// =============================================================================
// Types
// =============================================================================

export interface ReadOptions {
  /** Maximum messages to fetch per channel/thread */
  maxMessages?: number
  /** Whether to prioritize pinned messages */
  includePinned?: boolean
  /** Whether to sync threads (for forums) */
  includeThreads?: boolean
  /** Only fetch messages after this date */
  after?: Date
}

export interface MessageContent {
  id: string
  content: string
  author: string
  authorId: string
  timestamp: Date
  isPinned: boolean
  attachmentUrls: string[]
  replyToId?: string
}

export interface ThreadContent {
  id: string
  name: string
  messages: MessageContent[]
  tags: string[]
  isPinned: boolean
  createdAt: Date
  archived: boolean
}

export interface ChannelContent {
  channelId: string
  channelName: string
  channelType: 'text' | 'forum' | 'thread'
  messages: MessageContent[]
  threads: ThreadContent[]
}

export interface KBDocument {
  id: string
  title: string
  content: string
  metadata: {
    channelId: string
    channelName: string
    threadId?: string
    threadName?: string
    author: string
    authorId: string
    timestamp: string
    isPinned: boolean
    tags?: string[]
    messageCount: number
  }
}

// =============================================================================
// Channel Reader Service
// =============================================================================

export class DiscordChannelReader {
  constructor(private client: Client) {}

  /**
   * Read content from a text channel
   */
  async readTextChannel(
    channelId: string,
    options: ReadOptions = {}
  ): Promise<ChannelContent> {
    const { maxMessages = 100, includePinned = true, after } = options

    const channel = await this.client.channels.fetch(channelId)
    if (!channel || channel.type !== ChannelType.GuildText) {
      throw new Error(`Channel ${channelId} is not a text channel`)
    }

    const textChannel = channel as TextChannel
    const messages: MessageContent[] = []

    // Fetch pinned messages first if requested
    if (includePinned) {
      const pinned = await textChannel.messages.fetchPinned()
      for (const msg of Array.from(pinned.values())) {
        if (!after || msg.createdAt > after) {
          messages.push(this.formatMessage(msg, true))
        }
      }
    }

    // Fetch recent messages
    const fetchOptions: { limit: number; after?: string } = {
      limit: Math.min(maxMessages, 100)
    }
    if (after) {
      // Convert date to snowflake ID for Discord API
      const snowflake = this.dateToSnowflake(after)
      fetchOptions.after = snowflake
    }

    let fetched = await textChannel.messages.fetch(fetchOptions)
    let remaining = maxMessages - messages.length

    while (fetched.size > 0 && remaining > 0) {
      for (const msg of Array.from(fetched.values())) {
        // Skip if already in pinned
        if (messages.some(m => m.id === msg.id)) continue
        // Skip bot messages
        if (msg.author.bot) continue
        // Skip empty messages
        if (!msg.content.trim() && msg.attachments.size === 0) continue

        messages.push(this.formatMessage(msg, false))
        remaining--
        if (remaining <= 0) break
      }

      // Fetch more if needed
      if (remaining > 0 && fetched.size === 100) {
        const lastId = fetched.last()?.id
        if (lastId) {
          fetched = await textChannel.messages.fetch({
            limit: Math.min(remaining, 100),
            before: lastId
          })
        } else {
          break
        }
      } else {
        break
      }
    }

    return {
      channelId,
      channelName: textChannel.name,
      channelType: 'text',
      messages,
      threads: [],
    }
  }

  /**
   * Read content from a forum channel (including all threads)
   */
  async readForumChannel(
    channelId: string,
    options: ReadOptions = {}
  ): Promise<ChannelContent> {
    const { includeThreads = true, maxMessages = 100 } = options

    const channel = await this.client.channels.fetch(channelId)
    if (!channel || channel.type !== ChannelType.GuildForum) {
      throw new Error(`Channel ${channelId} is not a forum channel`)
    }

    const forumChannel = channel as ForumChannel
    const threads: ThreadContent[] = []

    if (includeThreads) {
      // Fetch active threads
      const activeThreads = await forumChannel.threads.fetchActive()
      for (const thread of Array.from(activeThreads.threads.values())) {
        const threadContent = await this.readThread(thread.id, {
          ...options,
          maxMessages: Math.floor(maxMessages / Math.max(activeThreads.threads.size, 1)),
        })
        threads.push(this.formatThread(thread, threadContent.messages))
      }

      // Fetch archived threads (up to 100)
      try {
        const archivedThreads = await forumChannel.threads.fetchArchived({ limit: 100 })
        for (const thread of Array.from(archivedThreads.threads.values())) {
          // Skip if we have too many already
          if (threads.length >= 50) break

          const threadContent = await this.readThread(thread.id, {
            ...options,
            maxMessages: Math.floor(maxMessages / 10), // Less messages for archived
          })
          threads.push(this.formatThread(thread, threadContent.messages))
        }
      } catch (error) {
        console.warn(`[ChannelReader] Could not fetch archived threads for ${channelId}:`, error)
      }
    }

    return {
      channelId,
      channelName: forumChannel.name,
      channelType: 'forum',
      messages: [],
      threads,
    }
  }

  /**
   * Read content from a thread
   */
  async readThread(
    threadId: string,
    options: ReadOptions = {}
  ): Promise<ChannelContent> {
    const { maxMessages = 100, includePinned = true, after } = options

    const thread = await this.client.channels.fetch(threadId)
    if (!thread || !thread.isThread()) {
      throw new Error(`Channel ${threadId} is not a thread`)
    }

    const threadChannel = thread as ThreadChannel
    const messages: MessageContent[] = []

    // Get starter message if available
    try {
      const starterMessage = await threadChannel.fetchStarterMessage()
      if (starterMessage && !starterMessage.author.bot) {
        messages.push(this.formatMessage(starterMessage, true))
      }
    } catch {
      // Starter message may have been deleted
    }

    // Fetch pinned messages if requested
    if (includePinned) {
      try {
        const pinned = await threadChannel.messages.fetchPinned()
        for (const msg of Array.from(pinned.values())) {
          if (!messages.some(m => m.id === msg.id) && !msg.author.bot) {
            messages.push(this.formatMessage(msg, true))
          }
        }
      } catch {
        // Thread may not support pinned messages
      }
    }

    // Fetch messages
    const fetchOptions: { limit: number; after?: string } = {
      limit: Math.min(maxMessages, 100)
    }
    if (after) {
      fetchOptions.after = this.dateToSnowflake(after)
    }

    let fetched = await threadChannel.messages.fetch(fetchOptions)
    let remaining = maxMessages - messages.length

    while (fetched.size > 0 && remaining > 0) {
      for (const msg of Array.from(fetched.values())) {
        // Skip if already included
        if (messages.some(m => m.id === msg.id)) continue
        // Skip bot messages
        if (msg.author.bot) continue
        // Skip empty messages
        if (!msg.content.trim() && msg.attachments.size === 0) continue

        messages.push(this.formatMessage(msg, false))
        remaining--
        if (remaining <= 0) break
      }

      // Fetch more if needed
      if (remaining > 0 && fetched.size === 100) {
        const lastId = fetched.last()?.id
        if (lastId) {
          fetched = await threadChannel.messages.fetch({
            limit: Math.min(remaining, 100),
            before: lastId
          })
        } else {
          break
        }
      } else {
        break
      }
    }

    return {
      channelId: threadId,
      channelName: threadChannel.name,
      channelType: 'thread',
      messages,
      threads: [],
    }
  }

  /**
   * Format content for KB ingestion
   * Converts channel content into documents suitable for semantic search
   */
  formatForKB(content: ChannelContent, sourceName: string, category: string): KBDocument[] {
    const documents: KBDocument[] = []

    if (content.channelType === 'forum') {
      // For forums, each thread becomes a document
      for (const thread of content.threads) {
        if (thread.messages.length === 0) continue

        const combinedContent = thread.messages
          .map(m => `**${m.author}**: ${m.content}`)
          .join('\n\n')

        documents.push({
          id: `discord-${content.channelId}-thread-${thread.id}`,
          title: `${sourceName}: ${thread.name}`,
          content: combinedContent,
          metadata: {
            channelId: content.channelId,
            channelName: content.channelName,
            threadId: thread.id,
            threadName: thread.name,
            author: thread.messages[0]?.author || 'Unknown',
            authorId: thread.messages[0]?.authorId || '',
            timestamp: thread.createdAt.toISOString(),
            isPinned: thread.isPinned,
            tags: thread.tags,
            messageCount: thread.messages.length,
          },
        })
      }
    } else {
      // For text channels/threads, combine messages into a single document
      if (content.messages.length === 0) return documents

      // Group pinned messages separately
      const pinnedMessages = content.messages.filter(m => m.isPinned)
      const recentMessages = content.messages.filter(m => !m.isPinned)

      if (pinnedMessages.length > 0) {
        const pinnedContent = pinnedMessages
          .map(m => `**${m.author}**: ${m.content}`)
          .join('\n\n')

        documents.push({
          id: `discord-${content.channelId}-pinned`,
          title: `${sourceName}: Pinned Messages`,
          content: pinnedContent,
          metadata: {
            channelId: content.channelId,
            channelName: content.channelName,
            author: 'Various',
            authorId: '',
            timestamp: new Date().toISOString(),
            isPinned: true,
            messageCount: pinnedMessages.length,
          },
        })
      }

      if (recentMessages.length > 0) {
        // For recent messages, create document with summary
        const recentContent = recentMessages
          .slice(0, 50) // Limit to recent 50
          .map(m => `**${m.author}**: ${m.content}`)
          .join('\n\n')

        documents.push({
          id: `discord-${content.channelId}-recent`,
          title: `${sourceName}: Recent Discussions`,
          content: recentContent,
          metadata: {
            channelId: content.channelId,
            channelName: content.channelName,
            author: 'Various',
            authorId: '',
            timestamp: new Date().toISOString(),
            isPinned: false,
            messageCount: recentMessages.length,
          },
        })
      }
    }

    return documents
  }

  /**
   * List available channels in a guild
   */
  async listGuildChannels(guildId: string): Promise<{
    id: string
    name: string
    type: 'text' | 'forum' | 'thread'
    category?: string
  }[]> {
    const guild = await this.client.guilds.fetch(guildId)
    const channels = await guild.channels.fetch()

    const result: {
      id: string
      name: string
      type: 'text' | 'forum' | 'thread'
      category?: string
    }[] = []

    for (const channel of Array.from(channels.values())) {
      if (!channel) continue

      if (channel.type === ChannelType.GuildText) {
        result.push({
          id: channel.id,
          name: channel.name,
          type: 'text',
          category: channel.parent?.name,
        })
      } else if (channel.type === ChannelType.GuildForum) {
        result.push({
          id: channel.id,
          name: channel.name,
          type: 'forum',
          category: channel.parent?.name,
        })
      }
    }

    // Sort by category then name
    result.sort((a, b) => {
      const catA = a.category || ''
      const catB = b.category || ''
      if (catA !== catB) return catA.localeCompare(catB)
      return a.name.localeCompare(b.name)
    })

    return result
  }

  // =============================================================================
  // Private Helpers
  // =============================================================================

  private formatMessage(msg: Message, isPinned: boolean): MessageContent {
    return {
      id: msg.id,
      content: msg.content,
      author: msg.author.displayName || msg.author.username,
      authorId: msg.author.id,
      timestamp: msg.createdAt,
      isPinned,
      attachmentUrls: Array.from(msg.attachments.values()).map(a => a.url),
      replyToId: msg.reference?.messageId,
    }
  }

  private formatThread(thread: AnyThreadChannel, messages: MessageContent[]): ThreadContent {
    // Get applied tags for forum threads
    const tags: string[] = []
    if ('appliedTags' in thread && thread.appliedTags) {
      const parent = thread.parent as ForumChannel
      if (parent && 'availableTags' in parent) {
        for (const tagId of thread.appliedTags) {
          const tag = parent.availableTags.find(t => t.id === tagId)
          if (tag) tags.push(tag.name)
        }
      }
    }

    return {
      id: thread.id,
      name: thread.name,
      messages,
      tags,
      isPinned: 'flags' in thread && thread.flags.has(1 << 1), // PINNED flag
      createdAt: thread.createdAt || new Date(),
      archived: thread.archived || false,
    }
  }

  /**
   * Convert a Date to a Discord snowflake ID
   * Snowflakes encode timestamp as (ms since Discord epoch) << 22
   */
  private dateToSnowflake(date: Date): string {
    const DISCORD_EPOCH = 1420070400000 // 2015-01-01
    const timestamp = date.getTime() - DISCORD_EPOCH
    // Left shift by 22 bits and convert to string
    // Using BigInt() constructor instead of literal to avoid ES target issues
    const snowflake = BigInt(timestamp) << BigInt(22)
    return snowflake.toString()
  }
}
