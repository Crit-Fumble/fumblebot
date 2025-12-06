/**
 * Context System Types
 */

import type { Message, TextChannel, ThreadChannel, ForumChannel, CategoryChannel } from 'discord.js'

// Memory tier levels
export type ContextTier = 'hot' | 'warm' | 'cold'

// Channel types we track
export type TrackedChannelType = 'text' | 'voice' | 'thread' | 'forum' | 'announcement'

// Attachment metadata
export interface AttachmentData {
  url: string
  filename: string
  contentType: string | null
  size: number
}

// Embed metadata
export interface EmbedData {
  url: string | null
  title: string | null
  description: string | null
  thumbnail: string | null
}

// In-memory category structure
export interface CategoryContext {
  categoryId: string
  guildId: string
  name: string
  position: number
  channels: Map<string, ChannelContext>
}

// In-memory channel structure
export interface ChannelContext {
  channelId: string
  guildId: string
  categoryId: string | null
  parentId: string | null
  name: string
  type: TrackedChannelType
  topic: string | null
  position: number
  isThread: boolean
  threadOwnerId: string | null
  // Recent messages (ring buffer)
  recentMessages: MessageContext[]
  messageCount: number
}

// In-memory message structure
export interface MessageContext {
  messageId: string
  guildId: string
  channelId: string
  threadId: string | null
  authorId: string
  authorUsername: string
  content: string
  attachments: AttachmentData[]
  embeds: EmbedData[]
  replyToId: string | null
  createdAt: Date
  editedAt: Date | null
  tier: ContextTier
  summary: string | null
}

// User tracking
export interface UserContext {
  discordId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  interactionCount: number
  lastSeen: Date
}

// Guild context - the full hierarchical structure
export interface GuildContext {
  guildId: string
  guildName: string
  categories: Map<string, CategoryContext>
  // Uncategorized channels (null category)
  uncategorizedChannels: Map<string, ChannelContext>
  // Quick lookup maps
  channelIndex: Map<string, ChannelContext>
  userIndex: Map<string, UserContext>
  // Polling metadata
  lastPolled: Date
  isPolling: boolean
}

// Config for the context manager
export interface ContextManagerConfig {
  pollIntervalMs: number           // Default: 10 minutes
  maxMessagesPerChannel: number    // Default: 50
  maxHotMessages: number           // Messages in immediate context
  warmToHotThreshold: number       // How many recent messages are "hot"
  summarizeAfterMessages: number   // Summarize when cold exceeds this
  enableAutoPolling: boolean       // Auto-start polling on init
}

// Helper to generate Discord message links
export function getMessageLink(guildId: string, channelId: string, messageId: string): string {
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`
}

// Convert Discord.js Message to MessageContext
export function messageToContext(message: Message): MessageContext {
  const attachments: AttachmentData[] = message.attachments.map(a => ({
    url: a.url,
    filename: a.name,
    contentType: a.contentType,
    size: a.size,
  }))

  const embeds: EmbedData[] = message.embeds.map(e => ({
    url: e.url,
    title: e.title,
    description: e.description,
    thumbnail: e.thumbnail?.url ?? null,
  }))

  return {
    messageId: message.id,
    guildId: message.guildId!,
    channelId: message.channelId,
    threadId: message.thread?.id ?? null,
    authorId: message.author.id,
    authorUsername: message.author.username,
    content: message.content,
    attachments,
    embeds,
    replyToId: message.reference?.messageId ?? null,
    createdAt: message.createdAt,
    editedAt: message.editedAt,
    tier: 'warm',
    summary: null,
  }
}
