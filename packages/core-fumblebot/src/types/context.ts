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

// =============================================================================
// Game System Types
// =============================================================================

/**
 * Supported TTRPG game systems
 * These are used for context-aware lookups and rules assistance
 */
export type GameSystem =
  | '5e'        // D&D 5th Edition
  | 'pf2e'      // Pathfinder 2nd Edition
  | 'pf1e'      // Pathfinder 1st Edition
  | 'cypher'    // Cypher System (Numenera, The Strange)
  | 'bitd'      // Blades in the Dark
  | 'swn'       // Stars Without Number
  | 'mothership' // Mothership
  | 'coc'       // Call of Cthulhu
  | 'fate'      // FATE Core
  | 'pbta'      // Powered by the Apocalypse
  | 'savage'    // Savage Worlds
  | 'dcc'       // Dungeon Crawl Classics
  | 'osr'       // Old School Renaissance
  | 'other';    // Generic/Other system

/**
 * How the game system was determined
 */
export type GameSystemSource = 'explicit' | 'inferred' | 'default';

/**
 * Per-channel game context for system detection and tracking
 */
export interface ChannelGameContext {
  /** Discord channel ID */
  channelId: string;
  /** Discord guild ID */
  guildId: string;
  /** Currently active game system */
  activeSystem: GameSystem | null;
  /** Confidence in the detected system (0-1) */
  systemConfidence: number;
  /** How the system was determined */
  systemSource: GameSystemSource;
  /** Associated campaign ID (optional) */
  campaignId: string | null;
  /** Campaign setting name (e.g., "Forgotten Realms") */
  campaignSetting: string | null;
  /** Recent conversation topics */
  recentTopics: string[];
  /** Last activity timestamp */
  lastActivity: Date;
  /** Last system change timestamp */
  lastSystemChange: Date | null;
}

/**
 * Game system detection result
 */
export interface GameSystemDetectionResult {
  /** Detected system (null if none detected) */
  system: GameSystem | null;
  /** Detection confidence (0-1) */
  confidence: number;
  /** Reason for detection */
  reason: string;
  /** Whether this was an explicit declaration */
  isExplicit: boolean;
}

/**
 * Map of game system IDs to display names
 */
export const GAME_SYSTEM_NAMES: Record<GameSystem, string> = {
  '5e': 'D&D 5th Edition',
  'pf2e': 'Pathfinder 2nd Edition',
  'pf1e': 'Pathfinder 1st Edition',
  'cypher': 'Cypher System',
  'bitd': 'Blades in the Dark',
  'swn': 'Stars Without Number',
  'mothership': 'Mothership',
  'coc': 'Call of Cthulhu',
  'fate': 'Fate Core',
  'pbta': 'Powered by the Apocalypse',
  'savage': 'Savage Worlds',
  'dcc': 'Dungeon Crawl Classics',
  'osr': 'Old School Renaissance',
  'other': 'Other System',
};

// =============================================================================
// AI Thinking/Reasoning Types
// =============================================================================

/**
 * Types of internal AI reasoning
 */
export type ThoughtType =
  | 'question'    // Internal question the AI is asking
  | 'reasoning'   // Chain of thought reasoning
  | 'lookup'      // Searching for information
  | 'decision'    // Making a choice
  | 'summary'     // Summarizing findings
  | 'filter'      // Filtering irrelevant results
  | 'context';    // Loading/interpreting context

/**
 * AI thought/reasoning entry
 */
export interface AIThought {
  /** Unique thought ID */
  id: string;
  /** Session ID grouping related thoughts */
  sessionId: string;
  /** Type of thought */
  type: ThoughtType;
  /** Thought content */
  content: string;
  /** Parent thought ID (for chains) */
  parentId?: string;
  /** Sequence number within session */
  sequence: number;
  /** Associated context */
  context: {
    guildId?: string;
    channelId?: string;
    userId?: string;
  };
  /** Additional metadata */
  options?: {
    query?: string;
    sources?: string[];
    result?: string;
    model?: string;
    tokensUsed?: number;
    durationMs?: number;
    confidence?: number;
  };
  /** When thought was created */
  createdAt: Date;
}

// =============================================================================
// Lookup Agent Types
// =============================================================================

/**
 * Types of lookups the agent can perform
 */
export type LookupType =
  | 'spell'
  | 'monster'
  | 'item'
  | 'rules'
  | 'lore'
  | 'class'
  | 'race'
  | 'feat'
  | 'condition'
  | 'general';

/**
 * Source types for lookups
 */
export type LookupSourceType = 'kb' | 'web' | 'database' | 'cache';

/**
 * Lookup request
 */
export interface LookupRequest {
  /** Search query */
  query: string;
  /** Type of lookup */
  lookupType: LookupType;
  /** Current game context */
  gameContext: Partial<ChannelGameContext>;
  /** Max results to return */
  maxResults?: number;
}

/**
 * Individual lookup result
 */
export interface LookupResult {
  /** Whether something was found */
  found: boolean;
  /** 3-4 sentence summary */
  summary: string;
  /** Link to full content */
  sourceUrl: string | null;
  /** Source type */
  sourceType: LookupSourceType;
  /** Source name (e.g., "5e.tools", "Knowledge Base") */
  sourceName: string;
  /** Result confidence (0-1) */
  confidence: number;
  /** Game system of the result */
  gameSystem: GameSystem | null;
  /** Relevance score (0-1) */
  relevanceScore: number;
}
