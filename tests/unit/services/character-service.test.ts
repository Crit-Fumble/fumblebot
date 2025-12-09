/**
 * Character Service Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CharacterService } from '../../../src/services/character/character-service.js';
import * as dbClient from '../../../src/services/db/client.js';

// Mock Prisma
vi.mock('../../../src/services/db/client.js');

describe('CharacterService', () => {
  let service: CharacterService;
  let mockPrisma: any;

  beforeEach(() => {
    service = CharacterService.getInstance();

    mockPrisma = {
      character: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
      },
    };

    vi.mocked(dbClient.getPrisma).mockReturnValue(mockPrisma);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new character', async () => {
      const mockCharacter = {
        id: 'char-1',
        userId: 'user-123',
        guildId: 'guild-456',
        name: 'Aragorn',
        tokenUrl: 'https://example.com/aragorn.png',
        activeChannelId: null,
        activeThreadId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.character.findFirst.mockResolvedValue(null); // No existing
      mockPrisma.character.create.mockResolvedValue(mockCharacter);

      const result = await service.create('user-123', 'guild-456', {
        name: 'Aragorn',
        tokenUrl: 'https://example.com/aragorn.png',
      });

      expect(result).toEqual(mockCharacter);
      expect(mockPrisma.character.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          guildId: 'guild-456',
          name: 'Aragorn',
          tokenUrl: 'https://example.com/aragorn.png',
        },
      });
    });

    it('should reject duplicate character names', async () => {
      mockPrisma.character.findFirst.mockResolvedValue({
        id: 'existing-char',
        name: 'Aragorn',
      });

      await expect(
        service.create('user-123', 'guild-456', {
          name: 'Aragorn',
        })
      ).rejects.toThrow('You already have a character named "Aragorn" in this server');
    });

    it('should create character without token', async () => {
      const mockCharacter = {
        id: 'char-1',
        userId: 'user-123',
        guildId: 'guild-456',
        name: 'Legolas',
        tokenUrl: null,
        activeChannelId: null,
        activeThreadId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.character.findFirst.mockResolvedValue(null);
      mockPrisma.character.create.mockResolvedValue(mockCharacter);

      const result = await service.create('user-123', 'guild-456', {
        name: 'Legolas',
      });

      expect(result.tokenUrl).toBeNull();
    });
  });

  describe('getById', () => {
    it('should retrieve a character by ID', async () => {
      const mockCharacter = {
        id: 'char-1',
        userId: 'user-123',
        guildId: 'guild-456',
        name: 'Aragorn',
      };

      mockPrisma.character.findFirst.mockResolvedValue(mockCharacter);

      const result = await service.getById('char-1', 'user-123', 'guild-456');

      expect(result).toEqual(mockCharacter);
      expect(mockPrisma.character.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'char-1',
          userId: 'user-123',
          guildId: 'guild-456',
        },
      });
    });

    it('should return null for non-existent character', async () => {
      mockPrisma.character.findFirst.mockResolvedValue(null);

      const result = await service.getById('char-999', 'user-123', 'guild-456');

      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('should list all characters for a user in a guild', async () => {
      const mockCharacters = [
        { id: 'char-1', name: 'Aragorn' },
        { id: 'char-2', name: 'Legolas' },
        { id: 'char-3', name: 'Gimli' },
      ];

      mockPrisma.character.findMany.mockResolvedValue(mockCharacters);

      const result = await service.list('user-123', 'guild-456');

      expect(result).toEqual(mockCharacters);
      expect(mockPrisma.character.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          guildId: 'guild-456',
        },
        orderBy: {
          name: 'asc',
        },
      });
    });

    it('should return empty array if user has no characters', async () => {
      mockPrisma.character.findMany.mockResolvedValue([]);

      const result = await service.list('user-123', 'guild-456');

      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update character name', async () => {
      const existingChar = {
        id: 'char-1',
        userId: 'user-123',
        guildId: 'guild-456',
        name: 'Aragorn',
      };

      const updatedChar = {
        ...existingChar,
        name: 'Strider',
      };

      mockPrisma.character.findFirst
        .mockResolvedValueOnce(existingChar) // getById check
        .mockResolvedValueOnce(null); // No name conflict

      mockPrisma.character.update.mockResolvedValue(updatedChar);

      const result = await service.update('char-1', 'user-123', 'guild-456', {
        name: 'Strider',
      });

      expect(result.name).toBe('Strider');
    });

    it('should reject update if character not owned by user', async () => {
      mockPrisma.character.findFirst.mockResolvedValue(null);

      await expect(
        service.update('char-1', 'user-123', 'guild-456', {
          name: 'NewName',
        })
      ).rejects.toThrow('Character not found or you do not have permission to edit it');
    });

    it('should reject name update if new name conflicts', async () => {
      const existingChar = {
        id: 'char-1',
        userId: 'user-123',
        guildId: 'guild-456',
        name: 'Aragorn',
      };

      const conflictChar = {
        id: 'char-2',
        userId: 'user-123',
        guildId: 'guild-456',
        name: 'Legolas',
      };

      mockPrisma.character.findFirst
        .mockResolvedValueOnce(existingChar) // getById check
        .mockResolvedValueOnce(conflictChar); // Name conflict check

      await expect(
        service.update('char-1', 'user-123', 'guild-456', {
          name: 'Legolas',
        })
      ).rejects.toThrow('You already have a character named "Legolas" in this server');
    });
  });

  describe('delete', () => {
    it('should delete a character', async () => {
      const mockCharacter = {
        id: 'char-1',
        userId: 'user-123',
        guildId: 'guild-456',
        name: 'Aragorn',
      };

      mockPrisma.character.findFirst.mockResolvedValue(mockCharacter);
      mockPrisma.character.delete.mockResolvedValue(mockCharacter);

      await service.delete('char-1', 'user-123', 'guild-456');

      expect(mockPrisma.character.delete).toHaveBeenCalledWith({
        where: { id: 'char-1' },
      });
    });

    it('should reject delete if character not owned by user', async () => {
      mockPrisma.character.findFirst.mockResolvedValue(null);

      await expect(
        service.delete('char-1', 'user-123', 'guild-456')
      ).rejects.toThrow('Character not found or you do not have permission to delete it');
    });
  });

  describe('setActive', () => {
    it('should set a character as active in a channel', async () => {
      const mockCharacter = {
        id: 'char-1',
        userId: 'user-123',
        guildId: 'guild-456',
        name: 'Aragorn',
        activeChannelId: null,
        activeThreadId: null,
      };

      const activeCharacter = {
        ...mockCharacter,
        activeChannelId: 'channel-789',
        activeThreadId: null,
      };

      mockPrisma.character.findFirst.mockResolvedValue(mockCharacter);
      mockPrisma.character.updateMany.mockResolvedValue({ count: 0 }); // No other active chars
      mockPrisma.character.update.mockResolvedValue(activeCharacter);

      const result = await service.setActive(
        'char-1',
        'user-123',
        'guild-456',
        'channel-789'
      );

      expect(result.activeChannelId).toBe('channel-789');
      expect(mockPrisma.character.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          guildId: 'guild-456',
          activeChannelId: 'channel-789',
          activeThreadId: null,
          id: { not: 'char-1' },
        },
        data: {
          activeChannelId: null,
          activeThreadId: null,
        },
      });
    });

    it('should handle thread activation', async () => {
      const mockCharacter = {
        id: 'char-1',
        userId: 'user-123',
        guildId: 'guild-456',
        name: 'Aragorn',
      };

      mockPrisma.character.findFirst.mockResolvedValue(mockCharacter);
      mockPrisma.character.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.character.update.mockResolvedValue({
        ...mockCharacter,
        activeChannelId: 'channel-789',
        activeThreadId: 'thread-111',
      });

      const result = await service.setActive(
        'char-1',
        'user-123',
        'guild-456',
        'channel-789',
        'thread-111'
      );

      expect(result.activeThreadId).toBe('thread-111');
    });
  });

  describe('getActive', () => {
    it('should get active character in channel', async () => {
      const mockCharacter = {
        id: 'char-1',
        userId: 'user-123',
        guildId: 'guild-456',
        name: 'Aragorn',
        activeChannelId: 'channel-789',
        activeThreadId: null,
      };

      mockPrisma.character.findFirst.mockResolvedValue(mockCharacter);

      const result = await service.getActive('user-123', 'guild-456', 'channel-789');

      expect(result).toEqual(mockCharacter);
    });

    it('should return null if no active character', async () => {
      mockPrisma.character.findFirst.mockResolvedValue(null);

      const result = await service.getActive('user-123', 'guild-456', 'channel-789');

      expect(result).toBeNull();
    });
  });

  describe('search', () => {
    it('should search characters by name', async () => {
      const mockCharacters = [
        { id: 'char-1', name: 'Aragorn' },
        { id: 'char-2', name: 'Arwen' },
      ];

      mockPrisma.character.findMany.mockResolvedValue(mockCharacters);

      const result = await service.search('user-123', 'guild-456', 'Ar');

      expect(result).toEqual(mockCharacters);
      expect(mockPrisma.character.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          guildId: 'guild-456',
          name: {
            contains: 'Ar',
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
