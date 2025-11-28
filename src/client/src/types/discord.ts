import type { DiscordSDK } from '@discord/embedded-app-sdk';

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  global_name: string | null;
}

export interface DiscordContext {
  guildId: string | null;
  channelId: string | null;
  instanceId: string;
}

export interface DiscordAuth {
  user: DiscordUser;
  access_token: string;
}

export interface DiscordSDKState {
  sdk: DiscordSDK | null;
  auth: DiscordAuth | null;
  context: DiscordContext | null;
  isReady: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  error: Error | null;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: number; // 0 = GUILD_TEXT, 2 = GUILD_VOICE
}

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
}

export interface GuildSettings {
  channelLinks: ChannelLinks;
  roleMappings: Record<string, string>;
  botSettings?: BotSettings;
}

export interface ChannelLinks {
  ic: string;
  ooc: string;
  dice: string;
  gm: string;
  announce: string;
  voice: string;
}

export interface BotSettings {
  autoLogIC: boolean;
  defaultMode: string;
  diceNotify: boolean;
  autoSession: boolean;
  reminderTime: number;
}

export interface FoundrySystem {
  id: string;
  title: string;
  version?: string;
  description?: string;
  manifestUrl?: string;
}

export interface Campaign {
  id: string;
  name: string;
  systemId: string;
  systemTitle: string;
  description?: string;
  status: 'running' | 'stopped' | 'error';
}

// Permission constants
export const ADMINISTRATOR = 0x8n;
