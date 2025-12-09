/**
 * Active Character Cache
 *
 * Ephemeral cache for tracking which character is active for each user in each channel.
 * Data is lost on restart - that's OK, users can re-select their character.
 *
 * This is NOT persisted to database - Core API is the source of truth for character data.
 */

import type {
  ActiveCharacterEntry,
  ActiveCharacterKey,
  SetActiveCharacterOptions,
  GetActiveCharacterOptions,
} from './types.js';

/**
 * In-memory active character cache
 *
 * Singleton service that maintains ephemeral state for active characters.
 * Uses LRU-style expiration with 24h TTL by default.
 */
class CharacterCache {
  private static instance: CharacterCache;

  /** Cache storage: "userId_channelId" → ActiveCharacterEntry */
  private cache = new Map<string, ActiveCharacterEntry>();

  /** Default TTL: 24 hours */
  private readonly defaultTTL = 24 * 60 * 60 * 1000;

  /** Cleanup interval: Run every hour */
  private readonly cleanupInterval = 60 * 60 * 1000;

  /** Cleanup timer */
  private cleanupTimer?: NodeJS.Timeout;

  private constructor() {
    // Start cleanup timer
    this.startCleanupTimer();
  }

  static getInstance(): CharacterCache {
    if (!CharacterCache.instance) {
      CharacterCache.instance = new CharacterCache();
    }
    return CharacterCache.instance;
  }

  /**
   * Generate cache key from userId and channelId
   */
  private getCacheKey({ userId, channelId }: ActiveCharacterKey): string {
    return `${userId}_${channelId}`;
  }

  /**
   * Set active character for user in channel
   */
  set(options: SetActiveCharacterOptions): void {
    const { userId, channelId, campaignId, characterId, character, ttl } = options;

    const key = this.getCacheKey({ userId, channelId });
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (ttl || this.defaultTTL));

    const entry: ActiveCharacterEntry = {
      userId,
      channelId,
      campaignId,
      characterId,
      character,
      cachedAt: now,
      expiresAt,
    };

    this.cache.set(key, entry);
  }

  /**
   * Get active character for user in channel
   *
   * Returns null if:
   * - No active character set
   * - Entry has expired (unless refreshIfStale is false)
   */
  get(options: GetActiveCharacterOptions): ActiveCharacterEntry | null {
    const { userId, channelId, refreshIfStale = true } = options;

    const key = this.getCacheKey({ userId, channelId });
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check expiration
    const now = new Date();
    if (refreshIfStale && now > entry.expiresAt) {
      // Expired - remove from cache
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  /**
   * Clear active character for user in channel
   */
  clear({ userId, channelId }: ActiveCharacterKey): void {
    const key = this.getCacheKey({ userId, channelId });
    this.cache.delete(key);
  }

  /**
   * Clear all active characters for a user (across all channels)
   */
  clearUser(userId: string): void {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.userId === userId) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all active characters in a channel
   */
  clearChannel(channelId: string): void {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.channelId === channelId) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all active characters for a campaign
   */
  clearCampaign(campaignId: string): void {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.campaignId === campaignId) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get all active characters for a user
   */
  getUserCharacters(userId: string): ActiveCharacterEntry[] {
    const entries: ActiveCharacterEntry[] = [];

    for (const entry of this.cache.values()) {
      if (entry.userId === userId) {
        // Check not expired
        const now = new Date();
        if (now <= entry.expiresAt) {
          entries.push(entry);
        }
      }
    }

    return entries;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    total: number;
    expired: number;
    active: number;
  } {
    const now = new Date();
    let expired = 0;
    let active = 0;

    for (const entry of this.cache.values()) {
      if (now > entry.expiresAt) {
        expired++;
      } else {
        active++;
      }
    }

    return {
      total: this.cache.size,
      expired,
      active,
    };
  }

  /**
   * Start cleanup timer to remove expired entries
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  /**
   * Stop cleanup timer (for graceful shutdown)
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * Remove all expired entries from cache
   */
  cleanup(): number {
    const now = new Date();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[CharacterCache] Cleaned up ${removed} expired entries`);
    }

    return removed;
  }

  /**
   * Clear entire cache
   */
  clearAll(): void {
    this.cache.clear();
  }
}

export default CharacterCache.getInstance();
