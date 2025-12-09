/**
 * Button Handler - IC Move Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { ButtonInteraction } from 'discord.js';
import { handleButton } from '../../../src/services/discord/handlers/button.js';
import * as characterServiceModule from '../../../src/services/character/character-service.js';
import * as webhookServiceModule from '../../../src/services/discord/webhook-service.js';

// Mock the services
vi.mock('../../../src/services/character/character-service.js', () => ({
  default: {
    getById: vi.fn(),
  },
}));

vi.mock('../../../src/services/discord/webhook-service.js', () => ({
  default: {
    sendAsCharacter: vi.fn(),
  },
}));

// Mock other dependencies
vi.mock('../../../src/services/discord/settings/index.js', () => ({
  getUserSettings: vi.fn().mockResolvedValue({}),
  disconnectWorldAnvil: vi.fn(),
}));

vi.mock('../../../src/services/worldanvil/index.js', () => ({
  getWorldAnvilService: vi.fn(),
}));

describe('Button Handler - IC Move', () => {
  let mockInteraction: any;
  let mockChannel: any;
  let mockCharacterService: any;
  let mockWebhookService: any;

  beforeEach(() => {
    mockChannel = {
      id: 'channel-123',
      isThread: vi.fn().mockReturnValue(false),
    };

    mockInteraction = {
      customId: 'ic_move:char-1:n',
      user: {
        id: 'user-123',
        displayName: 'TestUser',
        username: 'testuser',
      },
      guildId: 'guild-456',
      channel: mockChannel,
      channelId: 'channel-123',
      reply: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
      replied: false,
      deferred: false,
    };

    mockCharacterService = characterServiceModule.default as any;
    mockWebhookService = webhookServiceModule.default as any;

    mockCharacterService.getById.mockReset();
    mockWebhookService.sendAsCharacter.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('IC Move Button', () => {
    it('should handle north movement', async () => {
      const mockCharacter = {
        id: 'char-1',
        userId: 'user-123',
        guildId: 'guild-456',
        name: 'Aragorn',
        tokenUrl: 'https://example.com/aragorn.png',
        activeChannelId: 'channel-123',
        activeThreadId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCharacterService.getById.mockResolvedValue(mockCharacter);
      mockWebhookService.sendAsCharacter.mockResolvedValue(undefined);

      mockInteraction.customId = 'ic_move:char-1:n';

      await handleButton(mockInteraction as ButtonInteraction, null as any);

      expect(mockCharacterService.getById).toHaveBeenCalledWith('char-1', 'user-123', 'guild-456');
      expect(mockWebhookService.sendAsCharacter).toHaveBeenCalledWith(
        mockChannel,
        mockCharacter,
        '*moves north ⬆️*'
      );
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: '✅ Aragorn moves north ⬆️',
        ephemeral: true,
      });
    });

    it('should handle all directional movements', async () => {
      const mockCharacter = {
        id: 'char-1',
        userId: 'user-123',
        guildId: 'guild-456',
        name: 'Test',
        tokenUrl: null,
        activeChannelId: null,
        activeThreadId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCharacterService.getById.mockResolvedValue(mockCharacter);

      const directions = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'];

      for (const dir of directions) {
        mockInteraction.customId = `ic_move:char-1:${dir}`;
        mockInteraction.reply.mockClear();
        mockWebhookService.sendAsCharacter.mockClear();

        await handleButton(mockInteraction as ButtonInteraction, null as any);

        expect(mockWebhookService.sendAsCharacter).toHaveBeenCalled();
        expect(mockInteraction.reply).toHaveBeenCalledWith(
          expect.objectContaining({
            ephemeral: true,
          })
        );
      }
    });

    it('should handle stop button', async () => {
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

      mockCharacterService.getById.mockResolvedValue(mockCharacter);

      mockInteraction.customId = 'ic_move:char-1:stop';

      await handleButton(mockInteraction as ButtonInteraction, null as any);

      expect(mockWebhookService.sendAsCharacter).toHaveBeenCalledWith(
        mockChannel,
        mockCharacter,
        '*stops moving* 🛑'
      );
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: '✅ Legolas stopped.',
        ephemeral: true,
      });
    });

    it('should handle thread movement', async () => {
      const mockThread = {
        id: 'thread-123',
        isThread: vi.fn().mockReturnValue(true),
      };

      mockInteraction.channel = mockThread;

      const mockCharacter = {
        id: 'char-1',
        userId: 'user-123',
        guildId: 'guild-456',
        name: 'Gimli',
        tokenUrl: null,
        activeChannelId: null,
        activeThreadId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCharacterService.getById.mockResolvedValue(mockCharacter);

      mockInteraction.customId = 'ic_move:char-1:e';

      await handleButton(mockInteraction as ButtonInteraction, null as any);

      expect(mockWebhookService.sendAsCharacter).toHaveBeenCalledWith(
        mockThread,
        mockCharacter,
        '*moves east ➡️*'
      );
    });

    it('should reject if character not found', async () => {
      mockCharacterService.getById.mockResolvedValue(null);

      mockInteraction.customId = 'ic_move:char-999:n';

      await handleButton(mockInteraction as ButtonInteraction, null as any);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: '❌ Character not found or you do not have permission to move it.',
        ephemeral: true,
      });
      expect(mockWebhookService.sendAsCharacter).not.toHaveBeenCalled();
    });

    it('should reject if not in guild', async () => {
      mockInteraction.guildId = null;

      mockInteraction.customId = 'ic_move:char-1:n';

      await handleButton(mockInteraction as ButtonInteraction, null as any);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: '❌ This command can only be used in a server channel.',
        ephemeral: true,
      });
      expect(mockCharacterService.getById).not.toHaveBeenCalled();
    });

    it('should reject if no channel', async () => {
      mockInteraction.channel = null;

      mockInteraction.customId = 'ic_move:char-1:n';

      await handleButton(mockInteraction as ButtonInteraction, null as any);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: '❌ This command can only be used in a server channel.',
        ephemeral: true,
      });
    });

    it('should handle webhook send errors', async () => {
      const mockCharacter = {
        id: 'char-1',
        userId: 'user-123',
        guildId: 'guild-456',
        name: 'Aragorn',
        tokenUrl: null,
        activeChannelId: null,
        activeThreadId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCharacterService.getById.mockResolvedValue(mockCharacter);
      mockWebhookService.sendAsCharacter.mockRejectedValue(new Error('Webhook failed'));

      mockInteraction.customId = 'ic_move:char-1:n';

      await handleButton(mockInteraction as ButtonInteraction, null as any);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: '❌ Error: Webhook failed',
        ephemeral: true,
      });
    });

    it('should handle character service errors', async () => {
      mockCharacterService.getById.mockRejectedValue(new Error('Database error'));

      mockInteraction.customId = 'ic_move:char-1:n';

      await handleButton(mockInteraction as ButtonInteraction, null as any);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: '❌ Error: Database error',
        ephemeral: true,
      });
    });

    it('should reject unknown IC subaction', async () => {
      mockInteraction.customId = 'ic_attack:char-1:target';

      await handleButton(mockInteraction as ButtonInteraction, null as any);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: '❌ Unknown IC action.',
        ephemeral: true,
      });
    });
  });

  describe('IC Move Button - Edge Cases', () => {
    it('should handle characters with long names', async () => {
      const mockCharacter = {
        id: 'char-1',
        userId: 'user-123',
        guildId: 'guild-456',
        name: 'Sir Reginald Bartholomew III',
        tokenUrl: null,
        activeChannelId: null,
        activeThreadId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCharacterService.getById.mockResolvedValue(mockCharacter);

      mockInteraction.customId = 'ic_move:char-1:nw';

      await handleButton(mockInteraction as ButtonInteraction, null as any);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: '✅ Sir Reginald Bartholomew III moves northwest ↖️',
        ephemeral: true,
      });
    });

    it('should handle invalid direction gracefully', async () => {
      const mockCharacter = {
        id: 'char-1',
        userId: 'user-123',
        guildId: 'guild-456',
        name: 'Test',
        tokenUrl: null,
        activeChannelId: null,
        activeThreadId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCharacterService.getById.mockResolvedValue(mockCharacter);

      mockInteraction.customId = 'ic_move:char-1:invalid';

      await handleButton(mockInteraction as ButtonInteraction, null as any);

      // Should still process, just with unmapped direction
      expect(mockWebhookService.sendAsCharacter).toHaveBeenCalledWith(
        mockChannel,
        mockCharacter,
        '*moves invalid*'
      );
    });
  });
});
