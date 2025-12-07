/**
 * Smart Orchestrator Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SmartOrchestrator, type OrchestratorRequest } from './smart-orchestrator.js'

// Create a hoisted mock that's available before imports are processed
const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn()
}))

// Mock Anthropic SDK with hoisted mock
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate }
    },
  }
})

// Mock GuildContextManager
vi.mock('../context/guild-context-manager.js', () => ({
  GuildContextManager: {
    getInstance: vi.fn().mockReturnValue({
      getGameContext: vi.fn().mockReturnValue(null),
      getEffectiveGameSystem: vi.fn().mockReturnValue({ system: '5e', source: 'default' }),
      getOrCreateGameContext: vi.fn().mockReturnValue({
        guildId: 'test-guild',
        channelId: 'test-channel',
        activeSystem: '5e',
        systemConfidence: 0.8,
        systemSource: 'default',
        campaignId: null,
        campaignSetting: null,
        recentTopics: [],
        lastActivity: new Date(),
        lastSystemChange: null,
      }),
      setGameSystem: vi.fn().mockResolvedValue(undefined),
      inferGameSystem: vi.fn().mockResolvedValue(undefined),
      addTopics: vi.fn(),
    }),
  },
}))

// Mock thinking service
vi.mock('./thinking.js', () => ({
  startThinking: vi.fn().mockReturnValue({
    ask: vi.fn().mockResolvedValue({ id: '1', type: 'question', content: 'test' }),
    reason: vi.fn().mockResolvedValue({ id: '2', type: 'reasoning', content: 'test' }),
    decide: vi.fn().mockResolvedValue({ id: '3', type: 'decision', content: 'test' }),
    summarize: vi.fn().mockResolvedValue({ id: '4', type: 'summary', content: 'test' }),
    interpretContext: vi.fn().mockResolvedValue({ id: '5', type: 'context', content: 'test' }),
    getThoughts: vi.fn().mockReturnValue([]),
    sessionId: 'test-session',
  }),
}))

// Mock lookup agent
vi.mock('./lookup-agent.js', () => ({
  lookupAgent: {
    lookup: vi.fn().mockResolvedValue({
      results: [],
      thinking: null,
      totalDurationMs: 100,
    }),
  },
  classifyLookup: vi.fn().mockResolvedValue('spell'),
  formatLookupResults: vi.fn().mockReturnValue('No results found.'),
}))

// Mock game system detector
vi.mock('../context/game-system-detector.js', () => ({
  detectGameSystem: vi.fn().mockReturnValue({
    system: null,
    confidence: 0,
    reason: 'No pattern matched',
    isExplicit: false,
  }),
  extractTopics: vi.fn().mockReturnValue([]),
  getSystemDisplayName: vi.fn().mockImplementation((system: string) => {
    const names: Record<string, string> = {
      '5e': 'D&D 5th Edition',
      'pf2e': 'Pathfinder 2nd Edition',
    }
    return names[system] || system
  }),
}))

// Mock prisma
vi.mock('../../db/client.js', () => ({
  prisma: {
    aIThought: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}))

describe('SmartOrchestrator', () => {
  let orchestrator: SmartOrchestrator

  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock response for chat classification
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'CHAT' }],
    })

    orchestrator = new SmartOrchestrator()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('process', () => {
    const baseRequest: OrchestratorRequest = {
      content: 'Hello!',
      guildId: 'test-guild',
      channelId: 'test-channel',
      userId: 'test-user',
      userName: 'TestUser',
    }

    it('returns a response object with required fields', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Hey there!' }],
      })

      const result = await orchestrator.process(baseRequest)

      expect(result).toHaveProperty('response')
      expect(result).toHaveProperty('thinking')
      expect(result).toHaveProperty('lookupResults')
      expect(result).toHaveProperty('gameContext')
      expect(result).toHaveProperty('needsLookup')
      expect(result).toHaveProperty('durationMs')
    })

    it('tracks duration in milliseconds', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Response' }],
      })

      const result = await orchestrator.process(baseRequest)

      expect(result.durationMs).toBeGreaterThanOrEqual(0)
      expect(typeof result.durationMs).toBe('number')
    })

    it('returns game context', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Response' }],
      })

      const result = await orchestrator.process(baseRequest)

      expect(result.gameContext).toBeDefined()
      expect(result.gameContext.guildId).toBe('test-guild')
      expect(result.gameContext.channelId).toBe('test-channel')
    })

    it('handles conversational messages without lookup', async () => {
      mockCreate
        .mockResolvedValueOnce({ content: [{ type: 'text', text: 'CHAT' }] })
        .mockResolvedValueOnce({ content: [{ type: 'text', text: 'Hey, how can I help?' }] })

      const result = await orchestrator.process({
        ...baseRequest,
        content: 'Hey there!',
      })

      expect(result.needsLookup).toBe(false)
      expect(result.lookupResults).toHaveLength(0)
    })

    it('detects lookup requests', async () => {
      const { lookupAgent } = await import('./lookup-agent.js')

      // Reset and configure mock for this test
      mockCreate.mockReset()
      // First call: classification returns LOOKUP
      // Second call: generate response (fallback if no results)
      mockCreate
        .mockResolvedValueOnce({ content: [{ type: 'text', text: 'LOOKUP' }] })
        .mockResolvedValueOnce({ content: [{ type: 'text', text: 'Here is info about fireball' }] })

      // Mock lookup with results
      ;(lookupAgent.lookup as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        results: [{
          found: true,
          summary: 'Fireball is a 3rd-level spell',
          sourceUrl: 'https://5e.tools/spells.html#fireball',
          sourceType: 'web',
          sourceName: '5e.tools',
          confidence: 0.9,
          gameSystem: '5e',
          relevanceScore: 0.9,
        }],
        thinking: null,
        totalDurationMs: 100,
      })

      const result = await orchestrator.process({
        ...baseRequest,
        content: 'What does fireball do?',
      })

      // Verify lookup was performed and returned results
      expect(result.needsLookup).toBe(true)
      expect(result.lookupResults.length).toBeGreaterThan(0)
    })
  })

  describe('shouldLookup patterns', () => {
    it('detects spell queries', async () => {
      // Reset and configure mock for this test
      mockCreate.mockReset()
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'LOOKUP' }],
      })

      const result = await orchestrator.process({
        content: 'what does fireball spell do?',
        guildId: 'test',
        channelId: 'test',
        userId: 'test',
        userName: 'Test',
      })

      // Verify mock was called
      expect(mockCreate).toHaveBeenCalled()
      // Even if lookup returns no results, needsLookup should be true
      expect(result.needsLookup).toBe(true)
    })

    it('detects monster queries', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'LOOKUP' }],
      })

      const result = await orchestrator.process({
        content: 'tell me about the dragon monster',
        guildId: 'test',
        channelId: 'test',
        userId: 'test',
        userName: 'Test',
      })

      expect(result.needsLookup).toBe(true)
    })

    it('detects rule questions', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'LOOKUP' }],
      })

      const result = await orchestrator.process({
        content: 'how does grappling work?',
        guildId: 'test',
        channelId: 'test',
        userId: 'test',
        userName: 'Test',
      })

      expect(result.needsLookup).toBe(true)
    })

    it('treats casual chat as non-lookup', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'CHAT' }],
      })

      const result = await orchestrator.process({
        content: 'lol that was hilarious',
        guildId: 'test',
        channelId: 'test',
        userId: 'test',
        userName: 'Test',
      })

      expect(result.needsLookup).toBe(false)
    })
  })

  describe('game context updates', () => {
    it('passes game context to response', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Response' }],
      })

      const result = await orchestrator.process({
        content: 'Hello',
        guildId: 'test-guild',
        channelId: 'test-channel',
        userId: 'test-user',
        userName: 'Test',
      })

      expect(result.gameContext).toBeDefined()
      expect(result.gameContext.activeSystem).toBe('5e')
    })

    it('updates context on explicit system declaration', async () => {
      const { detectGameSystem } = await import('../context/game-system-detector.js')

      ;(detectGameSystem as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        system: 'pf2e',
        confidence: 1.0,
        reason: 'Explicit declaration',
        isExplicit: true,
      })

      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Response' }],
      })

      await orchestrator.process({
        content: 'switching to pathfinder 2e',
        guildId: 'test-guild',
        channelId: 'test-channel',
        userId: 'test-user',
        userName: 'Test',
      })

      const { GuildContextManager } = await import('../context/guild-context-manager.js')
      const manager = GuildContextManager.getInstance()

      expect(manager.setGameSystem).toHaveBeenCalledWith(
        'test-guild',
        'test-channel',
        'pf2e',
        'explicit'
      )
    })
  })

  describe('error handling', () => {
    it('handles Anthropic API errors gracefully in classification', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API Error'))
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Fallback response' }],
      })

      // Should not throw, should fallback to pattern matching
      const result = await orchestrator.process({
        content: 'what is a goblin',
        guildId: 'test',
        channelId: 'test',
        userId: 'test',
        userName: 'Test',
      })

      expect(result).toBeDefined()
    })
  })
})

describe('processWithOrchestrator helper', () => {
  it('is exported and callable', async () => {
    const { processWithOrchestrator } = await import('./smart-orchestrator.js')
    expect(typeof processWithOrchestrator).toBe('function')
  })
})
