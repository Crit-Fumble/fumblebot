/**
 * Webhook Service Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WebhookService } from '../../../src/services/discord/webhook-service.js';
import type { TextChannel, ThreadChannel, Webhook, Client } from 'discord.js';

describe('WebhookService', () => {
  let service: WebhookService;
  let mockClient: any;
  let mockChannel: any;
  let mockThread: any;
  let mockParentChannel: any;
  let mockWebhook: any;

  beforeEach(() => {
    service = WebhookService.getInstance();

    mockClient = {
      user: { id: 'bot-123' },
    };

    mockWebhook = {
      id: 'webhook-123',
      token: 'webhook-token',
      send: vi.fn().mockResolvedValue({ id: 'message-123' }),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    mockChannel = {
      id: 'channel-123',
      isTextBased: vi.fn().mockReturnValue(true),
      isThread: vi.fn().mockReturnValue(false),
      createWebhook: vi.fn().mockResolvedValue(mockWebhook),
    };

    mockParentChannel = {
      id: 'parent-channel-123',
      isTextBased: vi.fn().mockReturnValue(true),
      isThread: vi.fn().mockReturnValue(false),
      createWebhook: vi.fn().mockResolvedValue(mockWebhook),
    };

    mockThread = {
      id: 'thread-123',
      isTextBased: vi.fn().mockReturnValue(true),
      isThread: vi.fn().mockReturnValue(true),
      parent: mockParentChannel,
    };

    service.initialize(mockClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize with Discord client', () => {
      const newService = WebhookService.getInstance();
      newService.initialize(mockClient);
      expect(newService).toBeDefined();
    });
  });

  describe('sendAsCharacter', () => {
    it('should send message as character in text channel', async () => {
      const character = {
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

      await service.sendAsCharacter(mockChannel as TextChannel, character, 'Hello, friends!');

      expect(mockChannel.createWebhook).toHaveBeenCalledWith({
        name: 'Aragorn (Temporary)',
        reason: 'Ephemeral webhook for character roleplay',
      });

      expect(mockWebhook.send).toHaveBeenCalledWith({
        content: 'Hello, friends!',
        username: 'Aragorn',
        avatarURL: 'https://example.com/aragorn.png',
        threadId: undefined,
      });

      expect(mockWebhook.delete).toHaveBeenCalledWith('Ephemeral webhook cleanup');
    });

    it('should send message as character in thread', async () => {
      const character = {
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

      await service.sendAsCharacter(mockThread as ThreadChannel, character, '*draws bow*');

      expect(mockParentChannel.createWebhook).toHaveBeenCalledWith({
        name: 'Legolas (Temporary)',
        reason: 'Ephemeral webhook for character roleplay',
      });

      expect(mockWebhook.send).toHaveBeenCalledWith({
        content: '*draws bow*',
        username: 'Legolas',
        avatarURL: undefined,
        threadId: 'thread-123',
      });

      expect(mockWebhook.delete).toHaveBeenCalled();
    });

    it('should handle character without token', async () => {
      const character = {
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

      await service.sendAsCharacter(mockChannel as TextChannel, character, 'And my axe!');

      expect(mockWebhook.send).toHaveBeenCalledWith({
        content: 'And my axe!',
        username: 'Gimli',
        avatarURL: undefined,
        threadId: undefined,
      });
    });

    it('should clean up webhook even if send fails', async () => {
      const character = {
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

      mockWebhook.send.mockRejectedValue(new Error('Send failed'));

      await expect(
        service.sendAsCharacter(mockChannel as TextChannel, character, 'Hello')
      ).rejects.toThrow('Send failed');

      expect(mockWebhook.delete).toHaveBeenCalled();
    });

    it('should handle webhook deletion failure gracefully', async () => {
      const character = {
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

      mockWebhook.delete.mockRejectedValue(new Error('Delete failed'));
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Should not throw even though delete fails
      await service.sendAsCharacter(mockChannel as TextChannel, character, 'Hello');

      expect(mockWebhook.send).toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith(
        '[WebhookService] Failed to delete webhook:',
        expect.any(Error)
      );

      consoleError.mockRestore();
    });

    it('should throw if service not initialized', async () => {
      const newService = WebhookService.getInstance();
      // Don't initialize

      const character = {
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

      // Re-initialize for other tests
      newService.initialize(mockClient);
    });

    it('should throw if channel does not support webhooks', async () => {
      const character = {
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

      const badChannel = {
        id: 'voice-channel',
        isTextBased: vi.fn().mockReturnValue(false),
        isThread: vi.fn().mockReturnValue(false),
      };

      await expect(
        service.sendAsCharacter(badChannel as any, character, 'Hello')
      ).rejects.toThrow('Channel does not support webhooks');
    });
  });

  describe('canUseWebhooks', () => {
    it('should return true for text channels', () => {
      const result = service.canUseWebhooks(mockChannel as TextChannel);
      expect(result).toBe(true);
    });

    it('should return true for threads with valid parent', () => {
      const result = service.canUseWebhooks(mockThread as ThreadChannel);
      expect(result).toBe(true);
    });

    it('should return false for threads without parent', () => {
      const threadNoParent = {
        ...mockThread,
        parent: null,
      };

      const result = service.canUseWebhooks(threadNoParent as ThreadChannel);
      expect(result).toBe(false);
    });

    it('should return false for channels without createWebhook method', () => {
      const channelNoWebhook = {
        id: 'channel-123',
        isTextBased: vi.fn().mockReturnValue(true),
        isThread: vi.fn().mockReturnValue(false),
        // No createWebhook method
      };

      const result = service.canUseWebhooks(channelNoWebhook as any);
      expect(result).toBe(false);
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const instance1 = WebhookService.getInstance();
      const instance2 = WebhookService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });
});
