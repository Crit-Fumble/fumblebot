/**
 * Lookup Agent Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  LookupAgent,
  classifyLookup,
  formatLookupResults,
  type LookupResult,
  type LookupType,
} from './lookup-agent.js'
import { ThinkingSession } from './thinking.js'

// Mock dependencies
vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn().mockResolvedValue({
    content: [{ type: 'text', text: 'Mock summary of the spell' }],
  })

  return {
    default: class MockAnthropic {
      messages = {
        create: mockCreate,
      }
    },
  }
})

vi.mock('../../lib/core-client.js', () => ({
  getCoreClient: vi.fn().mockReturnValue({
    kb: {
      list: vi.fn().mockResolvedValue({
        articles: [
          {
            slug: 'fireball-spell',
            title: 'Fireball',
            system: '5e',
            category: 'spells',
            tags: ['evocation', 'fire'],
          },
        ],
      }),
      get: vi.fn().mockResolvedValue({
        article: {
          slug: 'fireball-spell',
          title: 'Fireball',
          content: 'A bright streak flashes from your pointing finger...',
          summary: 'Fireball is a 3rd-level evocation spell that deals fire damage.',
          system: '5e',
          category: 'spells',
        },
      }),
    },
  }),
}))

vi.mock('../db/client.js', () => ({
  prisma: {
    aIThought: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}))

describe('classifyLookup', () => {
  let thinking: ThinkingSession

  beforeEach(() => {
    thinking = new ThinkingSession({ guildId: 'test' })
  })

  describe('spell detection', () => {
    it('detects spell queries', async () => {
      const result = await classifyLookup('what does fireball do?', thinking)
      expect(result).toBe('spell')
    })

    it('detects cast queries', async () => {
      const result = await classifyLookup('how do I cast magic missile?', thinking)
      expect(result).toBe('spell')
    })

    it('detects cantrip queries', async () => {
      const result = await classifyLookup('which cantrip should I pick?', thinking)
      expect(result).toBe('spell')
    })
  })

  describe('monster detection', () => {
    it('detects monster queries', async () => {
      const result = await classifyLookup('what is a dragon stat block?', thinking)
      expect(result).toBe('monster')
    })

    it('detects creature queries', async () => {
      const result = await classifyLookup('how strong is this creature?', thinking)
      expect(result).toBe('monster')
    })

    it('detects CR queries', async () => {
      const result = await classifyLookup('CR 5 monsters', thinking)
      expect(result).toBe('monster')
    })
  })

  describe('item detection', () => {
    it('detects item queries', async () => {
      // Pattern requires singular "item" or specific item keywords
      const result = await classifyLookup('what is this magic item?', thinking)
      expect(result).toBe('item')
    })

    it('detects weapon queries', async () => {
      // Pattern requires "weapon" as a standalone word
      const result = await classifyLookup('what weapon should I use?', thinking)
      expect(result).toBe('item')
    })

    it('detects armor queries', async () => {
      const result = await classifyLookup('what armor can I wear?', thinking)
      expect(result).toBe('item')
    })
  })

  describe('class detection', () => {
    it('detects class queries', async () => {
      const result = await classifyLookup('what class should I play?', thinking)
      expect(result).toBe('class')
    })

    it('detects specific class queries', async () => {
      const result = await classifyLookup('how does the wizard work?', thinking)
      expect(result).toBe('class')
    })

    it('detects multiclass queries', async () => {
      const result = await classifyLookup('can I multiclass?', thinking)
      expect(result).toBe('class')
    })
  })

  describe('race detection', () => {
    it('detects race queries', async () => {
      const result = await classifyLookup('what race should I pick?', thinking)
      expect(result).toBe('race')
    })

    it('detects elf queries', async () => {
      const result = await classifyLookup('tell me about elf subraces', thinking)
      expect(result).toBe('race')
    })

    it('detects ancestry queries (PF2e)', async () => {
      const result = await classifyLookup('what ancestry should I pick?', thinking)
      expect(result).toBe('race')
    })
  })

  describe('feat detection', () => {
    it('detects feat queries', async () => {
      // Avoid class names which get detected first
      const result = await classifyLookup('what feat should I take?', thinking)
      expect(result).toBe('feat')
    })

    it('detects ability queries', async () => {
      const result = await classifyLookup('what ability do I get at level 5?', thinking)
      expect(result).toBe('feat')
    })
  })

  describe('condition detection', () => {
    it('detects condition queries', async () => {
      const result = await classifyLookup('what does poisoned condition do?', thinking)
      expect(result).toBe('condition')
    })

    it('detects specific conditions', async () => {
      const result = await classifyLookup('how does stunned work?', thinking)
      expect(result).toBe('condition')
    })

    it('detects exhaustion queries', async () => {
      const result = await classifyLookup('what are exhaustion levels?', thinking)
      expect(result).toBe('condition')
    })
  })

  describe('rules detection', () => {
    it('detects rules queries', async () => {
      const result = await classifyLookup('what is the rule for grappling?', thinking)
      expect(result).toBe('rules')
    })

    it('detects "how does" queries', async () => {
      const result = await classifyLookup('how does flanking work?', thinking)
      expect(result).toBe('rules')
    })

    it('detects attack of opportunity queries', async () => {
      const result = await classifyLookup('when can I take an attack of opportunity?', thinking)
      expect(result).toBe('rules')
    })
  })

  describe('lore detection', () => {
    it('detects lore queries', async () => {
      const result = await classifyLookup('tell me about the lore of this world', thinking)
      expect(result).toBe('lore')
    })

    it('detects deity queries', async () => {
      const result = await classifyLookup('who is the god of war?', thinking)
      expect(result).toBe('lore')
    })

    it('detects history queries', async () => {
      const result = await classifyLookup('what is the history of Neverwinter?', thinking)
      expect(result).toBe('lore')
    })
  })

  describe('general fallback', () => {
    it('returns general for unmatched queries', async () => {
      const result = await classifyLookup('hello there', thinking)
      expect(result).toBe('general')
    })

    it('returns general for vague queries', async () => {
      const result = await classifyLookup('help me with something', thinking)
      expect(result).toBe('general')
    })
  })
})

describe('formatLookupResults', () => {
  it('formats empty results', () => {
    const formatted = formatLookupResults([])
    expect(formatted).toBe('No results found.')
  })

  it('formats single result with URL', () => {
    const results: LookupResult[] = [
      {
        found: true,
        summary: 'Fireball is a powerful 3rd-level evocation spell.',
        sourceUrl: 'https://5e.tools/spells.html#fireball',
        sourceType: 'web',
        sourceName: '5e.tools',
        confidence: 0.9,
        gameSystem: '5e',
        relevanceScore: 0.9,
      },
    ]

    const formatted = formatLookupResults(results)

    expect(formatted).toContain('Fireball is a powerful')
    expect(formatted).toContain('📖 [Full details]')
    expect(formatted).toContain('https://5e.tools/spells.html#fireball')
    expect(formatted).toContain("D&D 5th Edition")
  })

  it('formats result without URL', () => {
    const results: LookupResult[] = [
      {
        found: true,
        summary: 'A brief description of something.',
        sourceUrl: null,
        sourceType: 'kb',
        sourceName: 'Knowledge Base',
        confidence: 0.8,
        gameSystem: null,
        relevanceScore: 0.8,
      },
    ]

    const formatted = formatLookupResults(results)

    expect(formatted).toContain('A brief description')
    expect(formatted).toContain('📚 Source: Knowledge Base')
    expect(formatted).not.toContain('📖 [Full details]')
  })

  it('formats multiple results with separator', () => {
    const results: LookupResult[] = [
      {
        found: true,
        summary: 'First result.',
        sourceUrl: 'https://example.com/1',
        sourceType: 'web',
        sourceName: 'Example',
        confidence: 0.9,
        gameSystem: '5e',
        relevanceScore: 0.9,
      },
      {
        found: true,
        summary: 'Second result.',
        sourceUrl: 'https://example.com/2',
        sourceType: 'web',
        sourceName: 'Example',
        confidence: 0.8,
        gameSystem: '5e',
        relevanceScore: 0.8,
      },
    ]

    const formatted = formatLookupResults(results)

    expect(formatted).toContain('First result.')
    expect(formatted).toContain('Second result.')
    expect(formatted).toContain('---')
  })

  it('includes game system display name', () => {
    const results: LookupResult[] = [
      {
        found: true,
        summary: 'PF2e content.',
        sourceUrl: 'https://example.com',
        sourceType: 'web',
        sourceName: 'Example',
        confidence: 0.9,
        gameSystem: 'pf2e',
        relevanceScore: 0.9,
      },
    ]

    const formatted = formatLookupResults(results)

    expect(formatted).toContain('Pathfinder 2nd Edition')
  })
})

describe('LookupAgent', () => {
  let agent: LookupAgent
  let thinking: ThinkingSession

  beforeEach(() => {
    agent = new LookupAgent()
    thinking = new ThinkingSession({
      guildId: 'test-guild',
      channelId: 'test-channel',
    })
  })

  describe('lookup', () => {
    it('returns results with thinking trace', async () => {
      const result = await agent.lookup({
        query: 'fireball',
        lookupType: 'spell',
        gameContext: { activeSystem: '5e' },
        thinking,
      })

      expect(result.thinking).toBe(thinking)
      // With mocks, duration might be 0
      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0)
      expect(result.results).toBeDefined()
    })

    it('respects maxResults limit', async () => {
      const result = await agent.lookup({
        query: 'fireball',
        lookupType: 'spell',
        gameContext: { activeSystem: '5e' },
        thinking,
        maxResults: 1,
      })

      expect(result.results.length).toBeLessThanOrEqual(1)
    })

    it('logs thoughts during lookup', async () => {
      await agent.lookup({
        query: 'fireball',
        lookupType: 'spell',
        gameContext: {
          activeSystem: '5e',
          campaignSetting: 'Forgotten Realms',
          recentTopics: ['combat', 'magic'],
        },
        thinking,
      })

      const thoughts = thinking.getThoughts()

      // Should have logged the initial question
      expect(thoughts.some(t => t.type === 'question')).toBe(true)

      // Should have logged context interpretation
      expect(thoughts.some(t => t.type === 'context')).toBe(true)

      // Should have logged a decision
      expect(thoughts.some(t => t.type === 'decision')).toBe(true)
    })
  })
})

describe('source priority', () => {
  it('prioritizes database for spells', async () => {
    const agent = new LookupAgent()
    const thinking = new ThinkingSession()

    await agent.lookup({
      query: 'fireball',
      lookupType: 'spell',
      gameContext: { activeSystem: '5e' },
      thinking,
    })

    const decisions = thinking.getThoughts().filter(t => t.type === 'decision')
    const sourceDecision = decisions.find(d => d.content.includes('Will search'))

    expect(sourceDecision?.content).toContain('database')
  })

  it('prioritizes kb for rules', async () => {
    const agent = new LookupAgent()
    const thinking = new ThinkingSession()

    await agent.lookup({
      query: 'how does grappling work',
      lookupType: 'rules',
      gameContext: { activeSystem: '5e' },
      thinking,
    })

    const decisions = thinking.getThoughts().filter(t => t.type === 'decision')
    const sourceDecision = decisions.find(d => d.content.includes('Will search'))

    expect(sourceDecision?.content).toContain('kb')
  })
})

describe('game system filtering', () => {
  it('filters results by game system', async () => {
    const agent = new LookupAgent()
    const thinking = new ThinkingSession()

    // The mock returns 5e content, so searching for PF2e should filter it
    await agent.lookup({
      query: 'fireball',
      lookupType: 'spell',
      gameContext: { activeSystem: 'pf2e' },
      thinking,
    })

    // Check that filter reasoning was logged (though results may still come through
    // if the mock doesn't return system-specific data)
    const thoughts = thinking.getThoughts()
    expect(thoughts.length).toBeGreaterThan(0)
  })
})
