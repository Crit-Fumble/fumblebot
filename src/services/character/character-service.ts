/**
 * Character Service
 *
 * High-level service for character management that integrates:
 * - Core API (source of truth for character data)
 * - Active character cache (ephemeral Discord state)
 * - Campaign association
 *
 * This service is FumbleBot's interface to Core's character system.
 */

import { CoreApiClient } from '@crit-fumble/core/client';
import type { Character, Campaign } from '@crit-fumble/core/types/campaign';
import type { CharacterServiceOptions } from './types.js';
import characterCache from './character-cache.js';

/**
 * Character service
 *
 * Provides high-level character operations for Discord commands.
 * Delegates persistence to Core API, uses cache for active character state.
 */
class CharacterService {
  private static instance: CharacterService;
  private coreApi!: CoreApiClient;
  private initialized = false;

  private constructor() {
    // Singleton - use getInstance()
  }

  static getInstance(): CharacterService {
    if (!CharacterService.instance) {
      CharacterService.instance = new CharacterService();
    }
    return CharacterService.instance;
  }

  /**
   * Initialize the service with Core API credentials
   */
  initialize(options: CharacterServiceOptions): void {
    if (this.initialized) {
      console.warn('[CharacterService] Already initialized, skipping');
      return;
    }

    this.coreApi = new CoreApiClient({
      baseUrl: options.coreApiUrl,
      serviceSecret: options.coreSecret,
    });

    this.initialized = true;
    console.log('[CharacterService] Initialized with Core API');
  }

  /**
   * Ensure service is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('CharacterService not initialized. Call initialize() first.');
    }
  }

  /**
   * Get or create a campaign for a guild
   *
   * For now, we use one campaign per guild. In the future, we may support
   * multiple campaigns per guild with /campaign select.
   */
  async getOrCreateGuildCampaign(guildId: string, guildName: string): Promise<Campaign> {
    this.ensureInitialized();

    // Try to find existing campaign for guild
    const { campaigns } = await this.coreApi.campaigns.list({
      guildId,
      limit: 1,
    });

    if (campaigns.length > 0) {
      return campaigns[0];
    }

    // Create default campaign for guild
    const { campaign } = await this.coreApi.campaigns.create({
      guildId,
      name: `${guildName} Campaign`,
      description: 'Default campaign for Discord server',
      createdBy: 'fumblebot',
    });

    console.log(`[CharacterService] Created campaign ${campaign.id} for guild ${guildId}`);
    return campaign;
  }

  /**
   * List all characters in a campaign
   */
  async listCharacters(campaignId: string): Promise<Character[]> {
    this.ensureInitialized();

    const { characters } = await this.coreApi.characters.list(campaignId);
    return characters;
  }

  /**
   * List characters owned by a specific user
   */
  async listUserCharacters(campaignId: string, ownerId: string): Promise<Character[]> {
    this.ensureInitialized();

    const allCharacters = await this.listCharacters(campaignId);
    return allCharacters.filter((char) => char.ownerId === ownerId);
  }

  /**
   * Get a specific character
   */
  async getCharacter(campaignId: string, characterId: string): Promise<Character | null> {
    this.ensureInitialized();

    try {
      const { character } = await this.coreApi.characters.get(campaignId, characterId);
      return character;
    } catch (error) {
      // 404 = character not found
      if (error instanceof Error && 'status' in error && (error as {status: number}).status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create a new character
   */
  async createCharacter(
    campaignId: string,
    data: {
      name: string;
      type?: 'pc' | 'npc' | 'familiar' | 'companion' | 'monster';
      avatarUrl?: string;
      ownerId: string;
      sheetData?: Record<string, unknown>;
    }
  ): Promise<Character> {
    this.ensureInitialized();

    const { character } = await this.coreApi.characters.create(campaignId, {
      name: data.name,
      type: data.type || 'pc',
      avatarUrl: data.avatarUrl || null,
      ownerId: data.ownerId,
      sheetData: data.sheetData || {},
    });

    console.log(`[CharacterService] Created character ${character.id}: ${character.name}`);
    return character;
  }

  /**
   * Update a character
   */
  async updateCharacter(
    campaignId: string,
    characterId: string,
    updates: {
      name?: string;
      avatarUrl?: string;
      type?: 'pc' | 'npc' | 'familiar' | 'companion' | 'monster';
      sheetData?: Record<string, unknown>;
      isActive?: boolean;
      isRetired?: boolean;
    }
  ): Promise<Character> {
    this.ensureInitialized();

    const { character } = await this.coreApi.characters.update(campaignId, characterId, updates);

    // Invalidate cache entries for this character
    characterCache.clearCampaign(campaignId);

    console.log(`[CharacterService] Updated character ${characterId}`);
    return character;
  }

  /**
   * Delete a character
   */
  async deleteCharacter(campaignId: string, characterId: string): Promise<void> {
    this.ensureInitialized();

    await this.coreApi.characters.delete(campaignId, characterId);

    // Clear from cache
    characterCache.clearCampaign(campaignId);

    console.log(`[CharacterService] Deleted character ${characterId}`);
  }

  /**
   * Set active character for user in channel
   */
  async setActiveCharacter(
    userId: string,
    channelId: string,
    campaignId: string,
    characterId: string
  ): Promise<Character> {
    this.ensureInitialized();

    // Fetch character from Core
    const character = await this.getCharacter(campaignId, characterId);

    if (!character) {
      throw new Error(`Character ${characterId} not found in campaign ${campaignId}`);
    }

    // Verify ownership
    if (character.ownerId !== userId) {
      throw new Error(`Character ${characterId} is owned by ${character.ownerId}, not ${userId}`);
    }

    // Cache as active
    characterCache.set({
      userId,
      channelId,
      campaignId,
      characterId,
      character,
    });

    console.log(`[CharacterService] Set active character for ${userId} in ${channelId}: ${character.name}`);
    return character;
  }

  /**
   * Get active character for user in channel
   *
   * Returns null if no active character or if it has expired.
   */
  getActiveCharacter(userId: string, channelId: string): Character | null {
    const entry = characterCache.get({ userId, channelId });
    return entry ? entry.character : null;
  }

  /**
   * Get active character entry (includes campaign ID)
   */
  getActiveCharacterEntry(
    userId: string,
    channelId: string
  ): { campaignId: string; character: Character } | null {
    const entry = characterCache.get({ userId, channelId });
    return entry
      ? {
          campaignId: entry.campaignId,
          character: entry.character,
        }
      : null;
  }

  /**
   * Clear active character for user in channel
   */
  clearActiveCharacter(userId: string, channelId: string): void {
    characterCache.clear({ userId, channelId });
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return characterCache.getStats();
  }

  /**
   * Cleanup expired cache entries
   */
  cleanupCache(): number {
    return characterCache.cleanup();
  }
}

export default CharacterService.getInstance();
