/**
 * Character Service Tests
 *
 * Tests for the Prisma-based character service.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Prisma client
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    character: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('../db/client.js', () => ({
  getPrisma: () => mockPrisma,
}));

import { CharacterService } from './character-service.js';

describe('CharacterService', () => {
  const mockCharacter = {
    id: 'char_123',
    userId: 'user_789',
    guildId: 'guild_456',
    name: 'Gandalf',
    tokenUrl: 'https://example.com/gandalf.png',
    activeChannelId: null,
    activeThreadId: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  let service: CharacterService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = CharacterService.getInstance();
  });

  describe('create', () => {
    it('should create a new character', async () => {
      mockPrisma.character.findFirst.mockResolvedValue(null);
      mockPrisma.character.create.mockResolvedValue(mockCharacter);

      const result = await service.create('user_789', 'guild_456', {
        name: 'Gandalf',
        tokenUrl: 'https://example.com/gandalf.png',
      });

      expect(result).toEqual(mockCharacter);
      expect(mockPrisma.character.create).toHaveBeenCalledWith({
        data: {
          userId: 'user_789',
          guildId: 'guild_456',
          name: 'Gandalf',
          tokenUrl: 'https://example.com/gandalf.png',
        },
      });
    });

    it('should throw error if character name already exists', async () => {
      mockPrisma.character.findFirst.mockResolvedValue(mockCharacter);

      await expect(
        service.create('user_789', 'guild_456', { name: 'Gandalf' })
      ).rejects.toThrow('You already have a character named "Gandalf" in this server');
    });
  });

  describe('getById', () => {
    it('should return character by ID', async () => {
      mockPrisma.character.findFirst.mockResolvedValue(mockCharacter);

      const result = await service.getById('char_123', 'user_789', 'guild_456');

      expect(result).toEqual(mockCharacter);
      expect(mockPrisma.character.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'char_123',
          userId: 'user_789',
          guildId: 'guild_456',
        },
      });
    });

    it('should return null if character not found', async () => {
      mockPrisma.character.findFirst.mockResolvedValue(null);

      const result = await service.getById('nonexistent', 'user_789', 'guild_456');

      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('should list all characters for user in guild', async () => {
      const characters = [mockCharacter, { ...mockCharacter, id: 'char_456', name: 'Frodo' }];
      mockPrisma.character.findMany.mockResolvedValue(characters);

      const result = await service.list('user_789', 'guild_456');

      expect(result).toEqual(characters);
      expect(mockPrisma.character.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user_789',
          guildId: 'guild_456',
        },
        orderBy: {
          name: 'asc',
        },
      });
    });
  });

  describe('listWithActiveStatus', () => {
    it('should return characters with active status', async () => {
      const activeChar = { ...mockCharacter, activeChannelId: 'channel_1' };
      const inactiveChar = { ...mockCharacter, id: 'char_2', name: 'Frodo' };
      mockPrisma.character.findMany.mockResolvedValue([activeChar, inactiveChar]);

      const result = await service.listWithActiveStatus('user_789', 'guild_456', 'channel_1');

      expect(result).toHaveLength(2);
      expect(result[0].isActive).toBe(true);
      expect(result[1].isActive).toBe(false);
    });
  });

  describe('update', () => {
    it('should update character', async () => {
      const updatedChar = { ...mockCharacter, name: 'Gandalf the Grey' };
      mockPrisma.character.findFirst
        .mockResolvedValueOnce(mockCharacter) // getById
        .mockResolvedValueOnce(null); // conflict check
      mockPrisma.character.update.mockResolvedValue(updatedChar);

      const result = await service.update('char_123', 'user_789', 'guild_456', {
        name: 'Gandalf the Grey',
      });

      expect(result).toEqual(updatedChar);
    });

    it('should throw error if character not found', async () => {
      mockPrisma.character.findFirst.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', 'user_789', 'guild_456', { name: 'New Name' })
      ).rejects.toThrow('Character not found or you do not have permission to edit it');
    });

    it('should throw error if new name conflicts', async () => {
      mockPrisma.character.findFirst
        .mockResolvedValueOnce(mockCharacter) // getById
        .mockResolvedValueOnce({ ...mockCharacter, id: 'other_char' }); // conflict

      await expect(
        service.update('char_123', 'user_789', 'guild_456', { name: 'Existing Name' })
      ).rejects.toThrow('You already have a character named "Existing Name" in this server');
    });
  });

  describe('delete', () => {
    it('should delete character', async () => {
      mockPrisma.character.findFirst.mockResolvedValue(mockCharacter);
      mockPrisma.character.delete.mockResolvedValue(mockCharacter);

      await service.delete('char_123', 'user_789', 'guild_456');

      expect(mockPrisma.character.delete).toHaveBeenCalledWith({
        where: { id: 'char_123' },
      });
    });

    it('should throw error if character not found', async () => {
      mockPrisma.character.findFirst.mockResolvedValue(null);

      await expect(
        service.delete('nonexistent', 'user_789', 'guild_456')
      ).rejects.toThrow('Character not found or you do not have permission to delete it');
    });
  });

  describe('setActive', () => {
    it('should set character as active', async () => {
      const activeChar = { ...mockCharacter, activeChannelId: 'channel_1' };
      mockPrisma.character.findFirst.mockResolvedValue(mockCharacter);
      mockPrisma.character.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.character.update.mockResolvedValue(activeChar);

      const result = await service.setActive('char_123', 'user_789', 'guild_456', 'channel_1');

      expect(result.activeChannelId).toBe('channel_1');
      expect(mockPrisma.character.updateMany).toHaveBeenCalled();
      expect(mockPrisma.character.update).toHaveBeenCalledWith({
        where: { id: 'char_123' },
        data: {
          activeChannelId: 'channel_1',
          activeThreadId: null,
        },
      });
    });

    it('should throw error if character not found', async () => {
      mockPrisma.character.findFirst.mockResolvedValue(null);

      await expect(
        service.setActive('nonexistent', 'user_789', 'guild_456', 'channel_1')
      ).rejects.toThrow('Character not found or you do not have permission to use it');
    });
  });

  describe('getActive', () => {
    it('should return active character', async () => {
      const activeChar = { ...mockCharacter, activeChannelId: 'channel_1' };
      mockPrisma.character.findFirst.mockResolvedValue(activeChar);

      const result = await service.getActive('user_789', 'guild_456', 'channel_1');

      expect(result).toEqual(activeChar);
    });

    it('should return null if no active character', async () => {
      mockPrisma.character.findFirst.mockResolvedValue(null);

      const result = await service.getActive('user_789', 'guild_456', 'channel_1');

      expect(result).toBeNull();
    });
  });

  describe('deactivate', () => {
    it('should deactivate character', async () => {
      const deactivatedChar = { ...mockCharacter, activeChannelId: null };
      mockPrisma.character.findFirst.mockResolvedValue(mockCharacter);
      mockPrisma.character.update.mockResolvedValue(deactivatedChar);

      const result = await service.deactivate('char_123', 'user_789', 'guild_456');

      expect(result.activeChannelId).toBeNull();
    });
  });

  describe('deactivateAll', () => {
    it('should deactivate all characters in channel', async () => {
      mockPrisma.character.updateMany.mockResolvedValue({ count: 2 });

      await service.deactivateAll('user_789', 'guild_456', 'channel_1');

      expect(mockPrisma.character.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user_789',
          guildId: 'guild_456',
          activeChannelId: 'channel_1',
          activeThreadId: null,
        },
        data: {
          activeChannelId: null,
          activeThreadId: null,
        },
      });
    });
  });

  describe('search', () => {
    it('should search characters by name', async () => {
      const characters = [mockCharacter];
      mockPrisma.character.findMany.mockResolvedValue(characters);

      const result = await service.search('user_789', 'guild_456', 'Gand');

      expect(result).toEqual(characters);
      expect(mockPrisma.character.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user_789',
          guildId: 'guild_456',
          name: {
            contains: 'Gand',
            mode: 'insensitive',
          },
        },
        orderBy: {
          name: 'asc',
        },
        take: 25,
      });
    });
  });
});
