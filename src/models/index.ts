/**
 * Models Module
 * Re-exports all model types
 */

// Bot Configuration
export type {
  BotConfig,
  DatabaseConfig,
  GradientConfig,
  DiscordConfig,
  OpenAIConfig,
  AnthropicConfig,
  APIConfig,
} from './types.js';

// Discord Types
export type { DiscordUser, DiscordGuild } from './types.js';

// AI Types
export type {
  AIProvider,
  AIMessage,
  AICompletionOptions,
  AICompletionResult,
} from './types.js';

// Command Types
export type { CommandContext, CommandResult, CommandEmbed } from './types.js';

// API Types
export type {
  CritUser,
  UserStatusResponse,
  WikiPage,
  WikiPageCreate,
  WikiPageUpdate,
  WikiListResponse,
  BotStatusResponse,
} from './types.js';

// Platform Types
export type {
  Platform,
  PlatformContext,
  PlatformServerConfig,
  ActivityServerConfig,
  ActivitySession,
  ActivityType,
  ActivityConfig,
  DiceRollActivity,
  InitiativeEntry,
  MapAnnotation,
} from './types.js';
