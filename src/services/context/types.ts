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

// Supported TTRPG game systems
export type GameSystem =
  | '5e'           // D&D 5th Edition
  | 'pf2e'         // Pathfinder 2nd Edition
  | 'pf1e'         // Pathfinder 1st Edition
  | 'cypher'       // Cypher System (Numenera, The Strange, etc.)
  | 'bitd'         // Blades in the Dark
  | 'swn'          // Stars Without Number
  | 'mothership'   // Mothership
  | 'coc'          // Call of Cthulhu
  | 'fate'         // Fate Core/Accelerated
  | 'pbta'         // Powered by the Apocalypse
  | 'savage'       // Savage Worlds
  | 'dcc'          // Dungeon Crawl Classics
  | 'osr'          // Old School Renaissance (general)
  | 'other'        // Unknown/other system

// How the game system was determined
export type GameSystemSource = 'explicit' | 'inferred' | 'default'

// Game context for a channel - tracks what system/campaign is being discussed
export interface ChannelGameContext {
  channelId: string
  guildId: string

  // Game system context
  activeSystem: GameSystem | null          // Current game system
  systemConfidence: number                  // 0-1, how confident we are
  systemSource: GameSystemSource            // How it was determined

  // Campaign context
  campaignId: string | null                 // Link to Core campaign if any
  campaignSetting: string | null            // "Forgotten Realms", "Golarion", "Homebrew"

  // Conversation topics (rolling window of recent topics)
  recentTopics: string[]                    // ["combat", "spells", "character-creation"]

  // Timestamps
  lastActivity: Date
  lastSystemChange: Date | null
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
  // Game context per channel
  gameContextIndex: Map<string, ChannelGameContext>
  // Guild-level default game system
  defaultGameSystem: GameSystem | null
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
