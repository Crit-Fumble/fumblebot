/**
 * Thinking Service Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  ThinkingSession,
  startThinking,
  formatThoughts,
  type Thought,
  type ThoughtType,
} from './thinking.js'

// Mock prisma to avoid database calls
vi.mock('../db/client.js', () => ({
  prisma: {
    aIThought: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}))

describe('ThinkingSession', () => {
  let session: ThinkingSession

  beforeEach(() => {
    session = new ThinkingSession({
      guildId: 'test-guild',
      channelId: 'test-channel',
      userId: 'test-user',
    })
  })

  describe('constructor', () => {
    it('creates a session with unique ID', () => {
      expect(session.sessionId).toBeDefined()
      expect(session.sessionId).toHaveLength(36) // UUID format
    })

    it('stores context', () => {
      expect(session.context.guildId).toBe('test-guild')
      expect(session.context.channelId).toBe('test-channel')
      expect(session.context.userId).toBe('test-user')
    })

    it('can be created without context', () => {
      const emptySession = new ThinkingSession()
      expect(emptySession.context).toEqual({})
    })
  })

  describe('think', () => {
    it('creates a thought with correct type', async () => {
      const thought = await session.think('question', 'What should I do?')

      expect(thought.type).toBe('question')
      expect(thought.content).toBe('What should I do?')
      expect(thought.sessionId).toBe(session.sessionId)
    })

    it('increments sequence numbers', async () => {
      const thought1 = await session.think('question', 'First')
      const thought2 = await session.think('reasoning', 'Second')
      const thought3 = await session.think('decision', 'Third')

      expect(thought1.sequence).toBe(0)
      expect(thought2.sequence).toBe(1)
      expect(thought3.sequence).toBe(2)
    })

    it('links thoughts via parentId', async () => {
      const thought1 = await session.think('question', 'First')
      const thought2 = await session.think('reasoning', 'Second')

      expect(thought1.parentId).toBeUndefined()
      expect(thought2.parentId).toBe(thought1.id)
    })

    it('includes options when provided', async () => {
      const thought = await session.think('lookup', 'Searching...', {
        query: 'fireball',
        sources: ['srd', 'kb'],
        confidence: 0.9,
      })

      expect(thought.options?.query).toBe('fireball')
      expect(thought.options?.sources).toEqual(['srd', 'kb'])
      expect(thought.options?.confidence).toBe(0.9)
    })
  })

  describe('ask', () => {
    it('creates a question thought', async () => {
      const thought = await session.ask('What is the DC?')

      expect(thought.type).toBe('question')
      expect(thought.content).toBe('What is the DC?')
    })
  })

  describe('reason', () => {
    it('creates a reasoning thought', async () => {
      const thought = await session.reason('The spell level is 3rd, so the slot is consumed')

      expect(thought.type).toBe('reasoning')
      expect(thought.content).toContain('spell level is 3rd')
    })
  })

  describe('lookup', () => {
    it('creates a lookup thought with query and sources', async () => {
      const thought = await session.lookup(
        'fireball spell',
        ['srd', 'knowledge-base'],
        'Found fireball details'
      )

      expect(thought.type).toBe('lookup')
      expect(thought.content).toContain('fireball spell')
      expect(thought.options?.query).toBe('fireball spell')
      expect(thought.options?.sources).toEqual(['srd', 'knowledge-base'])
      expect(thought.options?.result).toBe('Found fireball details')
    })

    it('handles null result', async () => {
      const thought = await session.lookup('unknown spell', ['srd'], null)

      expect(thought.options?.result).toBeUndefined()
    })
  })

  describe('decide', () => {
    it('creates a decision thought', async () => {
      const thought = await session.decide('Use SRD source')

      expect(thought.type).toBe('decision')
      expect(thought.content).toBe('Use SRD source')
    })

    it('includes reasoning when provided', async () => {
      const thought = await session.decide(
        'Use SRD source',
        'It has the most accurate spell data'
      )

      expect(thought.type).toBe('decision')
      expect(thought.content).toContain('Use SRD source')
      expect(thought.content).toContain('Reasoning:')
      expect(thought.content).toContain('accurate spell data')
    })
  })

  describe('filter', () => {
    it('creates a filter thought', async () => {
      const thought = await session.filter('D&D Beyond results', 'Not relevant to PF2e')

      expect(thought.type).toBe('filter')
      expect(thought.content).toContain('D&D Beyond')
      expect(thought.content).toContain('Not relevant to PF2e')
    })
  })

  describe('interpretContext', () => {
    it('creates a context thought', async () => {
      const thought = await session.interpretContext('Game system is 5e')

      expect(thought.type).toBe('context')
      expect(thought.content).toBe('Game system is 5e')
    })
  })

  describe('summarize', () => {
    it('creates a summary thought', async () => {
      const thought = await session.summarize('Found 3 relevant results')

      expect(thought.type).toBe('summary')
      expect(thought.content).toBe('Found 3 relevant results')
    })
  })

  describe('getThoughts', () => {
    it('returns all thoughts in order', async () => {
      await session.ask('Question 1')
      await session.reason('Reasoning 1')
      await session.decide('Decision 1')

      const thoughts = session.getThoughts()

      expect(thoughts).toHaveLength(3)
      expect(thoughts[0].type).toBe('question')
      expect(thoughts[1].type).toBe('reasoning')
      expect(thoughts[2].type).toBe('decision')
    })

    it('returns a copy of thoughts array', async () => {
      await session.ask('Test')

      const thoughts1 = session.getThoughts()
      const thoughts2 = session.getThoughts()

      expect(thoughts1).not.toBe(thoughts2)
      expect(thoughts1).toEqual(thoughts2)
    })
  })

  describe('getLastThought', () => {
    it('returns the most recent thought', async () => {
      await session.ask('First')
      await session.reason('Second')
      await session.decide('Third')

      const last = session.getLastThought()

      expect(last?.content).toBe('Third')
      expect(last?.type).toBe('decision')
    })

    it('returns null when no thoughts', () => {
      expect(session.getLastThought()).toBeNull()
    })
  })

  describe('createChild', () => {
    it('creates a child session with same context', async () => {
      const child = session.createChild()

      expect(child.context).toEqual(session.context)
      expect(child.sessionId).not.toBe(session.sessionId)
    })

    it('links child to parent via lastThoughtId', async () => {
      await session.ask('Parent question')
      const child = session.createChild()
      const childThought = await child.ask('Child question')

      // Child's first thought should link to parent's last thought
      expect(childThought.parentId).toBe(session.getLastThought()?.id)
    })
  })
})

describe('startThinking', () => {
  it('creates a new ThinkingSession', () => {
    const session = startThinking({ guildId: 'test' })

    expect(session).toBeInstanceOf(ThinkingSession)
    expect(session.context.guildId).toBe('test')
  })

  it('works without context', () => {
    const session = startThinking()

    expect(session).toBeInstanceOf(ThinkingSession)
  })
})

describe('formatThoughts', () => {
  it('formats thoughts with correct prefixes', () => {
    const thoughts: Thought[] = [
      createMockThought('question', 'What is this?'),
      createMockThought('reasoning', 'It looks like a spell'),
      createMockThought('lookup', 'Searching for spell'),
      createMockThought('decision', 'Use SRD'),
      createMockThought('summary', 'Found the spell'),
      createMockThought('filter', 'Filtered irrelevant'),
      createMockThought('context', 'Game is 5e'),
    ]

    const formatted = formatThoughts(thoughts)

    expect(formatted).toContain('❓ [QUESTION]')
    expect(formatted).toContain('💭 [REASONING]')
    expect(formatted).toContain('🔍 [LOOKUP]')
    expect(formatted).toContain('✅ [DECISION]')
    expect(formatted).toContain('📝 [SUMMARY]')
    expect(formatted).toContain('🚫 [FILTER]')
    expect(formatted).toContain('📋 [CONTEXT]')
  })

  it('includes query when present', () => {
    const thoughts: Thought[] = [
      createMockThought('lookup', 'Searching', { query: 'fireball' }),
    ]

    const formatted = formatThoughts(thoughts)

    expect(formatted).toContain('Query: "fireball"')
  })

  it('includes sources when present', () => {
    const thoughts: Thought[] = [
      createMockThought('lookup', 'Searching', { sources: ['srd', 'kb'] }),
    ]

    const formatted = formatThoughts(thoughts)

    expect(formatted).toContain('Sources: srd, kb')
  })

  it('truncates long results', () => {
    const longResult = 'x'.repeat(150)
    const thoughts: Thought[] = [
      createMockThought('lookup', 'Searching', { result: longResult }),
    ]

    const formatted = formatThoughts(thoughts)

    expect(formatted).toContain('...')
    expect(formatted.length).toBeLessThan(longResult.length + 100)
  })

  it('includes confidence when present', () => {
    const thoughts: Thought[] = [
      createMockThought('reasoning', 'Analysis', { confidence: 0.85 }),
    ]

    const formatted = formatThoughts(thoughts)

    expect(formatted).toContain('Confidence: 85%')
  })

  it('handles empty thoughts array', () => {
    const formatted = formatThoughts([])

    expect(formatted).toBe('')
  })
})

// Helper function to create mock thoughts for testing
function createMockThought(
  type: ThoughtType,
  content: string,
  options?: Thought['options']
): Thought {
  return {
    id: 'test-id',
    sessionId: 'test-session',
    type,
    content,
    sequence: 0,
    context: {},
    options,
    createdAt: new Date(),
  }
}
