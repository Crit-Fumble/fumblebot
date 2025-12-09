/**
 * Character Service
 * Manages user-created characters for roleplay
 *
 * NOTE: This is a temporary local implementation.
 * Will migrate to Core Character API when available.
 */

import { getPrisma } from '../db/client.js';
import type { Character } from '@prisma/fumblebot';

export interface CreateCharacterData {
  name: string;
  tokenUrl?: string;
}

export interface UpdateCharacterData {
  name?: string;
  tokenUrl?: string | null;
}

export interface CharacterWithActiveStatus extends Character {
  isActive: boolean;
}

export class CharacterService {
  private static instance: CharacterService;

  private constructor() {}

  static getInstance(): CharacterService {
    if (!CharacterService.instance) {
      CharacterService.instance = new CharacterService();
    }
    return CharacterService.instance;
  }

  /**
   * Create a new character
   */
  async create(
    userId: string,
    guildId: string,
    data: CreateCharacterData
  ): Promise<Character> {
    const prisma = getPrisma();

    // Check if character name already exists for this user in this guild
    const existing = await prisma.character.findFirst({
      where: {
        userId,
        guildId,
        name: data.name,
      },
    });

    if (existing) {
      throw new Error(`You already have a character named "${data.name}" in this server`);
    }

    return prisma.character.create({
      data: {
        userId,
        guildId,
        name: data.name,
        tokenUrl: data.tokenUrl,
      },
    });
  }

  /**
   * Get a character by ID
   */
  async getById(characterId: string, userId: string, guildId: string): Promise<Character | null> {
    const prisma = getPrisma();
    return prisma.character.findFirst({
      where: {
        id: characterId,
        userId,
        guildId,
      },
    });
  }

  /**
   * Get all characters for a user in a guild
   */
  async list(userId: string, guildId: string): Promise<Character[]> {
    const prisma = getPrisma();
    return prisma.character.findMany({
      where: {
        userId,
        guildId,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Get all characters for a user in a guild with active status
   */
  async listWithActiveStatus(
    userId: string,
    guildId: string,
    channelId?: string,
    threadId?: string
  ): Promise<CharacterWithActiveStatus[]> {
    const characters = await this.list(userId, guildId);

    return characters.map(char => ({
      ...char,
      isActive: this.isCharacterActive(char, channelId, threadId),
    }));
  }

  /**
   * Update a character
   */
  async update(
    characterId: string,
    userId: string,
    guildId: string,
    data: UpdateCharacterData
  ): Promise<Character> {
    const prisma = getPrisma();

    // Verify ownership
    const existing = await this.getById(characterId, userId, guildId);
    if (!existing) {
      throw new Error('Character not found or you do not have permission to edit it');
    }

    // If changing name, check for conflicts
    if (data.name && data.name !== existing.name) {
      const conflict = await prisma.character.findFirst({
        where: {
          userId,
          guildId,
          name: data.name,
          id: { not: characterId },
        },
      });

      if (conflict) {
        throw new Error(`You already have a character named "${data.name}" in this server`);
      }
    }

    return prisma.character.update({
      where: { id: characterId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.tokenUrl !== undefined && { tokenUrl: data.tokenUrl }),
      },
    });
  }

  /**
   * Delete a character
   */
  async delete(characterId: string, userId: string, guildId: string): Promise<void> {
    const prisma = getPrisma();

    // Verify ownership
    const existing = await this.getById(characterId, userId, guildId);
    if (!existing) {
      throw new Error('Character not found or you do not have permission to delete it');
    }

    await prisma.character.delete({
      where: { id: characterId },
    });
  }

  /**
   * Set a character as active in a channel/thread
   */
  async setActive(
    characterId: string,
    userId: string,
    guildId: string,
    channelId: string,
    threadId?: string
  ): Promise<Character> {
    const prisma = getPrisma();

    // Verify ownership
    const existing = await this.getById(characterId, userId, guildId);
    if (!existing) {
      throw new Error('Character not found or you do not have permission to use it');
    }

    // Deactivate any other characters this user has active in this channel/thread
    await prisma.character.updateMany({
      where: {
        userId,
        guildId,
        activeChannelId: channelId,
        activeThreadId: threadId || null,
        id: { not: characterId },
      },
      data: {
        activeChannelId: null,
        activeThreadId: null,
      },
    });

    // Activate this character
    return prisma.character.update({
      where: { id: characterId },
      data: {
        activeChannelId: channelId,
        activeThreadId: threadId || null,
      },
    });
  }

  /**
   * Get the active character for a user in a channel/thread
   */
  async getActive(
    userId: string,
    guildId: string,
    channelId: string,
    threadId?: string
  ): Promise<Character | null> {
    const prisma = getPrisma();

    return prisma.character.findFirst({
      where: {
        userId,
        guildId,
        activeChannelId: channelId,
        activeThreadId: threadId || null,
      },
    });
  }

  /**
   * Deactivate a character in its current channel
   */
  async deactivate(characterId: string, userId: string, guildId: string): Promise<Character> {
    const prisma = getPrisma();

    // Verify ownership
    const existing = await this.getById(characterId, userId, guildId);
    if (!existing) {
      throw new Error('Character not found or you do not have permission to modify it');
    }

    return prisma.character.update({
      where: { id: characterId },
      data: {
        activeChannelId: null,
        activeThreadId: null,
      },
    });
  }

  /**
   * Deactivate all characters for a user in a channel
   */
  async deactivateAll(
    userId: string,
    guildId: string,
    channelId: string,
    threadId?: string
  ): Promise<void> {
    const prisma = getPrisma();

    await prisma.character.updateMany({
      where: {
        userId,
        guildId,
        activeChannelId: channelId,
        activeThreadId: threadId || null,
      },
      data: {
        activeChannelId: null,
        activeThreadId: null,
      },
    });
  }

  /**
   * Check if a character is active in the given context
   */
  private isCharacterActive(
    character: Character,
    channelId?: string,
    threadId?: string
  ): boolean {
    if (!channelId) {
      // No context provided, character is active if it has any active channel
      return !!character.activeChannelId;
    }

    // Check if active in the specified channel/thread
    return (
      character.activeChannelId === channelId &&
      (threadId ? character.activeThreadId === threadId : !character.activeThreadId)
    );
  }

  /**
   * Search characters by name
   */
  async search(
    userId: string,
    guildId: string,
    query: string
  ): Promise<Character[]> {
    const prisma = getPrisma();

    return prisma.character.findMany({
      where: {
        userId,
        guildId,
        name: {
          contains: query,
          mode: 'insensitive',
        },
      },
      orderBy: {
        name: 'asc',
      },
      take: 25, // Limit for autocomplete
    });
  }
}

// Export singleton instance
export default CharacterService.getInstance();
