/**
 * Message Cache Service
 * Handles message storage, retrieval, and tier management
 */

import type { Message, TextChannel, ThreadChannel } from 'discord.js'
import { prisma } from '../db/client.js'
import { AIService } from '../ai/service.js'
import type {
  MessageContext,
  ContextTier,
  AttachmentData,
  EmbedData,
} from './types.js'
import { messageToContext, getMessageLink } from './types.js'

interface MessageSearchOptions {
  guildId: string
  channelId?: string
  authorId?: string
  limit?: number
  before?: Date
  after?: Date
  tier?: ContextTier
  includeContent?: boolean
}

interface MessageSearchResult {
  messages: MessageContext[]
  total: number
  hasMore: boolean
}

export class MessageCacheService {
  private static instance: MessageCacheService | null = null
  private aiService: AIService

  private constructor() {
    this.aiService = AIService.getInstance()
  }

  static getInstance(): MessageCacheService {
    if (!MessageCacheService.instance) {
      MessageCacheService.instance = new MessageCacheService()
    }
    return MessageCacheService.instance
  }

  /**
   * Cache a Discord message
   */
  async cacheMessage(message: Message): Promise<MessageContext> {
    const context = messageToContext(message)

    // Ensure user exists
    await prisma.discordUser.upsert({
      where: { discordId: message.author.id },
      create: {
        discordId: message.author.id,
        username: message.author.username,
        displayName: message.author.displayName,
        avatarUrl: message.author.displayAvatarURL(),
      },
      update: {
        username: message.author.username,
        displayName: message.author.displayName,
        avatarUrl: message.author.displayAvatarURL(),
        interactionCount: { increment: 1 },
      },
    })

    // Ensure channel exists
    await prisma.cachedChannel.upsert({
      where: { channelId: message.channelId },
      create: {
        channelId: message.channelId,
        guildId: message.guildId!,
        name: (message.channel as TextChannel).name ?? 'Unknown',
        type: message.channel.isThread() ? 'thread' : 'text',
        parentId: message.channel.isThread() ? message.channel.parentId : null,
        isThread: message.channel.isThread(),
      },
      update: {
        messageCount: { increment: 1 },
      },
    })

    // Store message
    await prisma.cachedMessage.upsert({
      where: { messageId: message.id },
      create: {
        messageId: message.id,
        guildId: message.guildId!,
        channelId: message.channelId,
        threadId: message.channel.isThread() ? message.channelId : null,
        authorId: message.author.id,
        content: message.content,
        attachments: context.attachments,
        embeds: context.embeds,
        replyToId: message.reference?.messageId ?? null,
        createdAt: message.createdAt,
        editedAt: message.editedAt,
        tier: 'warm',
      },
      update: {
        content: message.content,
        editedAt: message.editedAt,
        attachments: context.attachments,
        embeds: context.embeds,
      },
    })

    return context
  }

  /**
   * Fetch messages from Discord and cache them
   */
  async fetchAndCacheMessages(
    channel: TextChannel | ThreadChannel,
    limit = 50
  ): Promise<MessageContext[]> {
    const messages = await channel.messages.fetch({ limit })
    const contexts: MessageContext[] = []

    for (const [, message] of messages) {
      if (message.author.bot) continue // Skip bot messages by default
      const context = await this.cacheMessage(message)
      contexts.push(context)
    }

    return contexts.reverse() // Chronological order
  }

