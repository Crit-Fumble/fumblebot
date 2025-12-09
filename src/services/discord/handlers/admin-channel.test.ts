/**
 * Admin Channel Handler Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getAdminChannelId,
  isAdminChannel,
  getChannelSummary,
  getFullServerContext,
  handleAdminChannelMessage,
} from './admin-channel.js'

// Mock environment
const originalEnv = process.env

// Mock AIService
vi.mock('../../ai/service.js', () => ({
  AIService: {
    getInstance: vi.fn().mockReturnValue({
      chat: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          shouldRespond: false,
          reason: 'Test mock',
          replyToUserId: null,
          responseType: 'none',
          confidence: 0.5,
        }),
      }),
      lookup: vi.fn().mockResolvedValue({
        content: 'Mock lookup result',
      }),
    }),
  },
}))

// Mock GuildContextManager
vi.mock('../../context/guild-context-manager.js', () => ({
  GuildContextManager: {
    getInstance: vi.fn().mockReturnValue({
      getGuildContext: vi.fn().mockReturnValue({
        guildId: 'test-guild',
        guildName: 'Test Server',
        categories: new Map([
          ['cat1', {
            categoryId: 'cat1',
            guildId: 'test-guild',
            name: 'General',
            position: 0,
            channels: new Map([
              ['ch1', {
                channelId: 'ch1',
                guildId: 'test-guild',
                categoryId: 'cat1',
                name: 'general',
                type: 'text',
                topic: 'General chat',
                position: 0,
                isThread: false,
                recentMessages: [],
                messageCount: 100,
              }],
            ]),
          }],
        ]),
        uncategorizedChannels: new Map(),
        channelIndex: new Map([
          ['ch1', {
            channelId: 'ch1',
            guildId: 'test-guild',
            categoryId: 'cat1',
            name: 'general',
            type: 'text',
            topic: 'General chat',
            position: 0,
            isThread: false,
            recentMessages: [
              {
                messageId: 'msg1',
                guildId: 'test-guild',
                channelId: 'ch1',
                authorId: 'user1',
                authorUsername: 'TestUser',
                content: 'Hello world',
                createdAt: new Date(),
              },
            ],
            messageCount: 100,
          }],
        ]),
        userIndex: new Map(),
        lastPolled: new Date(),
        isPolling: false,
      }),
      getChannelContext: vi.fn().mockImplementation((guildId: string, channelId: string) => {
        if (channelId === 'ch1') {
          return {
            channelId: 'ch1',
            guildId: 'test-guild',
            categoryId: 'cat1',
            name: 'general',
            type: 'text',
            topic: 'General chat',
            position: 0,
            isThread: false,
            recentMessages: [
              {
                messageId: 'msg1',
                guildId: 'test-guild',
                channelId: 'ch1',
                authorId: 'user1',
                authorUsername: 'TestUser',
                content: 'Hello world',
                createdAt: new Date(),
              },
            ],
            messageCount: 100,
          }
        }
        return undefined
      }),
    }),
  },
}))

describe('getAdminChannelId', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns null when FUMBLEBOT_DISCORD_ADMIN_CHANNEL is not set', () => {
    delete process.env.FUMBLEBOT_DISCORD_ADMIN_CHANNEL
    const result = getAdminChannelId()
    expect(result).toBeNull()
  })

  it('returns channel ID when set', () => {
    process.env.FUMBLEBOT_DISCORD_ADMIN_CHANNEL = '123456789'
    const result = getAdminChannelId()
    expect(result).toBe('123456789')
  })

  it('returns empty string as null', () => {
    process.env.FUMBLEBOT_DISCORD_ADMIN_CHANNEL = ''
    const result = getAdminChannelId()
    expect(result).toBeNull()
  })
})

describe('isAdminChannel', () => {
  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns false when admin channel is not configured', () => {
    delete process.env.FUMBLEBOT_DISCORD_ADMIN_CHANNEL

    const mockMessage = {
      channelId: '123456789',
    } as any

    const result = isAdminChannel(mockMessage)
    expect(result).toBe(false)
  })

  it('returns true when message is from admin channel', () => {
    process.env.FUMBLEBOT_DISCORD_ADMIN_CHANNEL = '123456789'

    const mockMessage = {
      channelId: '123456789',
    } as any

    const result = isAdminChannel(mockMessage)
    expect(result).toBe(true)
  })

  it('returns false when message is from different channel', () => {
    process.env.FUMBLEBOT_DISCORD_ADMIN_CHANNEL = '123456789'

    const mockMessage = {
      channelId: '987654321',
    } as any

    const result = isAdminChannel(mockMessage)
    expect(result).toBe(false)
  })
})

describe('getChannelSummary', () => {
  it('returns channel summary with recent messages', () => {
    const summary = getChannelSummary('test-guild', 'ch1')

    expect(summary).not.toBeNull()
    expect(summary).toContain('#general')
    expect(summary).toContain('General chat')
    expect(summary).toContain('TestUser')
    expect(summary).toContain('Hello world')
  })

  it('returns null for unknown channel', () => {
    const summary = getChannelSummary('test-guild', 'unknown')
    expect(summary).toBeNull()
  })
})

describe('getFullServerContext', () => {
  it('returns guild context structure', () => {
    const context = getFullServerContext('test-guild')

    expect(context).toHaveProperty('guild')
    expect(context).toHaveProperty('categories')
    expect(context).toHaveProperty('channels')
  })

  it('returns guild with correct name', () => {
    const context = getFullServerContext('test-guild')

    expect(context.guild).toBeDefined()
    expect(context.guild?.guildName).toBe('Test Server')
  })

  it('returns categories array', () => {
    const context = getFullServerContext('test-guild')

    expect(Array.isArray(context.categories)).toBe(true)
    expect(context.categories.length).toBeGreaterThan(0)
    expect(context.categories[0].name).toBe('General')
  })

  it('returns channels array', () => {
    const context = getFullServerContext('test-guild')

    expect(Array.isArray(context.channels)).toBe(true)
    expect(context.channels.length).toBeGreaterThan(0)
    expect(context.channels[0].name).toBe('general')
  })

  it('returns empty arrays for unknown guild', async () => {
    const { GuildContextManager } = await import('../../context/guild-context-manager.js')
    const manager = GuildContextManager.getInstance()

    ;(manager.getGuildContext as ReturnType<typeof vi.fn>).mockReturnValueOnce(undefined)

    const context = getFullServerContext('unknown-guild')

    expect(context.guild).toBeUndefined()
    expect(context.categories).toHaveLength(0)
    expect(context.channels).toHaveLength(0)
  })
})

describe('handleAdminChannelMessage', () => {
  const createMockMessage = (overrides: Record<string, unknown> = {}) => {
    const mockMessages = new Map([
      ['msg1', {
        id: 'msg1',
        content: 'Previous message',
        author: { id: 'user1', username: 'User1', displayName: 'User1', bot: false },
        member: { displayName: 'User1' },
        createdAt: new Date(Date.now() - 60000),
        createdTimestamp: Date.now() - 60000,
        reference: null,
      }],
    ])

    return {
      id: 'msg2',
      channelId: 'admin-channel',
      content: 'Test message',
      author: { id: 'user2', username: 'TestUser', displayName: 'TestUser', bot: false },
      member: { displayName: 'TestUser' },
      guild: { id: 'test-guild' },
      createdAt: new Date(),
      createdTimestamp: Date.now(),
      reference: null,
      channel: {
        messages: {
          fetch: vi.fn().mockResolvedValue(mockMessages),
        },
        sendTyping: vi.fn().mockResolvedValue(undefined),
        send: vi.fn().mockResolvedValue({ id: 'response1' }),
      },
      reply: vi.fn().mockResolvedValue({ id: 'reply1' }),
      ...overrides,
    }
  }

  const createMockBot = () => ({
    user: { id: 'bot-user' },
  })

  it('should not respond to bot messages', async () => {
    const mockMessage = createMockMessage({
      author: { id: 'bot1', username: 'Bot', displayName: 'Bot', bot: true },
    })
    const mockBot = createMockBot()

    await handleAdminChannelMessage(mockMessage, mockBot)

    // Should not fetch messages or send anything
    expect(mockMessage.channel.messages.fetch).not.toHaveBeenCalled()
    expect(mockMessage.channel.send).not.toHaveBeenCalled()
    expect(mockMessage.reply).not.toHaveBeenCalled()
  })

  it('should fetch recent messages for context', async () => {
    const mockMessage = createMockMessage()
    const mockBot = createMockBot()

    await handleAdminChannelMessage(mockMessage, mockBot)

    expect(mockMessage.channel.messages.fetch).toHaveBeenCalledWith({ limit: 15 })
  })

  it('should analyze conversation before responding', async () => {
    const { AIService } = await import('../../ai/service.js')
    const mockChat = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        shouldRespond: false,
        reason: 'Analysis complete',
        replyToUserId: null,
        responseType: 'none',
        confidence: 0.3,
      }),
    })
    ;(AIService.getInstance as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: mockChat,
    })

    const mockMessage = createMockMessage()
    const mockBot = createMockBot()

    await handleAdminChannelMessage(mockMessage, mockBot)

    // AI should be called for analysis
    expect(mockChat).toHaveBeenCalled()
    // Should not respond since confidence is below 0.6
    expect(mockMessage.channel.send).not.toHaveBeenCalled()
  })

  it('should not respond when confidence is below threshold', async () => {
    const { AIService } = await import('../../ai/service.js')
    const mockChat = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        shouldRespond: true,
        reason: 'Should respond but low confidence',
        replyToUserId: null,
        responseType: 'answer',
        confidence: 0.5, // Below 0.6 threshold
      }),
    })
    ;(AIService.getInstance as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: mockChat,
    })

    const mockMessage = createMockMessage()
    const mockBot = createMockBot()

    await handleAdminChannelMessage(mockMessage, mockBot)

    // Should not send response due to low confidence
    expect(mockMessage.channel.send).not.toHaveBeenCalled()
    expect(mockMessage.reply).not.toHaveBeenCalled()
  })

  it('should respond when shouldRespond is true and confidence is high', async () => {
    const { AIService } = await import('../../ai/service.js')
    const mockChat = vi.fn()
      // First call: analysis
      .mockResolvedValueOnce({
        content: JSON.stringify({
          shouldRespond: true,
          reason: 'Open question detected',
          replyToUserId: null,
          responseType: 'answer',
          confidence: 0.8,
        }),
      })
      // Second call: generate response
      .mockResolvedValueOnce({
        content: 'Here is my helpful response!',
      })

    ;(AIService.getInstance as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: mockChat,
    })

    const mockMessage = createMockMessage()
    const mockBot = createMockBot()

    await handleAdminChannelMessage(mockMessage, mockBot)

    // Should send response
    expect(mockMessage.channel.send).toHaveBeenCalledWith({
      content: 'Here is my helpful response!',
    })
  })

  it('should reply directly when replyToUserId matches message author', async () => {
    const { AIService } = await import('../../ai/service.js')
    const mockChat = vi.fn()
      .mockResolvedValueOnce({
        content: JSON.stringify({
          shouldRespond: true,
          reason: 'Direct question',
          replyToUserId: 'user2', // Same as message author
          responseType: 'answer',
          confidence: 0.9,
        }),
      })
      .mockResolvedValueOnce({
        content: 'Direct reply to you!',
      })

    ;(AIService.getInstance as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: mockChat,
    })

    const mockMessage = createMockMessage()
    const mockBot = createMockBot()

    await handleAdminChannelMessage(mockMessage, mockBot)

    // Should use reply() for direct responses
    expect(mockMessage.reply).toHaveBeenCalledWith({
      content: 'Direct reply to you!',
    })
    expect(mockMessage.channel.send).not.toHaveBeenCalled()
  })

  it('should mention specific user when replyToUserId differs from author', async () => {
    const { AIService } = await import('../../ai/service.js')
    const mockChat = vi.fn()
      .mockResolvedValueOnce({
        content: JSON.stringify({
          shouldRespond: true,
          reason: 'Addressing other user',
          replyToUserId: 'user1', // Different from message author (user2)
          responseType: 'advice',
          confidence: 0.85,
        }),
      })
      .mockResolvedValueOnce({
        content: 'Advice for the other user',
      })

    ;(AIService.getInstance as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: mockChat,
    })

    const mockMessage = createMockMessage()
    const mockBot = createMockBot()

    await handleAdminChannelMessage(mockMessage, mockBot)

    // Should send with mention
    expect(mockMessage.channel.send).toHaveBeenCalledWith({
      content: '<@user1> Advice for the other user',
    })
  })

  it('should show typing indicator before responding', async () => {
    const { AIService } = await import('../../ai/service.js')
    const mockChat = vi.fn()
      .mockResolvedValueOnce({
        content: JSON.stringify({
          shouldRespond: true,
          reason: 'Should respond',
          replyToUserId: null,
          responseType: 'answer',
          confidence: 0.9,
        }),
      })
      .mockResolvedValueOnce({
        content: 'Response',
      })

    ;(AIService.getInstance as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: mockChat,
    })

    const mockMessage = createMockMessage()
    const mockBot = createMockBot()

    await handleAdminChannelMessage(mockMessage, mockBot)

    expect(mockMessage.channel.sendTyping).toHaveBeenCalled()
  })

  it('should fail silently on response generation error', async () => {
    const { AIService } = await import('../../ai/service.js')
    const mockChat = vi.fn()
      .mockResolvedValueOnce({
        content: JSON.stringify({
          shouldRespond: true,
          reason: 'Should respond',
          replyToUserId: null,
          responseType: 'answer',
          confidence: 0.9,
        }),
      })
      .mockRejectedValueOnce(new Error('AI service error'))

    ;(AIService.getInstance as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: mockChat,
    })

    const mockMessage = createMockMessage()
    const mockBot = createMockBot()

    // Should not throw
    await expect(handleAdminChannelMessage(mockMessage, mockBot)).resolves.not.toThrow()

    // Should not send any message
    expect(mockMessage.channel.send).not.toHaveBeenCalled()
  })

  it('should handle malformed JSON from analysis gracefully', async () => {
    const { AIService } = await import('../../ai/service.js')
    const mockChat = vi.fn().mockResolvedValue({
      content: 'This is not valid JSON',
    })

    ;(AIService.getInstance as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: mockChat,
    })

    const mockMessage = createMockMessage()
    const mockBot = createMockBot()

    // Should not throw
    await expect(handleAdminChannelMessage(mockMessage, mockBot)).resolves.not.toThrow()

    // Should not respond when analysis fails
    expect(mockMessage.channel.send).not.toHaveBeenCalled()
  })
})

describe('getChannelSummary edge cases', () => {
  it('truncates long message content', async () => {
    const { GuildContextManager } = await import('../../context/guild-context-manager.js')
    const manager = GuildContextManager.getInstance()

    // Setup mock with long message
    const longContent = 'A'.repeat(200)
    ;(manager.getChannelContext as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      channelId: 'ch1',
      guildId: 'test-guild',
      name: 'test-channel',
      topic: null,
      recentMessages: [{
        authorUsername: 'TestUser',
        content: longContent,
      }],
    })

    const summary = getChannelSummary('test-guild', 'ch1')

    // Should truncate to 100 characters
    expect(summary).not.toContain(longContent)
    expect(summary).toContain('A'.repeat(100))
  })

  it('handles channel without topic', async () => {
    const { GuildContextManager } = await import('../../context/guild-context-manager.js')
    const manager = GuildContextManager.getInstance()

    ;(manager.getChannelContext as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      channelId: 'ch1',
      guildId: 'test-guild',
      name: 'no-topic-channel',
      topic: null,
      recentMessages: [],
    })

    const summary = getChannelSummary('test-guild', 'ch1')

    expect(summary).toContain('#no-topic-channel')
    expect(summary).not.toContain('(')
  })

  it('handles empty recent messages', async () => {
    const { GuildContextManager } = await import('../../context/guild-context-manager.js')
    const manager = GuildContextManager.getInstance()

    ;(manager.getChannelContext as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      channelId: 'ch1',
      guildId: 'test-guild',
      name: 'quiet-channel',
      topic: 'A quiet channel',
      recentMessages: [],
    })

    const summary = getChannelSummary('test-guild', 'ch1')

    expect(summary).toContain('#quiet-channel')
    expect(summary).toContain('A quiet channel')
    expect(summary).toContain('Recent activity:')
  })

  it('shows only last 5 messages', async () => {
    const { GuildContextManager } = await import('../../context/guild-context-manager.js')
    const manager = GuildContextManager.getInstance()

    const messages = Array.from({ length: 10 }, (_, i) => ({
      authorUsername: `User${i}`,
      content: `Message ${i}`,
    }))

    ;(manager.getChannelContext as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      channelId: 'ch1',
      guildId: 'test-guild',
      name: 'busy-channel',
      topic: null,
      recentMessages: messages,
    })

    const summary = getChannelSummary('test-guild', 'ch1')

    // Should only show last 5 (indices 5-9)
    expect(summary).not.toContain('Message 0')
    expect(summary).not.toContain('Message 4')
    expect(summary).toContain('Message 5')
    expect(summary).toContain('Message 9')
  })
})

describe('getFullServerContext edge cases', () => {
  it('handles guild with uncategorized channels', async () => {
    const { GuildContextManager } = await import('../../context/guild-context-manager.js')
    const manager = GuildContextManager.getInstance()

    ;(manager.getGuildContext as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      guildId: 'test-guild',
      guildName: 'Test Server',
      categories: new Map(),
      uncategorizedChannels: new Map([
        ['unch1', {
          channelId: 'unch1',
          name: 'uncategorized-channel',
          type: 'text',
        }],
      ]),
      channelIndex: new Map([
        ['unch1', {
          channelId: 'unch1',
          name: 'uncategorized-channel',
          type: 'text',
        }],
      ]),
    })

    const context = getFullServerContext('test-guild')

    expect(context.guild).toBeDefined()
    expect(context.channels).toHaveLength(1)
    expect(context.channels[0].name).toBe('uncategorized-channel')
  })

  it('handles guild with multiple categories', async () => {
    const { GuildContextManager } = await import('../../context/guild-context-manager.js')
    const manager = GuildContextManager.getInstance()

    ;(manager.getGuildContext as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      guildId: 'test-guild',
      guildName: 'Multi-Category Server',
      categories: new Map([
        ['cat1', { categoryId: 'cat1', name: 'Category 1', channels: new Map() }],
        ['cat2', { categoryId: 'cat2', name: 'Category 2', channels: new Map() }],
        ['cat3', { categoryId: 'cat3', name: 'Category 3', channels: new Map() }],
      ]),
      uncategorizedChannels: new Map(),
      channelIndex: new Map(),
    })

    const context = getFullServerContext('test-guild')

    expect(context.categories).toHaveLength(3)
    expect(context.categories.map(c => c.name)).toEqual(['Category 1', 'Category 2', 'Category 3'])
  })
})

describe('server context building', () => {
  it('formats server structure correctly', () => {
    const context = getFullServerContext('test-guild')

    // Verify structure is suitable for AI consumption
    expect(context.guild?.guildName).toBeTruthy()
    expect(context.categories[0]?.name).toBeTruthy()
    expect(context.channels[0]?.name).toBeTruthy()
  })

  it('includes all necessary fields for AI context', () => {
    const context = getFullServerContext('test-guild')

    // Guild should have required fields
    expect(context.guild).toHaveProperty('guildId')
    expect(context.guild).toHaveProperty('guildName')

    // Categories should be iterable
    expect(Array.isArray(context.categories)).toBe(true)

    // Channels should have essential info
    if (context.channels.length > 0) {
      expect(context.channels[0]).toHaveProperty('channelId')
      expect(context.channels[0]).toHaveProperty('name')
    }
  })
})
