/**
 * @crit-fumble/core-fumblebot Types
 * Type definitions for FumbleBot SDK
 */

// =============================================================================
// Platform Types
// =============================================================================

export type Platform = 'discord' | 'web' | 'roll20' | 'dndbeyond' | 'foundry' | 'api';

export interface PlatformContext {
  platform: Platform;
  isDiscordActivity: boolean;
  isMobile: boolean;
  userAgent?: string;
}

// =============================================================================
// User Types
// =============================================================================

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  globalName: string | null;
  bot?: boolean;
}

export interface CritUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  roles: string[];
  isOwner: boolean;
  tier: string;
}

// =============================================================================
// Command Types
// =============================================================================

export interface CommandContext {
  userId: string;
  username: string;
  guildId?: string;
  channelId?: string;
  platform: Platform;
  sessionId?: string;
}

export interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface EmbedData {
  title?: string;
  description?: string;
  color?: number;
  fields?: EmbedField[];
  footer?: { text: string };
  timestamp?: string;
  thumbnail?: { url: string };
  image?: { url: string };
}

export interface CommandResult {
  success: boolean;
  message?: string;
  embed?: EmbedData;
  data?: Record<string, unknown>;
  ephemeral?: boolean;
}

// =============================================================================
// Dice Roll Types
// =============================================================================

export interface DiceRollResult {
  notation: string;
  rolls: number[];
  modifier: number;
  total: number;
  isCrit: boolean;
  isFumble: boolean;
  label?: string;
}

export interface DiceRollRequest {
  notation: string;
  label?: string;
  context?: CommandContext;
}

// =============================================================================
// AI Types
// =============================================================================

export type AIProvider = 'openai' | 'anthropic';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIChatRequest {
  messages: AIMessage[];
  systemPrompt?: string;
  context?: {
    guildId?: string;
    channelId?: string;
    userId?: string;
    gameSystem?: string;
    campaignId?: string;
    sessionId?: string;
    metadata?: Record<string, unknown>;
  };
  options?: {
    maxTokens?: number;
    temperature?: number;
  };
}

export interface AIChatResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AILookupRequest {
  query: string;
  context?: string;
  gameSystem?: string;
  maxTokens?: number;
}

export interface AILookupResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// =============================================================================
// Generator Types
// =============================================================================

export interface AIGenerateNPCRequest {
  type: string;
  setting?: string;
  gameSystem?: string;
  requirements?: string;
}

export interface AIGenerateNPCResponse {
  content: string;
  npc?: {
    name?: string;
    race?: string;
    occupation?: string;
    traits?: string[];
    quirk?: string;
    secret?: string;
    quote?: string;
  };
  model: string;
}

export interface AIGenerateDungeonRequest {
  theme: string;
  size: 'small' | 'medium' | 'large';
  level: number;
  style?: string;
  gameSystem?: string;
}

export interface AIGenerateEncounterRequest {
  terrain: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'deadly';
  partyLevel: number;
  partySize: number;
  gameSystem?: string;
}

export interface AIGenerateImageRequest {
  prompt: string;
  style?: 'fantasy' | 'realistic' | 'cartoon' | 'portrait';
  size?: '1024x1024' | '1024x1792' | '1792x1024';
}

export interface AIGenerateImageResponse {
  url: string;
  revisedPrompt: string;
}

// =============================================================================
// Activity Types
// =============================================================================

export type ActivityType =
  | 'dice-roller'
  | 'character-sheet'
  | 'map-viewer'
  | 'initiative-tracker'
  | 'spell-lookup'
  | 'custom';

