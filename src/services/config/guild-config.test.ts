/**
 * Guild Configuration Service Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getGuildConfig,
  getGuildGeneralConfig,
  getGuildAIConfig,
  updateGuildGeneralConfig,
  updateGuildAIConfig,
  getGuildPrefix,
  getGuildAIModels,
} from './guild-config.js'

// Mock Core client
vi.mock('../../lib/core-client.js', () => ({
  getCoreClient: vi.fn(() => ({
    calendar: {
      getGuildConfig: vi.fn(),
      setGuildConfig: vi.fn(),
    },
  })),
}))

// Mock Prisma client
vi.mock('../db/client.js', () => ({
  getPrisma: vi.fn(() => ({
    guildAIConfig: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  })),
}))

describe('Guild Configuration Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('getGuildGeneralConfig', () => {
    it('should fetch config from Core', async () => {
      const { getCoreClient } = await import('../../lib/core-client.js')
      const mockCore = {
        calendar: {
          getGuildConfig: vi.fn().mockResolvedValue({
            config: {
              prefix: '?',
              language: 'en',
              timezone: 'America/New_York',
              aiAssistant: true,
            },
          }),
        },
      }
      ;(getCoreClient as ReturnType<typeof vi.fn>).mockReturnValue(mockCore)

      const config = await getGuildGeneralConfig('test-guild')

      expect(config.prefix).toBe('?')
      expect(config.timezone).toBe('America/New_York')
      expect(config.aiAssistant).toBe(true)
    })

    it('should return defaults on error', async () => {
      const { getCoreClient } = await import('../../lib/core-client.js')
      const mockCore = {
        calendar: {
          getGuildConfig: vi.fn().mockRejectedValue(new Error('Not found')),
        },
      }
      ;(getCoreClient as ReturnType<typeof vi.fn>).mockReturnValue(mockCore)

      const config = await getGuildGeneralConfig('test-guild')

      expect(config.prefix).toBe('!')
      expect(config.timezone).toBe('UTC')
    })
  })

  describe('getGuildAIConfig', () => {
    it('should fetch AI config from database', async () => {
      const { getPrisma } = await import('../db/client.js')
      const mockPrisma = {
        guildAIConfig: {
          findUnique: vi.fn().mockResolvedValue({
            guildId: 'test-guild',
            primaryModel: 'claude-sonnet-4-20250514',
            lookupModel: 'claude-haiku-4-20250514',
            thinkingModel: 'claude-sonnet-4-20250514',
            temperature: 0.7,
            maxTokens: 2000,
            enableThinking: true,
            enableLookup: true,
            enableContext: true,
            enableMemory: true,
            maxContextMessages: 20,
            contextWindowHours: 24,
            customSettings: {},
          }),
        },
      }
      ;(getPrisma as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma)

      const config = await getGuildAIConfig('test-guild')

      expect(config.primaryModel).toBe('claude-sonnet-4-20250514')
      expect(config.temperature).toBe(0.7)
      expect(config.enableThinking).toBe(true)
    })

    it('should return defaults when no config exists', async () => {
      const { getPrisma } = await import('../db/client.js')
      const mockPrisma = {
        guildAIConfig: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      }
      ;(getPrisma as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma)

      const config = await getGuildAIConfig('test-guild')

      expect(config.primaryModel).toBe('claude-sonnet-4-20250514')
      expect(config.temperature).toBe(0.7)
    })
  })

  describe('getGuildConfig', () => {
    it('should fetch both general and AI configs', async () => {
      const { getCoreClient } = await import('../../lib/core-client.js')
      const { getPrisma } = await import('../db/client.js')

      const mockCore = {
        calendar: {
          getGuildConfig: vi.fn().mockResolvedValue({
            config: { prefix: '?', aiAssistant: true },
          }),
        },
      }
      ;(getCoreClient as ReturnType<typeof vi.fn>).mockReturnValue(mockCore)

      const mockPrisma = {
        guildAIConfig: {
          findUnique: vi.fn().mockResolvedValue({
            primaryModel: 'claude-sonnet-4-20250514',
            lookupModel: 'claude-haiku-4-20250514',
            thinkingModel: 'claude-sonnet-4-20250514',
            temperature: 0.8,
            maxTokens: 3000,
            enableThinking: false,
            enableLookup: true,
            enableContext: true,
            enableMemory: true,
            maxContextMessages: 30,
            contextWindowHours: 48,
            customSettings: {},
          }),
        },
      }
      ;(getPrisma as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma)

      const config = await getGuildConfig('test-guild')

      expect(config.general.prefix).toBe('?')
      expect(config.ai.temperature).toBe(0.8)
      expect(config.ai.maxTokens).toBe(3000)
      expect(config.ai.enableThinking).toBe(false)
    })
  })

  describe('updateGuildGeneralConfig', () => {
    it('should update general config in Core', async () => {
      const { getCoreClient } = await import('../../lib/core-client.js')
      const mockCore = {
        calendar: {
          setGuildConfig: vi.fn().mockResolvedValue({
            config: {
              prefix: '?',
              timezone: 'America/Los_Angeles',
            },
          }),
        },
      }
      ;(getCoreClient as ReturnType<typeof vi.fn>).mockReturnValue(mockCore)

      const config = await updateGuildGeneralConfig('test-guild', {
        prefix: '?',
        timezone: 'America/Los_Angeles',
      })

      expect(mockCore.calendar.setGuildConfig).toHaveBeenCalledWith('test-guild', {
        prefix: '?',
        timezone: 'America/Los_Angeles',
      })
      expect(config.prefix).toBe('?')
      expect(config.timezone).toBe('America/Los_Angeles')
    })
  })

  describe('updateGuildAIConfig', () => {
    it('should upsert AI config in database', async () => {
      const { getPrisma } = await import('../db/client.js')
      const mockPrisma = {
        guildAIConfig: {
          upsert: vi.fn().mockResolvedValue({
            guildId: 'test-guild',
            primaryModel: 'claude-opus-4-20241113',
            lookupModel: 'claude-haiku-4-20250514',
            thinkingModel: 'claude-sonnet-4-20250514',
            temperature: 0.9,
            maxTokens: 4000,
            enableThinking: true,
            enableLookup: true,
            enableContext: true,
            enableMemory: true,
            maxContextMessages: 20,
            contextWindowHours: 24,
            customSettings: {},
          }),
        },
      }
      ;(getPrisma as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma)

      const config = await updateGuildAIConfig('test-guild', {
        primaryModel: 'claude-opus-4-20241113',
        temperature: 0.9,
        maxTokens: 4000,
      })

      expect(mockPrisma.guildAIConfig.upsert).toHaveBeenCalled()
      expect(config.primaryModel).toBe('claude-opus-4-20241113')
      expect(config.temperature).toBe(0.9)
    })
  })

  describe('convenience helpers', () => {
    it('getGuildPrefix should return prefix', async () => {
      const { getCoreClient } = await import('../../lib/core-client.js')
      const mockCore = {
        calendar: {
          getGuildConfig: vi.fn().mockResolvedValue({
            config: { prefix: '?' },
          }),
        },
      }
      ;(getCoreClient as ReturnType<typeof vi.fn>).mockReturnValue(mockCore)

      const prefix = await getGuildPrefix('test-guild')
      expect(prefix).toBe('?')
    })

    it('getGuildAIModels should return AI model settings', async () => {
      const { getPrisma } = await import('../db/client.js')
      const mockPrisma = {
        guildAIConfig: {
          findUnique: vi.fn().mockResolvedValue({
            primaryModel: 'claude-opus-4-20241113',
            lookupModel: 'claude-haiku-4-20250514',
            thinkingModel: 'claude-sonnet-4-20250514',
            temperature: 0.8,
            maxTokens: 3000,
            enableThinking: true,
            enableLookup: true,
            enableContext: true,
            enableMemory: true,
            maxContextMessages: 20,
            contextWindowHours: 24,
            customSettings: {},
          }),
        },
      }
      ;(getPrisma as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma)

      const models = await getGuildAIModels('test-guild')

      expect(models.primaryModel).toBe('claude-opus-4-20241113')
      expect(models.lookupModel).toBe('claude-haiku-4-20250514')
      expect(models.temperature).toBe(0.8)
      expect(models.maxTokens).toBe(3000)
    })
  })
})
