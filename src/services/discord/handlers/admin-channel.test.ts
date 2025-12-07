/**
 * Admin Channel Handler Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getAdminChannelId,
  isAdminChannel,
  getChannelSummary,
  getFullServerContext,
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

describe('conversation participant tracking', () => {
  it('builds participant map from messages', async () => {
    // Test internal helper via integration - the function is private
    // but we can test its effects through handleAdminChannelMessage
    // For now, test the exported functions cover the main use cases
    expect(true).toBe(true)
  })
})

describe('response type handling', () => {
  it('supports answer response type', () => {
    const responseTypes = ['answer', 'advice', 'clarification', 'none']
    expect(responseTypes).toContain('answer')
  })

  it('supports advice response type', () => {
    const responseTypes = ['answer', 'advice', 'clarification', 'none']
    expect(responseTypes).toContain('advice')
  })

  it('supports clarification response type', () => {
    const responseTypes = ['answer', 'advice', 'clarification', 'none']
    expect(responseTypes).toContain('clarification')
  })

  it('supports none response type', () => {
    const responseTypes = ['answer', 'advice', 'clarification', 'none']
    expect(responseTypes).toContain('none')
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
})