export interface ActivitySession {
  id: string;
  guildId: string;
  channelId: string;
  userId: string;
  activityType: ActivityType;
  state: unknown;
  participants: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface InitiativeEntry {
  id: string;
  name: string;
  initiative: number;
  hp?: number;
  maxHp?: number;
  ac?: number;
  conditions?: string[];
  isPlayer: boolean;
}

// =============================================================================
// Voice Types
// =============================================================================

export type VoiceMode = 'transcribe' | 'assistant';

export interface VoiceSession {
  id: string;
  guildId: string;
  channelId: string;
  userId: string;
  status: 'active' | 'paused' | 'ended';
  mode?: VoiceMode;
  startedAt: Date;
  endedAt?: Date;
}

export interface VoiceStatus {
  guildId: string;
  connected: boolean;
  channelId: string | null;
  listening: boolean;
  mode: VoiceMode | null;
  startedBy: string | null;
}

export interface VoiceSessionInfo {
  guildId: string;
  channelId: string;
  listening: boolean;
  mode: VoiceMode | null;
  startedBy: string | null;
}

export interface TranscriptionEntry {
  userId: string;
  username: string;
  text: string;
  timestamp: number;
  isCommand: boolean;
}

export interface SessionTranscript {
  guildId: string;
  channelId: string;
  channelName: string;
  startTime: number;
  endTime?: number;
  entries: TranscriptionEntry[];
  lastPostedIndex: number;
}

export interface VoiceCommand {
  type: 'transcribe' | 'assistant' | 'end';
  text?: string;
  userId: string;
  timestamp: Date;
}

// =============================================================================
// VTT Integration Types (for Browser Extension)
// =============================================================================

export type VTTPlatform = 'roll20' | 'dndbeyond' | 'foundry';

export interface VTTAccount {
  id: string;
  userId: string;
  platform: VTTPlatform;
  platformUserId: string;
  platformUsername: string;
  verified: boolean;
  linkedAt: Date;
}

export interface VTTGameLink {
  id: string;
  platform: VTTPlatform;
  gameId: string;
  gameName?: string;
  guildId: string;
  channelId: string;
  campaignId?: string;
  syncChat: boolean;
  syncRolls: boolean;
  createdBy: string;
  createdAt: Date;
}

// =============================================================================
// API Response Types
// =============================================================================

export interface APIError {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// =============================================================================
// Web Fetch Types
// =============================================================================

/** Site types supported by web fetch */
export type WebFetchSiteType = '5etools' | 'dndbeyond' | 'foundryvtt' | 'cypher' | 'general';

/** Request to fetch content from an external URL */
export interface WebFetchRequest {
  /** Full URL to fetch (must be from allowed domains) */
  url: string;
  /** Optional query to focus the extraction on */
  query?: string;
  /** Site type hint for better parsing */
  siteType?: WebFetchSiteType;
}

/** Response from web fetch operation */
export interface WebFetchResponse {
  /** Whether the fetch was successful */
  success: boolean;
  /** Extracted/summarized content */
  content: string;
  /** Original title of the page */
  title?: string;
  /** Source URL for attribution */
  source?: string;
  /** Error message if fetch failed */
  error?: string;
  /** Whether content was served from cache */
  cached?: boolean;
}

/** Request to search 5e.tools */
export interface WebSearch5eToolsRequest {
  /** Search query (e.g., "fireball", "goblin") */
  query: string;
  /** Category to search in */
  category?: 'spells' | 'items' | 'bestiary' | 'classes' | 'races' | 'feats' | 'backgrounds' | 'conditions' | 'rules';
}

/** Allowed domains for web fetch */
export const WEB_FETCH_ALLOWED_DOMAINS = [
  '5e.tools',
  'dndbeyond.com',
  'foundryvtt.com/kb/',
  'callmepartario.github.io',
] as const;

// =============================================================================
// Adventure Terminal Types
// =============================================================================

/** Container/terminal status */
export type TerminalStatus = 'running' | 'stopped' | 'error' | 'starting';

/** Request to start an adventure terminal */
export interface TerminalStartRequest {
  /** Discord guild ID */
  guildId: string;
  /** Discord channel ID */
  channelId: string;
  /** User who started the terminal */
  userId?: string;
  /** Username for terminal prompt */
  userName?: string;
}

/** Response from starting a terminal */
export interface TerminalStartResponse {
  /** Unique container ID */
  containerId: string;
  /** Container status */
  status: TerminalStatus;
  /** Port the container is running on (internal) */
  port: number;
  /** When the container was created */
  createdAt: string;
  /** WebSocket URL for direct terminal connection */
  wsUrl?: string;
}

/** Request to stop a terminal */
export interface TerminalStopRequest {
  /** Discord guild ID */
  guildId: string;
  /** Discord channel ID */
  channelId: string;
}

/** Response from stopping a terminal */
export interface TerminalStopResponse {
  /** Whether stop was successful */
  success: boolean;
  /** Status message */
  message?: string;
}

/** Response from terminal status check */
export interface TerminalStatusResponse {
  /** Whether terminal exists */
  exists: boolean;
  /** Container ID if exists */
  containerId?: string;
  /** Container status */
  status?: TerminalStatus;
  /** Port if running */
  port?: number;
  /** When the container was created */
  createdAt?: string;
  /** Container uptime in seconds */
  uptime?: number;
}

/** Request to execute a command in the terminal */
export interface TerminalExecRequest {
  /** Discord guild ID */
  guildId: string;
  /** Discord channel ID */
  channelId: string;
  /** Command to execute */
  command: string;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Working directory override */
  cwd?: string;
}

/** Response from executing a command */
export interface TerminalExecResponse {
  /** Whether execution was successful */
  success: boolean;
  /** Standard output */
  stdout: string;
  /** Standard error output */
  stderr: string;
  /** Exit code */
  exitCode: number;
  /** Execution time in milliseconds */
  executionTime?: number;
}

/** Terminal session info for listing */
export interface TerminalSessionInfo {
  /** Container ID */
  containerId: string;
  /** Guild ID */
  guildId: string;
  /** Channel ID */
  channelId: string;
  /** Status */
  status: TerminalStatus;
  /** Creation time */
  createdAt: string;
  /** Uptime in seconds */
  uptime: number;
}
