/**
 * Character Service Tests
 *
 * Tests for the character service that wraps Core API.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Character, Campaign } from '@crit-fumble/core/types/campaign';
import CharacterService from './character-service.js';
import characterCache from './character-cache.js';

// Mock Core API methods
const { mockCoreApi } = vi.hoisted(() => ({
  mockCoreApi: {
    campaigns: {
      list: vi.fn(),
      create: vi.fn(),
    },
    characters: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// Mock Core API Client
vi.mock('@crit-fumble/core/client', () => ({
  CoreApiClient: vi.fn().mockImplementation(function () {
    return mockCoreApi;
  }),
}));

describe('CharacterService', () => {
  const mockCampaign: Campaign = {
    id: 'camp_123',
    guildId: 'guild_456',
    name: 'Test Campaign',
    description: 'Test campaign description',
    status: 'active',
    foundrySystemId: null,
    systemTitle: null,
    worldAnvilWorldId: null,
    worldAnvilWorldName: null,
    worldAnvilWorldUrl: null,
    worldAnvilNotebookId: null,
    members: {},
    roleMappings: {},
    containerId: null,
    containerPort: null,
    containerStatus: 'stopped',
    lastActiveAt: null,
    createdBy: 'test',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockCharacter: Character = {
    id: 'char_123',
    campaignId: 'camp_123',
    name: 'Gandalf',
    type: 'pc',
    avatarUrl: 'https://example.com/gandalf.png',
    ownerId: 'user_789',
    foundryActorId: null,
    lastSyncedAt: null,
    sheetData: {},
    isActive: true,
    isRetired: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Clear cache
    characterCache.clearAll();

    // Initialize service
    CharacterService.initialize({
      coreApiUrl: 'https://core.test',
      coreSecret: 'test-secret',
    });
  });

  describe('initialization', () => {
    it('should initialize with Core API credentials', () => {
      // Service is already initialized in beforeEach
      expect(CharacterService).toBeDefined();
    });

    it('should throw error if used before initialization', () => {
      // Create a new instance to test uninitialized state
      const uninitializedService = Object.create(CharacterService);
      // @ts-expect-error - Testing private method
      uninitializedService.initialized = false;

      expect(() => {
        // @ts-expect-error - Testing private method
        uninitializedService.ensureInitialized();
      }).toThrow('CharacterService not initialized');
    });
  });

  describe('getOrCreateGuildCampaign', () => {
    it('should return existing campaign if found', async () => {
      mockCoreApi.campaigns.list.mockResolvedValue({
        campaigns: [mockCampaign],
        total: 1,
        limit: 1,
        offset: 0,
      });

      const campaign = await CharacterService.getOrCreateGuildCampaign(
        'guild_456',
        'Test Guild'
      );

      expect(campaign).toEqual(mockCampaign);
      expect(mockCoreApi.campaigns.list).toHaveBeenCalledWith({
        guildId: 'guild_456',
        limit: 1,
      });
      expect(mockCoreApi.campaigns.create).not.toHaveBeenCalled();
    });

    it('should create new campaign if none exists', async () => {
      mockCoreApi.campaigns.list.mockResolvedValue({
        campaigns: [],
        total: 0,
        limit: 1,
        offset: 0,
      });

      mockCoreApi.campaigns.create.mockResolvedValue({
        campaign: mockCampaign,
      });

      const campaign = await CharacterService.getOrCreateGuildCampaign(
        'guild_456',
        'Test Guild'
      );

      expect(campaign).toEqual(mockCampaign);
      expect(mockCoreApi.campaigns.create).toHaveBeenCalledWith({
        guildId: 'guild_456',
        name: 'Test Guild Campaign',
        description: 'Default campaign for Discord server',
        createdBy: 'fumblebot',
      });
    });
  });

  describe('listCharacters', () => {
    it('should list all characters in campaign', async () => {
      const characters = [mockCharacter, { ...mockCharacter, id: 'char_456' }];

      mockCoreApi.characters.list.mockResolvedValue({
        characters,
        total: 2,
      });

      const result = await CharacterService.listCharacters('camp_123');

      expect(result).toEqual(characters);
      expect(mockCoreApi.characters.list).toHaveBeenCalledWith('camp_123');
    });
  });

  describe('listUserCharacters', () => {
    it('should filter characters by owner', async () => {
      const char1 = { ...mockCharacter, id: 'char_1', ownerId: 'user_123' };
      const char2 = { ...mockCharacter, id: 'char_2', ownerId: 'user_456' };
      const char3 = { ...mockCharacter, id: 'char_3', ownerId: 'user_123' };

      mockCoreApi.characters.list.mockResolvedValue({
        characters: [char1, char2, char3],
        total: 3,
      });

      const result = await CharacterService.listUserCharacters('camp_123', 'user_123');

      expect(result).toHaveLength(2);
      expect(result.map((c) => c.id)).toEqual(['char_1', 'char_3']);
    });
  });

  describe('getCharacter', () => {
    it('should get character by ID', async () => {
      mockCoreApi.characters.get.mockResolvedValue({
        character: mockCharacter,
      });

      const result = await CharacterService.getCharacter('camp_123', 'char_123');

      expect(result).toEqual(mockCharacter);
      expect(mockCoreApi.characters.get).toHaveBeenCalledWith('camp_123', 'char_123');
    });

    it('should return null for 404 errors', async () => {
      const error = new Error('Not found');
      // @ts-expect-error - Adding status property
      error.status = 404;

      mockCoreApi.characters.get.mockRejectedValue(error);

      const result = await CharacterService.getCharacter('camp_123', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should throw for other errors', async () => {
      const error = new Error('Server error');
      // @ts-expect-error - Adding status property
      error.status = 500;

      mockCoreApi.characters.get.mockRejectedValue(error);

      await expect(
        CharacterService.getCharacter('camp_123', 'char_123')
      ).rejects.toThrow('Server error');
    });
  });

  describe('createCharacter', () => {
    it('should create character with minimal data', async () => {
      mockCoreApi.characters.create.mockResolvedValue({
        character: mockCharacter,
      });

      const result = await CharacterService.createCharacter('camp_123', {
        name: 'Gandalf',
        ownerId: 'user_789',
      });

      expect(result).toEqual(mockCharacter);
      expect(mockCoreApi.characters.create).toHaveBeenCalledWith('camp_123', {
        name: 'Gandalf',
        type: 'pc',
        avatarUrl: null,
        ownerId: 'user_789',
        sheetData: {},
      });
    });

    it('should create character with full data', async () => {
      mockCoreApi.characters.create.mockResolvedValue({
        character: mockCharacter,
      });

      const result = await CharacterService.createCharacter('camp_123', {
        name: 'Gandalf',
        type: 'npc',
        avatarUrl: 'https://example.com/avatar.png',
        ownerId: 'user_789',
        sheetData: { level: 20 },
      });

      expect(result).toEqual(mockCharacter);
      expect(mockCoreApi.characters.create).toHaveBeenCalledWith('camp_123', {
        name: 'Gandalf',
        type: 'npc',
        avatarUrl: 'https://example.com/avatar.png',
        ownerId: 'user_789',
        sheetData: { level: 20 },
      });
    });
  });

  describe('updateCharacter', () => {
    it('should update character', async () => {
      const updatedCharacter = { ...mockCharacter, name: 'Gandalf the Grey' };

      mockCoreApi.characters.update.mockResolvedValue({
        character: updatedCharacter,
      });

      const result = await CharacterService.updateCharacter('camp_123', 'char_123', {
        name: 'Gandalf the Grey',
      });

      expect(result).toEqual(updatedCharacter);
      expect(mockCoreApi.characters.update).toHaveBeenCalledWith(
        'camp_123',
        'char_123',
        { name: 'Gandalf the Grey' }
      );
    });

    it('should clear cache for campaign after update', async () => {
      mockCoreApi.characters.update.mockResolvedValue({
        character: mockCharacter,
      });

      // Set cache entry
      characterCache.set({
        userId: 'user_123',
        channelId: 'channel_456',
        campaignId: 'camp_123',
        characterId: 'char_123',
        character: mockCharacter,
      });

      await CharacterService.updateCharacter('camp_123', 'char_123', {
        name: 'Updated',
      });

      // Cache should be cleared
      const cached = characterCache.get({
        userId: 'user_123',
        channelId: 'channel_456',
      });

      expect(cached).toBeNull();
    });
  });

  describe('deleteCharacter', () => {
    it('should delete character', async () => {
      mockCoreApi.characters.delete.mockResolvedValue({
        success: true,
        deletedId: 'char_123',
      });

      await CharacterService.deleteCharacter('camp_123', 'char_123');

      expect(mockCoreApi.characters.delete).toHaveBeenCalledWith('camp_123', 'char_123');
    });

    it('should clear cache for campaign after delete', async () => {
      mockCoreApi.characters.delete.mockResolvedValue({
        success: true,
        deletedId: 'char_123',
      });

      // Set cache entry
      characterCache.set({
        userId: 'user_123',
        channelId: 'channel_456',
        campaignId: 'camp_123',
        characterId: 'char_123',
        character: mockCharacter,
      });

      await CharacterService.deleteCharacter('camp_123', 'char_123');

      // Cache should be cleared
      const cached = characterCache.get({
        userId: 'user_123',
        channelId: 'channel_456',
      });

      expect(cached).toBeNull();
    });
  });

  describe('setActiveCharacter', () => {
    it('should set active character and cache it', async () => {
      mockCoreApi.characters.get.mockResolvedValue({
        character: mockCharacter,
      });

      const result = await CharacterService.setActiveCharacter(
        'user_789',
        'channel_456',
        'camp_123',
        'char_123'
      );

      expect(result).toEqual(mockCharacter);

      const cached = characterCache.get({
        userId: 'user_789',
        channelId: 'channel_456',
      });

      expect(cached?.characterId).toBe('char_123');
      expect(cached?.character).toEqual(mockCharacter);
    });

    it('should throw if character not found', async () => {
      mockCoreApi.characters.get.mockResolvedValue({
        character: null,
      });

      await expect(
        CharacterService.setActiveCharacter(
          'user_789',
          'channel_456',
          'camp_123',
          'nonexistent'
        )
      ).rejects.toThrow('Character nonexistent not found');
    });

    it('should throw if user is not owner', async () => {
      mockCoreApi.characters.get.mockResolvedValue({
        character: mockCharacter,
      });

      await expect(
        CharacterService.setActiveCharacter(
          'wrong_user',
          'channel_456',
          'camp_123',
          'char_123'
        )
      ).rejects.toThrow('Character char_123 is owned by user_789, not wrong_user');
    });
  });

  describe('getActiveCharacter', () => {
    it('should get active character from cache', () => {
      characterCache.set({
        userId: 'user_123',
        channelId: 'channel_456',
        campaignId: 'camp_123',
        characterId: 'char_123',
        character: mockCharacter,
      });

      const result = CharacterService.getActiveCharacter('user_123', 'channel_456');

      expect(result).toEqual(mockCharacter);
    });

    it('should return null if no active character', () => {
      const result = CharacterService.getActiveCharacter('user_123', 'channel_456');

      expect(result).toBeNull();
    });
  });

  describe('getActiveCharacterEntry', () => {
    it('should get active character entry with campaign ID', () => {
      characterCache.set({
        userId: 'user_123',
        channelId: 'channel_456',
        campaignId: 'camp_123',
        characterId: 'char_123',
        character: mockCharacter,
      });

      const result = CharacterService.getActiveCharacterEntry('user_123', 'channel_456');

      expect(result).toEqual({
        campaignId: 'camp_123',
        character: mockCharacter,
      });
    });

    it('should return null if no active character', () => {
      const result = CharacterService.getActiveCharacterEntry('user_123', 'channel_456');

      expect(result).toBeNull();
    });
  });

  describe('clearActiveCharacter', () => {
    it('should clear active character from cache', () => {
      characterCache.set({
        userId: 'user_123',
        channelId: 'channel_456',
        campaignId: 'camp_123',
        characterId: 'char_123',
        character: mockCharacter,
      });

      CharacterService.clearActiveCharacter('user_123', 'channel_456');

      const cached = characterCache.get({
        userId: 'user_123',
        channelId: 'channel_456',
      });

      expect(cached).toBeNull();
    });
  });

  describe('cache statistics', () => {
    it('should get cache stats', () => {
      characterCache.set({
        userId: 'user_123',
        channelId: 'channel_456',
        campaignId: 'camp_123',
        characterId: 'char_123',
        character: mockCharacter,
      });

      const stats = CharacterService.getCacheStats();

      expect(stats.total).toBe(1);
      expect(stats.active).toBe(1);
    });

    it('should cleanup cache', () => {
      const removed = CharacterService.cleanupCache();

      expect(typeof removed).toBe('number');
    });
  });
});
