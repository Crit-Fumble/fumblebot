/**
 * FumbleBot Types
 * Core type definitions for the bot
 */

// =============================================================================
// Bot Configuration
// =============================================================================

export interface BotConfig {
  discord: DiscordConfig;
  openai: OpenAIConfig;
  anthropic: AnthropicConfig;
  gradient?: GradientConfig;
  api: APIConfig;
  database: DatabaseConfig;
}

export interface DatabaseConfig {
  url: string;
}

export interface GradientConfig {
  apiKey: string;
  apiUrl?: string;
  enableLLMAuditor?: boolean;
  enableGuardrails?: boolean;
  defaultModel?: string;
}

export interface DiscordConfig {
  token: string;
  clientId: string;
  clientSecret: string;
  publicKey: string;
  guildId?: string;
}

export interface OpenAIConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
}

export interface AnthropicConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
}

export interface APIConfig {
  baseUrl: string;
  botApiSecret?: string;
}

// =============================================================================
// Discord Types
// =============================================================================

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  globalName: string | null;
  bot?: boolean;
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  ownerId: string;
  memberCount: number;
}

// =============================================================================
// AI Types
// =============================================================================

export type AIProvider = 'openai' | 'anthropic';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AICompletionOptions {
  provider?: AIProvider;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface AICompletionResult {
  content: string;
  provider: AIProvider;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// =============================================================================
// Command Types
// =============================================================================

export interface CommandContext {
  userId: string;
  username: string;
  guildId?: string;
  channelId: string;
}

export interface CommandResult {
  content: string;
  ephemeral?: boolean;
  embeds?: CommandEmbed[];
}

export interface CommandEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
}

// =============================================================================
// API Types
// =============================================================================

export interface CritUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  roles: string[];
  isOwner: boolean;
  tier: string;
}

export interface UserStatusResponse {
  isLinked: boolean;
  user: CritUser | null;
  error?: string;
}

export interface WikiPage {
  id: string;
  slug: string;
  title: string;
  category: string;
  content: string;
  isPublished: boolean;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  author?: { name: string };
  lastEditor?: { name: string };
}

export interface WikiPageCreate {
  slug: string;
  title: string;
  category: string;
  content?: string;
}

export interface WikiPageUpdate {
  title?: string;
  content?: string;
  category?: string;
  isPublished?: boolean;
  changeNote?: string;
}

export interface WikiListResponse {
  pages: WikiPage[];
}

export interface BotStatusResponse {
  status: 'ok' | 'error';
  authenticated: boolean;
  discordId?: string;
  role?: 'owner' | 'admin' | 'user';
  timestamp: string;
}

// =============================================================================
// Platform Types
// =============================================================================

/**
 * Supported platforms
 */
export type Platform = 'discord' | 'web' | 'ios' | 'android' | 'unknown';

/**
 * Platform context detected from a request
 */
export interface PlatformContext {
  platform: Platform;
  isDiscordActivity: boolean;
  isMobile: boolean;
  userAgent?: string;
  origin?: string;
}

/**
 * Platform server configuration
 */
export interface PlatformServerConfig {
  port: number;
  host?: string;
  publicUrl: string; // e.g., https://fumblebot.crit-fumble.com
}

// Legacy alias for backwards compatibility
export type ActivityServerConfig = PlatformServerConfig;

/**
 * Activity Types
 * Types for platform activities (dice roller, character sheets, etc.)
 */

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

export type ActivityType =
  | 'dice-roller'
  | 'character-sheet'
  | 'map-viewer'
  | 'initiative-tracker'
  | 'spell-lookup'
  | 'custom';

export interface ActivityConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  path: string;
  maxParticipants?: number;
  requiresVoice?: boolean;
}

export interface DiceRollActivity {
  type: 'DICE_ROLL';
  userId: string;
  notation: string;
  result: number;
  rolls: number[];
  modifier: number;
  timestamp: Date;
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

export interface MapAnnotation {
  id: string;
  x: number;
  y: number;
  type: 'token' | 'marker' | 'line' | 'shape' | 'text';
  data: unknown;
  userId: string;
  timestamp: Date;
}
