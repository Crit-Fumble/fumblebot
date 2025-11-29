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

// =============================================================================
// AI API Types (for external services like Core to call FumbleBot)
// =============================================================================

/**
 * AI Chat Request
 * General-purpose chat completion using Claude Sonnet
 */
export interface AIChatRequest {
  /** Conversation messages */
  messages: AIMessage[];
  /** Optional system prompt to prepend */
  systemPrompt?: string;
  /** Optional context (e.g., campaign info, character data) */
  context?: {
    /** Guild/server ID for prompt partial lookups */
    guildId?: string;
    /** Channel ID for prompt partial lookups */
    channelId?: string;
    /** User's Discord ID */
    userId?: string;
    /** Game system (e.g., "D&D 5e", "Pathfinder 2e") */
    gameSystem?: string;
    /** Additional context data */
    metadata?: Record<string, unknown>;
  };
  /** Generation options */
  options?: {
    maxTokens?: number;
    temperature?: number;
  };
}

export interface AIChatResponse {
  /** Generated response content */
  content: string;
  /** Model used */
  model: string;
  /** Token usage */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * AI Completion Request
 * Low-level completion with provider choice
 */
export interface AICompleteRequest {
  /** Conversation messages */
  messages: AIMessage[];
  /** System prompt */
  systemPrompt?: string;
  /** Provider to use */
  provider?: AIProvider;
  /** Model override */
  model?: string;
  /** Max tokens */
  maxTokens?: number;
  /** Temperature (0-1) */
  temperature?: number;
}

export interface AICompleteResponse extends AICompletionResult {}

/**
 * AI Lookup Request
 * Fast lookup using Claude Haiku (rules, concepts, etc.)
 */
export interface AILookupRequest {
  /** The query to look up */
  query: string;
  /** Context for the lookup (e.g., game system rules) */
  context?: string;
  /** Game system for rules lookup */
  gameSystem?: string;
  /** Max tokens for response */
  maxTokens?: number;
}

export interface AILookupResponse {
  /** The answer */
  content: string;
  /** Model used */
  model: string;
  /** Token usage */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * AI Generate NPC Request
 */
export interface AIGenerateNPCRequest {
  /** Type of NPC (e.g., "tavern keeper", "mysterious wizard") */
  type: string;
  /** Setting (e.g., "fantasy", "sci-fi", "modern") */
  setting?: string;
  /** Game system for stat compatibility */
  gameSystem?: string;
  /** Additional requirements */
  requirements?: string;
}

export interface AIGenerateNPCResponse {
  /** Generated NPC description */
  content: string;
  /** Structured NPC data if parseable */
  npc?: {
    name?: string;
    race?: string;
    occupation?: string;
    traits?: string[];
    quirk?: string;
    secret?: string;
    quote?: string;
  };
  /** Model used */
  model: string;
}

/**
 * AI Generate Dungeon Request
 */
export interface AIGenerateDungeonRequest {
  /** Theme (e.g., "undead crypt", "goblin warren") */
  theme: string;
  /** Size of dungeon */
  size: 'small' | 'medium' | 'large';
  /** Party level for encounter balancing */
  level: number;
  /** Style (e.g., "classic", "horror", "puzzle") */
  style?: string;
  /** Game system */
  gameSystem?: string;
}

export interface AIGenerateDungeonResponse {
  /** Dungeon data */
  dungeon: {
    name: string;
    description: string;
    rooms: Array<{
      id: number;
      name: string;
      description: string;
      encounters?: string[];
      treasure?: string[];
      connections: number[];
    }>;
    totalCR?: number;
  };
  /** Model used */
  model: string;
}

/**
 * AI Generate Encounter Request
 */
export interface AIGenerateEncounterRequest {
  /** Encounter type (e.g., "combat", "social", "exploration") */
  type: string;
  /** Difficulty level */
  difficulty: 'easy' | 'medium' | 'hard' | 'deadly';
  /** Party level */
  partyLevel: number;
  /** Number of party members */
  partySize: number;
  /** Environment (e.g., "forest", "dungeon", "city") */
  environment?: string;
  /** Game system */
  gameSystem?: string;
}

export interface AIGenerateEncounterResponse {
  /** Encounter data */
  encounter: {
    name: string;
    description?: string;
    enemies: Array<{
      name: string;
      count: number;
      cr?: string;
      tactics?: string;
    }>;
    terrain?: string[];
    rewards?: string[];
    adjustedXP?: number;
  };
  /** Model used */
  model: string;
}

/**
 * AI DM Response Request
 * Generate Dungeon Master narration for a scenario
 */
export interface AIDMResponseRequest {
  /** The scenario or situation to respond to */
  scenario: string;
  /** Game system */
  gameSystem?: string;
  /** Narrative tone */
  tone?: 'dramatic' | 'humorous' | 'dark' | 'epic' | 'casual';
}

export interface AIDMResponseResponse {
  /** The DM's narration */
  content: string;
  /** Suggested dice rolls if any */
  suggestedRolls?: string[];
  /** Model used */
  model: string;
}

/**
 * AI Creature Behavior Request
 * Fast AI decision for creature/NPC behavior in combat or RP
 */
export interface AICreatureBehaviorRequest {
  /** Type of creature */
  creatureType: string;
  /** Current situation description */
  situation: string;
  /** Available action options */
  options?: string[];
}

export interface AICreatureBehaviorResponse {
  /** Chosen action */
  action: string;
  /** Brief reasoning */
  reasoning: string;
  /** Model used */
  model: string;
}

/**
 * AI Generate Image Request (DALL-E)
 */
export interface AIGenerateImageRequest {
  /** Image description prompt */
  prompt: string;
  /** Image size */
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  /** Style hints */
  style?: string;
}

export interface AIGenerateImageResponse {
  /** Generated image URL */
  url: string;
  /** Revised prompt if modified */
  revisedPrompt?: string;
}