  /**
   * Search cached messages
   */
  async searchMessages(options: MessageSearchOptions): Promise<MessageSearchResult> {
    const {
      guildId,
      channelId,
      authorId,
      limit = 50,
      before,
      after,
      tier,
    } = options

    const where: any = { guildId }

    if (channelId) where.channelId = channelId
    if (authorId) where.authorId = authorId
    if (tier) where.tier = tier
    if (before) where.createdAt = { ...where.createdAt, lt: before }
    if (after) where.createdAt = { ...where.createdAt, gt: after }

    const [messages, total] = await Promise.all([
      prisma.cachedMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit + 1, // Fetch one extra to check hasMore
        include: {
          author: true,
        },
      }),
      prisma.cachedMessage.count({ where }),
    ])

    const hasMore = messages.length > limit
    const results = messages.slice(0, limit)

    return {
      messages: results.map(m => ({
        messageId: m.messageId,
        guildId: m.guildId,
        channelId: m.channelId,
        threadId: m.threadId,
        authorId: m.authorId,
        authorUsername: m.author.username,
        content: m.content,
        attachments: m.attachments as AttachmentData[],
        embeds: m.embeds as EmbedData[],
        replyToId: m.replyToId,
        createdAt: m.createdAt,
        editedAt: m.editedAt,
        tier: m.tier as ContextTier,
        summary: m.summary,
      })),
      total,
      hasMore,
    }
  }

  /**
   * Get a message by ID with its Discord link
   */
  async getMessageWithLink(messageId: string): Promise<{
    message: MessageContext | null
    link: string | null
  }> {
    const msg = await prisma.cachedMessage.findUnique({
      where: { messageId },
      include: { author: true },
    })

    if (!msg) return { message: null, link: null }

    return {
      message: {
        messageId: msg.messageId,
        guildId: msg.guildId,
        channelId: msg.channelId,
        threadId: msg.threadId,
        authorId: msg.authorId,
        authorUsername: msg.author.username,
        content: msg.content,
        attachments: msg.attachments as AttachmentData[],
        embeds: msg.embeds as EmbedData[],
        replyToId: msg.replyToId,
        createdAt: msg.createdAt,
        editedAt: msg.editedAt,
        tier: msg.tier as ContextTier,
        summary: msg.summary,
      },
      link: getMessageLink(msg.guildId, msg.channelId, msg.messageId),
    }
  }

  /**
   * Promote a message to hot tier
   */
  async promoteToHot(messageId: string): Promise<void> {
    await prisma.cachedMessage.update({
      where: { messageId },
      data: { tier: 'hot' },
    })
  }

  /**
   * Demote messages from hot to warm (call periodically)
   */
  async demoteOldHotMessages(maxAgeMinutes = 30): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000)

    const result = await prisma.cachedMessage.updateMany({
      where: {
        tier: 'hot',
        cachedAt: { lt: cutoff },
      },
      data: { tier: 'warm' },
    })

    return result.count
  }

  /**
   * Archive old messages to cold tier with AI summary
   */
  async archiveToCold(
    guildId: string,
    channelId: string,
    maxMessages = 100
  ): Promise<number> {
    // Get warm messages older than the most recent N
    const warmMessages = await prisma.cachedMessage.findMany({
      where: {
        guildId,
        channelId,
        tier: 'warm',
      },
      orderBy: { createdAt: 'desc' },
      skip: maxMessages,
      take: 50, // Process in batches
    })

    if (warmMessages.length === 0) return 0

    // Group messages for summarization
    const contentToSummarize = warmMessages
      .map(m => `[${m.authorId}]: ${m.content}`)
      .join('\n')

    // Generate summary using Haiku
    let summary: string | null = null
    try {
      const result = await this.aiService.lookup(
        `Summarize this conversation in 2-3 sentences, noting key topics and participants:\n\n${contentToSummarize}`,
        'You are a conversation summarizer. Be concise.',
        { maxTokens: 150 }
      )
      summary = result.content
    } catch (err) {
      console.error('[MessageCache] Failed to generate summary:', err)
    }

    // Update messages to cold with summary
    const messageIds = warmMessages.map(m => m.messageId)
    await prisma.cachedMessage.updateMany({
      where: { messageId: { in: messageIds } },
      data: {
        tier: 'cold',
        summary,
      },
    })

    return warmMessages.length
  }

  /**
   * Get messages by user for context
   */
  async getUserMessages(
    discordId: string,
    guildId?: string,
    limit = 20
  ): Promise<MessageContext[]> {
    const where: any = { authorId: discordId }
    if (guildId) where.guildId = guildId

    const messages = await prisma.cachedMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { author: true },
    })

    return messages.map(m => ({
      messageId: m.messageId,
      guildId: m.guildId,
      channelId: m.channelId,
      threadId: m.threadId,
      authorId: m.authorId,
      authorUsername: m.author.username,
      content: m.content,
      attachments: m.attachments as AttachmentData[],
      embeds: m.embeds as EmbedData[],
      replyToId: m.replyToId,
      createdAt: m.createdAt,
      editedAt: m.editedAt,
      tier: m.tier as ContextTier,
      summary: m.summary,
    }))
  }

  /**
   * Cleanup old cold messages
   */
  async cleanupOldMessages(maxAgeDays = 30): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000)

    const result = await prisma.cachedMessage.deleteMany({
      where: {
        tier: 'cold',
        createdAt: { lt: cutoff },
      },
    })

    return result.count
  }
}
