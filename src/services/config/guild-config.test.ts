/**
 * Guild Configuration Service Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Create hoisted mocks for proper module mocking
const { mockPrisma, mockCoreClient } = vi.hoisted(() => ({
  mockPrisma: {
    guildAIConfig: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
  mockCoreClient: {
    calendar: {
      getGuildConfig: vi.fn(),
      setGuildConfig: vi.fn(),
    },
  },
}))

// Mock Core client
vi.mock('../../lib/core-client.js', () => ({
  getCoreClient: vi.fn(() => mockCoreClient),
}))

// Mock Prisma client - export the prisma singleton directly
vi.mock('../db/client.js', () => ({
  prisma: mockPrisma,
  getPrisma: vi.fn(() => mockPrisma), // Keep for compatibility
}))

import {
  getGuildConfig,
  getGuildGeneralConfig,
  getGuildAIConfig,
  updateGuildGeneralConfig,
  updateGuildAIConfig,
  getGuildPrefix,
  getGuildAIModels,
} from './guild-config.js'

describe('Guild Configuration Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('getGuildGeneralConfig', () => {
    it('should fetch config from Core', async () => {
      mockCoreClient.calendar.getGuildConfig.mockResolvedValue({
        config: {
          prefix: '?',
          language: 'en',
          timezone: 'America/New_York',
          aiAssistant: true,
        },
      })

      const config = await getGuildGeneralConfig('test-guild')

      expect(config.prefix).toBe('?')
      expect(config.timezone).toBe('America/New_York')
      expect(config.aiAssistant).toBe(true)
      expect(mockCoreClient.calendar.getGuildConfig).toHaveBeenCalledWith('test-guild')
    })

    it('should return defaults on error', async () => {
      mockCoreClient.calendar.getGuildConfig.mockRejectedValue(new Error('Not found'))

      const config = await getGuildGeneralConfig('test-guild')

      expect(config.prefix).toBe('!')
      expect(config.timezone).toBe('UTC')
    })

    it('should fill missing fields with defaults', async () => {
      mockCoreClient.calendar.getGuildConfig.mockResolvedValue({
        config: {
          prefix: '?',
          // Other fields not provided
        },
      })

      const config = await getGuildGeneralConfig('test-guild')

      expect(config.prefix).toBe('?')
      expect(config.language).toBe('en')
      expect(config.timezone).toBe('UTC')
      expect(config.allowDMs).toBe(true)
      expect(config.diceRolling).toBe(true)
      expect(config.voiceCommands).toBe(false)
      expect(config.aiAssistant).toBe(true)
      expect(config.knowledgeBase).toBe(true)
      expect(config.scheduling).toBe(true)
    })
  })

  describe('getGuildAIConfig', () => {
    it('should fetch AI config from database', async () => {
      mockPrisma.guildAIConfig.findUnique.mockResolvedValue({
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
      })

      const config = await getGuildAIConfig('test-guild')

      expect(config.primaryModel).toBe('claude-sonnet-4-20250514')
      expect(config.temperature).toBe(0.7)
      expect(config.enableThinking).toBe(true)
      expect(mockPrisma.guildAIConfig.findUnique).toHaveBeenCalledWith({
        where: { guildId: 'test-guild' },
      })
    })

    it('should return defaults when no config exists', async () => {
      mockPrisma.guildAIConfig.findUnique.mockResolvedValue(null)

      const config = await getGuildAIConfig('test-guild')

      expect(config.primaryModel).toBe('claude-sonnet-4-20250514')
      expect(config.lookupModel).toBe('claude-haiku-4-20250514')
      expect(config.thinkingModel).toBe('claude-sonnet-4-20250514')
      expect(config.temperature).toBe(0.7)
      expect(config.maxTokens).toBe(2000)
      expect(config.enableThinking).toBe(true)
      expect(config.enableLookup).toBe(true)
      expect(config.enableContext).toBe(true)
      expect(config.enableMemory).toBe(true)
      expect(config.maxContextMessages).toBe(20)
      expect(config.contextWindowHours).toBe(24)
    })

    it('should return defaults on database error', async () => {
      mockPrisma.guildAIConfig.findUnique.mockRejectedValue(new Error('DB error'))

      const config = await getGuildAIConfig('test-guild')

      expect(config.primaryModel).toBe('claude-sonnet-4-20250514')
      expect(config.temperature).toBe(0.7)
    })

    it('should handle null customSettings', async () => {
      mockPrisma.guildAIConfig.findUnique.mockResolvedValue({
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
        customSettings: null,
      })

      const config = await getGuildAIConfig('test-guild')

      expect(config.customSettings).toEqual({})
    })
  })

  describe('getGuildConfig', () => {
    it('should fetch both general and AI configs in parallel', async () => {
      mockCoreClient.calendar.getGuildConfig.mockResolvedValue({
        config: { prefix: '?', aiAssistant: true },
      })

      mockPrisma.guildAIConfig.findUnique.mockResolvedValue({
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
      })

      const config = await getGuildConfig('test-guild')

      expect(config.general.prefix).toBe('?')
      expect(config.ai.temperature).toBe(0.8)
      expect(config.ai.maxTokens).toBe(3000)
      expect(config.ai.enableThinking).toBe(false)
      expect(config.ai.maxContextMessages).toBe(30)
      expect(config.ai.contextWindowHours).toBe(48)
    })

    it('should return defaults for both when services fail', async () => {
      mockCoreClient.calendar.getGuildConfig.mockRejectedValue(new Error('Core down'))
      mockPrisma.guildAIConfig.findUnique.mockRejectedValue(new Error('DB down'))

      const config = await getGuildConfig('test-guild')

      expect(config.general.prefix).toBe('!')
      expect(config.ai.primaryModel).toBe('claude-sonnet-4-20250514')
    })
  })

  describe('updateGuildGeneralConfig', () => {
    it('should update general config in Core', async () => {
      mockCoreClient.calendar.setGuildConfig.mockResolvedValue({
        config: {
          prefix: '?',
          timezone: 'America/Los_Angeles',
        },
      })

      const config = await updateGuildGeneralConfig('test-guild', {
        prefix: '?',
        timezone: 'America/Los_Angeles',
      })

      expect(mockCoreClient.calendar.setGuildConfig).toHaveBeenCalledWith('test-guild', {
        prefix: '?',
        timezone: 'America/Los_Angeles',
      })
      expect(config.prefix).toBe('?')
      expect(config.timezone).toBe('America/Los_Angeles')
    })

    it('should fill missing response fields with defaults', async () => {
      mockCoreClient.calendar.setGuildConfig.mockResolvedValue({
        config: {
          prefix: '!',
        },
      })

      const config = await updateGuildGeneralConfig('test-guild', { prefix: '!' })

      expect(config.prefix).toBe('!')
      expect(config.language).toBe('en')
      expect(config.timezone).toBe('UTC')
    })
  })

  describe('updateGuildAIConfig', () => {
    it('should upsert AI config in database', async () => {
      mockPrisma.guildAIConfig.upsert.mockResolvedValue({
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
      })

      const config = await updateGuildAIConfig('test-guild', {
        primaryModel: 'claude-opus-4-20241113',
        temperature: 0.9,
        maxTokens: 4000,
      })

      expect(mockPrisma.guildAIConfig.upsert).toHaveBeenCalledWith({
        where: { guildId: 'test-guild' },
        create: {
          guildId: 'test-guild',
          primaryModel: 'claude-opus-4-20241113',
          temperature: 0.9,
          maxTokens: 4000,
        },
        update: {
          primaryModel: 'claude-opus-4-20241113',
          temperature: 0.9,
          maxTokens: 4000,
        },
      })
      expect(config.primaryModel).toBe('claude-opus-4-20241113')
      expect(config.temperature).toBe(0.9)
    })

    it('should only include provided fields in update', async () => {
      mockPrisma.guildAIConfig.upsert.mockResolvedValue({
        guildId: 'test-guild',
        primaryModel: 'claude-sonnet-4-20250514',
        lookupModel: 'claude-haiku-4-20250514',
        thinkingModel: 'claude-sonnet-4-20250514',
        temperature: 0.5,
        maxTokens: 2000,
        enableThinking: true,
        enableLookup: true,
        enableContext: true,
        enableMemory: true,
        maxContextMessages: 20,
        contextWindowHours: 24,
        customSettings: {},
      })

      await updateGuildAIConfig('test-guild', {
        temperature: 0.5,
      })

      expect(mockPrisma.guildAIConfig.upsert).toHaveBeenCalledWith({
        where: { guildId: 'test-guild' },
        create: {
          guildId: 'test-guild',
          temperature: 0.5,
        },
        update: {
          temperature: 0.5,
        },
      })
    })

    it('should handle customSettings as JSON', async () => {
      const customSettings = { webhookUrl: 'https://example.com', maxRetries: 3 }

      mockPrisma.guildAIConfig.upsert.mockResolvedValue({
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
        customSettings,
      })

      const config = await updateGuildAIConfig('test-guild', { customSettings })

      expect(config.customSettings).toEqual(customSettings)
    })

    it('should handle all boolean flags', async () => {
      mockPrisma.guildAIConfig.upsert.mockResolvedValue({
        guildId: 'test-guild',
        primaryModel: 'claude-sonnet-4-20250514',
        lookupModel: 'claude-haiku-4-20250514',
        thinkingModel: 'claude-sonnet-4-20250514',
        temperature: 0.7,
        maxTokens: 2000,
        enableThinking: false,
        enableLookup: false,
        enableContext: false,
        enableMemory: false,
        maxContextMessages: 20,
        contextWindowHours: 24,
        customSettings: {},
      })

      const config = await updateGuildAIConfig('test-guild', {
        enableThinking: false,
        enableLookup: false,
        enableContext: false,
        enableMemory: false,
      })

      expect(config.enableThinking).toBe(false)
      expect(config.enableLookup).toBe(false)
      expect(config.enableContext).toBe(false)
      expect(config.enableMemory).toBe(false)
    })
  })

  describe('convenience helpers', () => {
    describe('getGuildPrefix', () => {
      it('should return prefix from general config', async () => {
        mockCoreClient.calendar.getGuildConfig.mockResolvedValue({
          config: { prefix: '?' },
        })

        const prefix = await getGuildPrefix('test-guild')
        expect(prefix).toBe('?')
      })

      it('should return default prefix on error', async () => {
        mockCoreClient.calendar.getGuildConfig.mockRejectedValue(new Error('Failed'))

        const prefix = await getGuildPrefix('test-guild')
        expect(prefix).toBe('!')
      })
    })

    describe('getGuildAIModels', () => {
      it('should return AI model settings', async () => {
        mockPrisma.guildAIConfig.findUnique.mockResolvedValue({
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
        })

        const models = await getGuildAIModels('test-guild')

        expect(models.primaryModel).toBe('claude-opus-4-20241113')
        expect(models.lookupModel).toBe('claude-haiku-4-20250514')
        expect(models.thinkingModel).toBe('claude-sonnet-4-20250514')
        expect(models.temperature).toBe(0.8)
        expect(models.maxTokens).toBe(3000)
      })

      it('should return defaults when no config exists', async () => {
        mockPrisma.guildAIConfig.findUnique.mockResolvedValue(null)

        const models = await getGuildAIModels('test-guild')

        expect(models.primaryModel).toBe('claude-sonnet-4-20250514')
        expect(models.lookupModel).toBe('claude-haiku-4-20250514')
        expect(models.thinkingModel).toBe('claude-sonnet-4-20250514')
        expect(models.temperature).toBe(0.7)
        expect(models.maxTokens).toBe(2000)
      })
    })
  })
})
