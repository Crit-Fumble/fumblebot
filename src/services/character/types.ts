/**
 * Character Service Types
 *
 * FumbleBot's character system delegates to Core API for persistence.
 * This file defines types for the ephemeral active character cache.
 */

import type { Character } from '@crit-fumble/core/types/campaign';

/**
 * Active character entry in the cache
 *
 * Tracks which character is active for a user in a specific channel.
 * This is ephemeral state (lost on restart) - users can re-select.
 */
export interface ActiveCharacterEntry {
  /** User ID (Discord) */
  userId: string;

  /** Channel ID (Discord) */
  channelId: string;

  /** Campaign ID from Core */
  campaignId: string;

  /** Character ID from Core */
  characterId: string;

  /** Cached character data (for quick access) */
  character: Character;

  /** When this entry was cached */
  cachedAt: Date;

  /** When this entry expires (24h default) */
  expiresAt: Date;
}

/**
 * Cache key for active character lookup
 */
export interface ActiveCharacterKey {
  userId: string;
  channelId: string;
}

/**
 * Options for setting active character
 */
export interface SetActiveCharacterOptions {
  userId: string;
  channelId: string;
  campaignId: string;
  characterId: string;
  character: Character;
  ttl?: number; // Time to live in ms (default: 24h)
}

/**
 * Options for getting active character
 */
export interface GetActiveCharacterOptions {
  userId: string;
  channelId: string;
  refreshIfStale?: boolean; // Re-fetch from Core if expired
}

/**
 * Character service options
 */
export interface CharacterServiceOptions {
  coreApiUrl: string;
  coreSecret: string;
}
