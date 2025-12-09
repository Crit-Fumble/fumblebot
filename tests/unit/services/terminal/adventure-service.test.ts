/**
 * Adventure Service Tests
 * Tests for MUD-style text adventure session management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  Adventure,
  AdventureMessage,
  AdventureSummary,
} from '@crit-fumble/core';

// Mock the core client before importing adventure service
const mockAdventureClient = {
  create: vi.fn(),
  get: vi.fn(),
  getByChannel: vi.fn(),
  list: vi.fn(),
  join: vi.fn(),
  leave: vi.fn(),
  sendAction: vi.fn(),
  sendNarrative: vi.fn(),
  getHistory: vi.fn(),
  end: vi.fn(),
};

vi.mock('../../../../src/lib/core-client.js', () => ({
  getCoreClient: () => ({
    adventure: mockAdventureClient,
  }),
}));

// Import after mocking
import { AdventureService } from '../../../../src/services/terminal/adventure-service.js';

describe('Adventure Service', () => {
  let service: AdventureService;

  beforeEach(() => {
    service = AdventureService.getInstance();
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new adventure session', async () => {
      const mockAdventure: Adventure = {
        id: 'adv-123',
        guildId: 'guild1',
        channelId: 'channel1',
        name: 'Test Quest',
        description: 'A test adventure',
        status: 'waiting',
        players: [],
        playerCount: 0,
        createdAt: new Date().toISOString(),
      };

      mockAdventureClient.create.mockResolvedValue({
        success: true,
        adventure: mockAdventure,
      });

      const result = await service.create('guild1', 'channel1', 'Test Quest', 'A test adventure');

      expect(result.id).toBe('adv-123');
      expect(result.name).toBe('Test Quest');
      expect(result.status).toBe('waiting');
      expect(mockAdventureClient.create).toHaveBeenCalledWith({
        guildId: 'guild1',
        channelId: 'channel1',
        name: 'Test Quest',
        description: 'A test adventure',
      });
    });

    it('should create adventure without description', async () => {
      const mockAdventure: Adventure = {
        id: 'adv-124',
        guildId: 'guild1',
        channelId: 'channel2',
        name: 'Simple Quest',
        status: 'waiting',
        players: [],
        playerCount: 0,
        createdAt: new Date().toISOString(),
      };

      mockAdventureClient.create.mockResolvedValue({
        success: true,
        adventure: mockAdventure,
      });

      const result = await service.create('guild1', 'channel2', 'Simple Quest');

      expect(result.name).toBe('Simple Quest');
      expect(result.description).toBeUndefined();
    });
  });

  describe('get', () => {
    it('should get adventure by ID', async () => {
      const mockAdventure: Adventure = {
        id: 'adv-123',
        guildId: 'guild1',
        channelId: 'channel1',
        name: 'Test Quest',
        status: 'active',
        players: [{ playerId: 'user1', playerName: 'Player1', role: 'player', joinedAt: new Date().toISOString() }],
        playerCount: 1,
        createdAt: new Date().toISOString(),
      };

      mockAdventureClient.get.mockResolvedValue({
        adventure: mockAdventure,
      });

      const result = await service.get('adv-123');

      expect(result.id).toBe('adv-123');
      expect(result.status).toBe('active');
      expect(mockAdventureClient.get).toHaveBeenCalledWith('adv-123');
    });
  });

  describe('getByChannel', () => {
    it('should get adventure by channel', async () => {
      const mockAdventure: Adventure = {
        id: 'adv-123',
        guildId: 'guild1',
        channelId: 'channel1',
        name: 'Test Quest',
        status: 'active',
        players: [],
        playerCount: 0,
        createdAt: new Date().toISOString(),
      };

      mockAdventureClient.getByChannel.mockResolvedValue({
        adventure: mockAdventure,
      });

      const result = await service.getByChannel('guild1', 'channel1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('adv-123');
      expect(mockAdventureClient.getByChannel).toHaveBeenCalledWith('guild1', 'channel1');
    });

    it('should return null when no adventure exists (404)', async () => {
      const error = new Error('Not found');
      (error as any).status = 404;
      mockAdventureClient.getByChannel.mockRejectedValue(error);

      const result = await service.getByChannel('guild1', 'no-adventure');

      expect(result).toBeNull();
    });

    it('should throw for other errors', async () => {
      const error = new Error('Server error');
      (error as any).status = 500;
      mockAdventureClient.getByChannel.mockRejectedValue(error);

      await expect(service.getByChannel('guild1', 'channel1')).rejects.toThrow('Server error');
    });
  });

  describe('list', () => {
    it('should list all adventures', async () => {
      const mockAdventures: AdventureSummary[] = [
        { id: 'adv-1', name: 'Quest 1', status: 'active', playerCount: 2 },
        { id: 'adv-2', name: 'Quest 2', status: 'waiting', playerCount: 1 },
      ];

      mockAdventureClient.list.mockResolvedValue({
        adventures: mockAdventures,
      });

      const result = await service.list();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Quest 1');
      expect(result[1].name).toBe('Quest 2');
    });

    it('should return empty array when no adventures', async () => {
      mockAdventureClient.list.mockResolvedValue({
        adventures: [],
      });

      const result = await service.list();

      expect(result).toHaveLength(0);
    });
  });

  describe('join', () => {
    it('should join an adventure as player', async () => {
      mockAdventureClient.join.mockResolvedValue({
        success: true,
        adventure: {
          id: 'adv-123',
          status: 'active',
          playerCount: 2,
        },
      });

      const result = await service.join('adv-123', 'user1', 'Player1');

      expect(result.success).toBe(true);
      expect(result.playerCount).toBe(2);
      expect(mockAdventureClient.join).toHaveBeenCalledWith('adv-123', {
        playerId: 'user1',
        playerName: 'Player1',
        role: 'player',
      });
    });

    it('should join an adventure as DM', async () => {
      mockAdventureClient.join.mockResolvedValue({
        success: true,
        adventure: {
          id: 'adv-123',
          status: 'active',
          playerCount: 1,
        },
      });

      const result = await service.join('adv-123', 'dm1', 'DungeonMaster', 'dm');

      expect(result.success).toBe(true);
      expect(mockAdventureClient.join).toHaveBeenCalledWith('adv-123', {
        playerId: 'dm1',
        playerName: 'DungeonMaster',
        role: 'dm',
      });
    });
  });

  describe('leave', () => {
    it('should leave an adventure', async () => {
      mockAdventureClient.leave.mockResolvedValue({
        success: true,
      });

      const result = await service.leave('adv-123', 'user1', 'Player1');

      expect(result).toBe(true);
      expect(mockAdventureClient.leave).toHaveBeenCalledWith('adv-123', {
        playerId: 'user1',
        playerName: 'Player1',
      });
    });
  });

  describe('sendAction', () => {
    it('should send an action message', async () => {
      const mockMessage: AdventureMessage = {
        id: 'msg-1',
        adventureId: 'adv-123',
        playerId: 'user1',
        playerName: 'Player1',
        type: 'action',
        content: 'opens the door carefully',
        createdAt: new Date().toISOString(),
      };

      mockAdventureClient.sendAction.mockResolvedValue({
        success: true,
        message: mockMessage,
      });

      const result = await service.sendAction('adv-123', 'user1', 'opens the door carefully');

      expect(result.success).toBe(true);
      expect(result.message.type).toBe('action');
      expect(result.message.content).toBe('opens the door carefully');
      expect(mockAdventureClient.sendAction).toHaveBeenCalledWith('adv-123', {
        playerId: 'user1',
        type: 'action',
        content: 'opens the door carefully',
      });
    });
  });

  describe('say', () => {
    it('should send a dialogue message', async () => {
      const mockMessage: AdventureMessage = {
        id: 'msg-2',
        adventureId: 'adv-123',
        playerId: 'user1',
        playerName: 'Player1',
        type: 'say',
        content: 'Hello there!',
        createdAt: new Date().toISOString(),
      };

      mockAdventureClient.sendAction.mockResolvedValue({
        success: true,
        message: mockMessage,
      });

      const result = await service.say('adv-123', 'user1', 'Hello there!');

      expect(result.success).toBe(true);
      expect(result.message.type).toBe('say');
      expect(mockAdventureClient.sendAction).toHaveBeenCalledWith('adv-123', {
        playerId: 'user1',
        type: 'say',
        content: 'Hello there!',
      });
    });
  });

  describe('emote', () => {
    it('should send an emote message', async () => {
      const mockMessage: AdventureMessage = {
        id: 'msg-3',
        adventureId: 'adv-123',
        playerId: 'user1',
        playerName: 'Player1',
        type: 'emote',
        content: 'smiles warmly',
        createdAt: new Date().toISOString(),
      };

      mockAdventureClient.sendAction.mockResolvedValue({
        success: true,
        message: mockMessage,
      });

      const result = await service.emote('adv-123', 'user1', 'smiles warmly');

      expect(result.success).toBe(true);
      expect(result.message.type).toBe('emote');
      expect(mockAdventureClient.sendAction).toHaveBeenCalledWith('adv-123', {
        playerId: 'user1',
        type: 'emote',
        content: 'smiles warmly',
      });
    });
  });

  describe('sendNarrative', () => {
    it('should send a narrative message', async () => {
      const mockMessage: AdventureMessage = {
        id: 'msg-4',
        adventureId: 'adv-123',
        playerId: 'dm1',
        playerName: 'DM',
        type: 'narrative',
        content: 'A cold wind sweeps through the chamber...',
        createdAt: new Date().toISOString(),
      };

      mockAdventureClient.sendNarrative.mockResolvedValue({
        success: true,
        message: mockMessage,
      });

      const result = await service.sendNarrative('adv-123', 'dm1', 'A cold wind sweeps through the chamber...');

      expect(result.success).toBe(true);
      expect(result.message.type).toBe('narrative');
      expect(mockAdventureClient.sendNarrative).toHaveBeenCalledWith('adv-123', {
        playerId: 'dm1',
        content: 'A cold wind sweeps through the chamber...',
      });
    });
  });

  describe('getHistory', () => {
    it('should get message history', async () => {
      const mockMessages: AdventureMessage[] = [
        {
          id: 'msg-1',
          adventureId: 'adv-123',
          playerId: 'user1',
          playerName: 'Player1',
          type: 'action',
          content: 'enters the room',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'msg-2',
          adventureId: 'adv-123',
          playerId: 'user1',
          playerName: 'Player1',
          type: 'say',
          content: 'Anyone here?',
          createdAt: new Date().toISOString(),
        },
      ];

      mockAdventureClient.getHistory.mockResolvedValue({
        messages: mockMessages,
      });

      const result = await service.getHistory('adv-123');

      expect(result).toHaveLength(2);
      expect(mockAdventureClient.getHistory).toHaveBeenCalledWith('adv-123', 50, undefined);
    });

    it('should support custom limit and before cursor', async () => {
      mockAdventureClient.getHistory.mockResolvedValue({
        messages: [],
      });

      await service.getHistory('adv-123', 10, 'msg-100');

      expect(mockAdventureClient.getHistory).toHaveBeenCalledWith('adv-123', 10, 'msg-100');
    });
  });

  describe('end', () => {
    it('should end an adventure', async () => {
      mockAdventureClient.end.mockResolvedValue({
        success: true,
      });

      const result = await service.end('adv-123');

      expect(result).toBe(true);
      expect(mockAdventureClient.end).toHaveBeenCalledWith('adv-123');
    });

    it('should return false when ending fails', async () => {
      mockAdventureClient.end.mockResolvedValue({
        success: false,
      });

      const result = await service.end('adv-123');

      expect(result).toBe(false);
    });
  });

  describe('hasAdventure', () => {
    it('should return true for active adventure', async () => {
      const mockAdventure: Adventure = {
        id: 'adv-123',
        guildId: 'guild1',
        channelId: 'channel1',
        name: 'Test Quest',
        status: 'active',
        players: [],
        playerCount: 0,
        createdAt: new Date().toISOString(),
      };

      mockAdventureClient.getByChannel.mockResolvedValue({
        adventure: mockAdventure,
      });

      const result = await service.hasAdventure('guild1', 'channel1');

      expect(result).toBe(true);
    });

    it('should return false for ended adventure', async () => {
      const mockAdventure: Adventure = {
        id: 'adv-123',
        guildId: 'guild1',
        channelId: 'channel1',
        name: 'Test Quest',
        status: 'ended',
        players: [],
        playerCount: 0,
        createdAt: new Date().toISOString(),
      };

      mockAdventureClient.getByChannel.mockResolvedValue({
        adventure: mockAdventure,
      });

      const result = await service.hasAdventure('guild1', 'channel1');

      expect(result).toBe(false);
    });

    it('should return false when no adventure exists', async () => {
      const error = new Error('Not found');
      (error as any).status = 404;
      mockAdventureClient.getByChannel.mockRejectedValue(error);

      const result = await service.hasAdventure('guild1', 'channel1');

      expect(result).toBe(false);
    });
  });

  describe('joinAsBot', () => {
    it('should join adventure as FumbleBot', async () => {
      mockAdventureClient.join.mockResolvedValue({
        success: true,
        adventure: {
          id: 'adv-123',
          status: 'active',
          playerCount: 2,
        },
      });

      const result = await service.joinAsBot('adv-123');

      expect(result).toBe(true);
      expect(mockAdventureClient.join).toHaveBeenCalledWith('adv-123', {
        playerId: 'fumblebot',
        playerName: 'FumbleBot',
        role: 'bot',
      });
    });
  });
});
