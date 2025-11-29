/**
 * Discord Activity Types
 *
 * TODO: When @crit-fumble/core-activity is published, replace these local
 * definitions with re-exports from the core package:
 *
 *   export * from '@crit-fumble/core-activity/types'
 *
 * The core-activity package will provide:
 * - AuthProvider, useAuth, useApiUrl (contexts)
 * - DiscordUser, DiscordContext, Guild, UserActivity (types)
 * - ADMINISTRATOR constant
 */

import type { DiscordSDK } from '@discord/embedded-app-sdk';

// Re-export from @crit-fumble/core when types are available
export type {
  DiscordUser,
  DiscordContext,
  DiscordAuth,
  DiscordChannel,
  DiscordRole,
  Guild,
  GuildSettings,
  ChannelLinks,
  BotSettings,
  Campaign,
  User,
  Character,
  GameSession,
  UserActivity,
} from '@crit-fumble/core';

export { ADMINISTRATOR } from '@crit-fumble/core';

// Local FoundrySystem type until added to @crit-fumble/core
export interface FoundrySystem {
  id: string;
  title: string;
  version?: string;
  description?: string;
  manifestUrl?: string;
}

// Local SDK state type (specific to this activity implementation)
export interface DiscordSDKState {
  sdk: DiscordSDK | null;
  auth: import('@crit-fumble/core').DiscordAuth | null;
  context: import('@crit-fumble/core').DiscordContext | null;
  isReady: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  error: Error | null;
}
