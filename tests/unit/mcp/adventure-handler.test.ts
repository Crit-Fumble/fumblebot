/**
 * Adventure Handler Tests
 * Tests for MCP adventure tool handler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Adventure, AdventureMessage, AdventureSummary } from '@crit-fumble/core';

// Mock adventure service - must be before vi.mock
vi.mock('../../../src/services/terminal/adventure-service.js', () => ({
  default: {
    create: vi.fn(),
    get: vi.fn(),
    getByChannel: vi.fn(),
    list: vi.fn(),
    join: vi.fn(),
    leave: vi.fn(),
    sendAction: vi.fn(),
    say: vi.fn(),
    emote: vi.fn(),
    sendNarrative: vi.fn(),
    getHistory: vi.fn(),
    end: vi.fn(),
  },
}));

// Import after mocking
import { AdventureHandler } from '../../../src/mcp/handlers/adventure.js';
import adventureService from '../../../src/services/terminal/adventure-service.js';

// Type the mock for better intellisense
const mockAdventureService = adventureService as {
  create: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  getByChannel: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
  join: ReturnType<typeof vi.fn>;
  leave: ReturnType<typeof vi.fn>;
  sendAction: ReturnType<typeof vi.fn>;
  say: ReturnType<typeof vi.fn>;
  emote: ReturnType<typeof vi.fn>;
  sendNarrative: ReturnType<typeof vi.fn>;
  getHistory: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
};

describe('Adventure Handler', () => {
  let handler: AdventureHandler;

  beforeEach(() => {
    handler = new AdventureHandler();
    vi.clearAllMocks();
  });

  describe('adventure_create', () => {
    it('should create a new adventure', async () => {
      mockAdventureService.create.mockResolvedValue({
        id: 'adv-123',
        name: 'The Dark Dungeon',
        status: 'waiting',
      });

      const result = await handler.handle('adventure_create', {
        guildId: 'guild1',
        channelId: 'channel1',
        name: 'The Dark Dungeon',
        description: 'A perilous journey',
      });

      expect(result.content[0].text).toContain('Adventure created');
      expect(result.content[0].text).toContain('The Dark Dungeon');
      expect(result.content[0].text).toContain('adv-123');
      expect(mockAdventureService.create).toHaveBeenCalledWith(
        'guild1',
        'channel1',
        'The Dark Dungeon',
        'A perilous journey'
      );
    });
  });

  describe('adventure_join', () => {
    it('should join an adventure as player', async () => {
      mockAdventureService.join.mockResolvedValue({
        success: true,
        status: 'active',
        playerCount: 2,
      });

      const result = await handler.handle('adventure_join', {
        adventureId: 'adv-123',
        playerId: 'user1',
        playerName: 'Aragorn',
      });

      expect(result.content[0].text).toContain('Aragorn joined the adventure');
      expect(result.content[0].text).toContain('player');
      expect(result.content[0].text).toContain('2');
    });

    it('should join an adventure as DM', async () => {
      mockAdventureService.join.mockResolvedValue({
        success: true,
        status: 'active',
        playerCount: 1,
      });

      const result = await handler.handle('adventure_join', {
        adventureId: 'adv-123',
        playerId: 'dm1',
        playerName: 'DungeonMaster',
        role: 'dm',
      });

      expect(result.content[0].text).toContain('DungeonMaster joined the adventure');
      expect(result.content[0].text).toContain('dm');
    });

    it('should handle failed join', async () => {
      mockAdventureService.join.mockResolvedValue({
        success: false,
      });

      const result = await handler.handle('adventure_join', {
        adventureId: 'adv-123',
        playerId: 'user1',
        playerName: 'Player1',
      });

      expect(result.content[0].text).toBe('Failed to join adventure');
    });
  });

  describe('adventure_action', () => {
    it('should send an action message', async () => {
      const mockMessage: AdventureMessage = {
        id: 'msg-1',
        adventureId: 'adv-123',
        playerId: 'user1',
        playerName: 'Aragorn',
        type: 'action',
        content: 'draws his sword',
        createdAt: new Date().toISOString(),
      };

      mockAdventureService.sendAction.mockResolvedValue({
        success: true,
        message: mockMessage,
      });

      const result = await handler.handle('adventure_action', {
        adventureId: 'adv-123',
        playerId: 'user1',
        content: 'draws his sword',
      });

      expect(result.content[0].text).toContain('Aragorn draws his sword');
    });

    it('should handle failed action', async () => {
      mockAdventureService.sendAction.mockResolvedValue({
        success: false,
      });

      const result = await handler.handle('adventure_action', {
        adventureId: 'adv-123',
        playerId: 'user1',
        content: 'test',
      });

      expect(result.content[0].text).toBe('Failed to send action');
    });
  });

  describe('adventure_say', () => {
    it('should send dialogue', async () => {
      const mockMessage: AdventureMessage = {
        id: 'msg-2',
        adventureId: 'adv-123',
        playerId: 'user1',
        playerName: 'Gandalf',
        type: 'say',
        content: 'You shall not pass!',
        createdAt: new Date().toISOString(),
      };

      mockAdventureService.say.mockResolvedValue({
        success: true,
        message: mockMessage,
      });

      const result = await handler.handle('adventure_say', {
        adventureId: 'adv-123',
        playerId: 'user1',
        content: 'You shall not pass!',
      });

      expect(result.content[0].text).toContain('Gandalf');
      expect(result.content[0].text).toContain('You shall not pass!');
    });
  });

  describe('adventure_emote', () => {
    it('should send emote', async () => {
      const mockMessage: AdventureMessage = {
        id: 'msg-3',
        adventureId: 'adv-123',
        playerId: 'user1',
        playerName: 'Legolas',
        type: 'emote',
        content: 'smiles knowingly',
        createdAt: new Date().toISOString(),
      };

      mockAdventureService.emote.mockResolvedValue({
        success: true,
        message: mockMessage,
      });

      const result = await handler.handle('adventure_emote', {
        adventureId: 'adv-123',
        playerId: 'user1',
        content: 'smiles knowingly',
      });

      expect(result.content[0].text).toContain('Legolas smiles knowingly');
    });
  });

  describe('adventure_narrative', () => {
    it('should send narrative', async () => {
      const mockMessage: AdventureMessage = {
        id: 'msg-4',
        adventureId: 'adv-123',
        playerId: 'dm1',
        playerName: 'DM',
        type: 'narrative',
        content: 'A cold wind sweeps through...',
        createdAt: new Date().toISOString(),
      };

      mockAdventureService.sendNarrative.mockResolvedValue({
        success: true,
        message: mockMessage,
      });

      const result = await handler.handle('adventure_narrative', {
        adventureId: 'adv-123',
        playerId: 'dm1',
        content: 'A cold wind sweeps through...',
      });

      expect(result.content[0].text).toContain('A cold wind sweeps through...');
    });
  });

  describe('adventure_status', () => {
    it('should get adventure by ID', async () => {
      const mockAdventure: Adventure = {
        id: 'adv-123',
        guildId: 'guild1',
        channelId: 'channel1',
        name: 'Test Quest',
        description: 'A test adventure',
        status: 'active',
        players: [
          { playerId: 'user1', playerName: 'Player1', role: 'player', joinedAt: new Date().toISOString() },
        ],
        playerCount: 1,
        createdAt: new Date().toISOString(),
      };

      mockAdventureService.get.mockResolvedValue(mockAdventure);

      const result = await handler.handle('adventure_status', {
        adventureId: 'adv-123',
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBe('adv-123');
      expect(parsed.name).toBe('Test Quest');
      expect(parsed.status).toBe('active');
    });

    it('should get adventure by channel', async () => {
      const mockAdventure: Adventure = {
        id: 'adv-124',
        guildId: 'guild1',
        channelId: 'channel1',
        name: 'Channel Quest',
        status: 'waiting',
        players: [],
        playerCount: 0,
        createdAt: new Date().toISOString(),
      };

      mockAdventureService.getByChannel.mockResolvedValue(mockAdventure);

      const result = await handler.handle('adventure_status', {
        guildId: 'guild1',
        channelId: 'channel1',
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.name).toBe('Channel Quest');
    });

    it('should return error when no identifiers provided', async () => {
      const result = await handler.handle('adventure_status', {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Must provide either adventureId');
    });

    it('should handle no adventure found', async () => {
      mockAdventureService.getByChannel.mockResolvedValue(null);

      const result = await handler.handle('adventure_status', {
        guildId: 'guild1',
        channelId: 'no-adventure',
      });

      expect(result.content[0].text).toBe('No adventure found');
    });
  });

  describe('adventure_history', () => {
    it('should get message history', async () => {
      const mockMessages: AdventureMessage[] = [
        {
          id: 'msg-1',
          adventureId: 'adv-123',
          playerId: 'user1',
          playerName: 'Aragorn',
          type: 'action',
          content: 'enters the room',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'msg-2',
          adventureId: 'adv-123',
          playerId: 'user1',
          playerName: 'Aragorn',
          type: 'say',
          content: 'Hello?',
          createdAt: new Date().toISOString(),
        },
      ];

      mockAdventureService.getHistory.mockResolvedValue(mockMessages);

      const result = await handler.handle('adventure_history', {
        adventureId: 'adv-123',
        limit: 20,
      });

      expect(result.content[0].text).toContain('Aragorn enters the room');
      expect(result.content[0].text).toContain('Hello?');
    });

    it('should show empty message when no history', async () => {
      mockAdventureService.getHistory.mockResolvedValue([]);

      const result = await handler.handle('adventure_history', {
        adventureId: 'adv-123',
      });

      expect(result.content[0].text).toBe('(No messages yet)');
    });

    it('should use default limit of 20', async () => {
      mockAdventureService.getHistory.mockResolvedValue([]);

      await handler.handle('adventure_history', {
        adventureId: 'adv-123',
      });

      expect(mockAdventureService.getHistory).toHaveBeenCalledWith('adv-123', 20);
    });
  });

  describe('adventure_end', () => {
    it('should end an adventure successfully', async () => {
      mockAdventureService.end.mockResolvedValue(true);

      const result = await handler.handle('adventure_end', {
        adventureId: 'adv-123',
      });

      expect(result.content[0].text).toBe('Adventure ended successfully');
    });

    it('should handle failed end', async () => {
      mockAdventureService.end.mockResolvedValue(false);

      const result = await handler.handle('adventure_end', {
        adventureId: 'adv-123',
      });

      expect(result.content[0].text).toBe('Failed to end adventure');
    });
  });

  describe('adventure_list', () => {
    it('should list active adventures', async () => {
      const mockAdventures: AdventureSummary[] = [
        { id: 'adv-1', name: 'Quest 1', status: 'active', playerCount: 2 },
        { id: 'adv-2', name: 'Quest 2', status: 'waiting', playerCount: 1 },
      ];

      mockAdventureService.list.mockResolvedValue(mockAdventures);

      const result = await handler.handle('adventure_list', {});

      expect(result.content[0].text).toContain('Active Adventures');
      expect(result.content[0].text).toContain('Quest 1');
      expect(result.content[0].text).toContain('Quest 2');
      expect(result.content[0].text).toContain('2 players');
    });

    it('should handle no active adventures', async () => {
      mockAdventureService.list.mockResolvedValue([]);

      const result = await handler.handle('adventure_list', {});

      expect(result.content[0].text).toBe('No active adventures');
    });
  });

  describe('unknown tool', () => {
    it('should throw error for unknown tool', async () => {
      await expect(handler.handle('adventure_unknown', {})).rejects.toThrow(
        'Unknown Adventure tool: adventure_unknown'
      );
    });
  });
});
