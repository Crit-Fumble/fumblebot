/**
 * Context & Memory System Types
 * Hierarchical Discord structure cache for AI context
 *
 * This module provides types for FumbleBot's memory tier system:
 * - HOT: Active context, immediately available
 * - WARM: Recent messages, quick to access
 * - COLD: Summarized/archived, needs retrieval
 */

// =============================================================================
// Memory Tier Types
// =============================================================================

/** Memory tier levels for context management */
export type ContextTier = 'hot' | 'warm' | 'cold';

/** Channel types tracked in the context system */
export type TrackedChannelType = 'text' | 'voice' | 'thread' | 'forum' | 'announcement';

// =============================================================================
// Attachment & Embed Data (Cached Message Metadata)
// =============================================================================

/** Cached message attachment metadata */
export interface CachedAttachmentData {
  /** Full URL to the attachment */
  url: string;
  /** Original filename */
  filename: string;
  /** MIME content type */
  contentType: string | null;
  /** File size in bytes */
  size: number;
}

/** Cached message embed metadata */
export interface CachedEmbedData {
  /** Embed URL (if clickable) */
  url: string | null;
  /** Embed title */
  title: string | null;
  /** Embed description text */
  description: string | null;
  /** Thumbnail image URL */
  thumbnail: string | null;
}

// =============================================================================
// Context Structures
// =============================================================================

/** Discord category with its channels */
export interface CategoryContext {
  /** Discord category ID */
  categoryId: string;
  /** Guild ID this category belongs to */
  guildId: string;
  /** Category name */
  name: string;
  /** Sort position */
  position: number;
  /** Map of channel ID to channel context */
  channels: Map<string, ChannelContext>;
}

/** Discord channel context */
export interface ChannelContext {
  /** Discord channel ID */
  channelId: string;
  /** Guild ID this channel belongs to */
  guildId: string;
  /** Parent category ID (null if uncategorized) */
  categoryId: string | null;
  /** Parent channel ID (for threads) */
  parentId: string | null;
  /** Channel name */
  name: string;
  /** Channel type */
  type: TrackedChannelType;
  /** Channel topic/description */
  topic: string | null;
  /** Sort position */
  position: number;
  /** Whether this is a thread */
  isThread: boolean;
  /** Thread owner ID (if thread) */
  threadOwnerId: string | null;
  /** Recent messages in ring buffer */
  recentMessages: MessageContext[];
  /** Total message count tracked */
  messageCount: number;
}

/** Discord message context */
export interface MessageContext {
  /** Discord message ID */
  messageId: string;
  /** Guild ID */
  guildId: string;
  /** Channel ID */
  channelId: string;
  /** Thread ID (if in thread) */
  threadId: string | null;
  /** Author's Discord ID */
  authorId: string;
  /** Author's username */
  authorUsername: string;
  /** Message content */
  content: string;
  /** Attachments metadata */
  attachments: CachedAttachmentData[];
  /** Embeds metadata */
  embeds: CachedEmbedData[];
  /** ID of message being replied to */
  replyToId: string | null;
  /** When message was created */
  createdAt: Date;
  /** When message was last edited */
  editedAt: Date | null;
  /** Memory tier */
  tier: ContextTier;
  /** AI-generated summary (for cold tier) */
  summary: string | null;
}

/** User context for tracking interactions */
export interface UserContext {
  /** Discord user ID */
  discordId: string;
  /** Discord username */
  username: string;
  /** Display name (nickname) */
  displayName: string | null;
  /** Avatar URL */
  avatarUrl: string | null;
  /** Number of interactions with FumbleBot */
  interactionCount: number;
  /** Last seen timestamp */
  lastSeen: Date;
}

/** Full guild context - hierarchical structure */
export interface GuildContext {
  /** Discord guild ID */
  guildId: string;
  /** Guild name */
  guildName: string;
  /** Categories with their channels */
  categories: Map<string, CategoryContext>;
  /** Channels not in any category */
  uncategorizedChannels: Map<string, ChannelContext>;
  /** Quick channel lookup by ID */
  channelIndex: Map<string, ChannelContext>;
  /** Quick user lookup by ID */
  userIndex: Map<string, UserContext>;
  /** Last poll timestamp */
  lastPolled: Date;
  /** Whether currently polling */
  isPolling: boolean;
}

// =============================================================================
// Configuration
// =============================================================================

/** Context manager configuration */
export interface ContextManagerConfig {
  /** Polling interval in milliseconds (default: 600000 = 10 minutes) */
  pollIntervalMs: number;
  /** Max messages to keep per channel (default: 50) */
  maxMessagesPerChannel: number;
  /** Max messages in hot tier (default: 10) */
  maxHotMessages: number;
  /** Number of recent messages to keep hot (default: 5) */
  warmToHotThreshold: number;
  /** Summarize when cold exceeds this count (default: 100) */
  summarizeAfterMessages: number;
  /** Auto-start polling on initialization */
  enableAutoPolling: boolean;
}

// =============================================================================
// Navigation Types
// =============================================================================

/** Context navigation result */
export interface NavigationContext {
  /** Current channel context */
  current: ChannelContext;
  /** Parent channel (if in thread) */
  parent: ChannelContext | null;
  /** Sibling channels in same category */
  siblings: ChannelContext[];
  /** Category context */
  category: CategoryContext | null;
  /** All categories in guild */
  allCategories: CategoryContext[];
}

/** Search result with message link */
export interface MessageSearchResult {
  /** Message context */
  message: MessageContext;
  /** Direct link to message */
  link: string;
  /** Relevance score (0-1) */
  score: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate Discord message link from IDs
 * @param guildId Discord guild ID
 * @param channelId Discord channel ID
 * @param messageId Discord message ID
 * @returns Full Discord message URL
 */
export function getMessageLink(guildId: string, channelId: string, messageId: string): string {
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}

/**
 * Default context manager configuration
 */
export const DEFAULT_CONTEXT_CONFIG: ContextManagerConfig = {
  pollIntervalMs: 10 * 60 * 1000, // 10 minutes
  maxMessagesPerChannel: 50,
  maxHotMessages: 10,
  warmToHotThreshold: 5,
  summarizeAfterMessages: 100,
  enableAutoPolling: true,
};
