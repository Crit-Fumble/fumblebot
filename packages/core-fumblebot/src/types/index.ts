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

export interface VoiceSession {
  id: string;
  guildId: string;
  channelId: string;
  userId: string;
  status: 'active' | 'paused' | 'ended';
  startedAt: Date;
  endedAt?: Date;
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
