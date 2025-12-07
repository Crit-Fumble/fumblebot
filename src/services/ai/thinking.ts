/**
 * AI Thinking Service
 * Logs internal reasoning, questions, and lookup decisions
 *
 * This creates a transparent "thought process" that:
 * - Helps debug AI behavior
 * - Shows how decisions were made
 * - Tracks what sources were consulted
 * - Enables learning from past reasoning
 */

import { randomUUID } from 'crypto'
import { prisma } from '../db/client.js'

export type ThoughtType =
  | 'question'    // Internal question the AI is asking
  | 'reasoning'   // Chain of thought reasoning
  | 'lookup'      // Searching for information
  | 'decision'    // Making a choice
  | 'summary'     // Summarizing findings
  | 'filter'      // Filtering irrelevant results
  | 'context'     // Loading/interpreting context

export interface ThoughtContext {
  guildId?: string
  channelId?: string
  userId?: string
}

export interface ThoughtOptions {
  query?: string
  sources?: string[]
  result?: string
  model?: string
  tokensUsed?: number
  durationMs?: number
  confidence?: number
}

export interface Thought {
  id: string
  sessionId: string
  type: ThoughtType
  content: string
  parentId?: string
  sequence: number
  context: ThoughtContext
  options?: ThoughtOptions
  createdAt: Date
}

/**
 * Thinking session - groups related thoughts together
 */
export class ThinkingSession {
  readonly sessionId: string
  readonly context: ThoughtContext
  private sequence = 0
  private lastThoughtId: string | null = null
  private thoughts: Thought[] = []

  constructor(context: ThoughtContext = {}) {
    this.sessionId = randomUUID()
    this.context = context
  }

  /**
   * Log a thought
   */
  async think(
    type: ThoughtType,
    content: string,
    options: ThoughtOptions = {}
  ): Promise<Thought> {
    const startTime = Date.now()
    const thought: Thought = {
      id: randomUUID(),
      sessionId: this.sessionId,
      type,
      content,
      parentId: this.lastThoughtId ?? undefined,
      sequence: this.sequence++,
      context: this.context,
      options,
      createdAt: new Date(),
    }

    this.thoughts.push(thought)
    this.lastThoughtId = thought.id

    // Persist to database (fire and forget for performance)
    this.persistThought(thought).catch(err => {
      console.error('[Thinking] Failed to persist thought:', err)
    })

    return thought
  }

  /**
   * Ask an internal question
   */
  async ask(question: string, options?: ThoughtOptions): Promise<Thought> {
    return this.think('question', question, options)
  }

  /**
   * Log reasoning
   */
  async reason(reasoning: string, options?: ThoughtOptions): Promise<Thought> {
    return this.think('reasoning', reasoning, options)
  }

  /**
   * Log a lookup operation
   */
  async lookup(
    query: string,
    sources: string[],
    result: string | null,
    options?: Omit<ThoughtOptions, 'query' | 'sources' | 'result'>
  ): Promise<Thought> {
    return this.think('lookup', `Looking up: ${query}`, {
      ...options,
      query,
      sources,
      result: result ?? undefined,
    })
  }

  /**
   * Log a decision
   */
  async decide(
    decision: string,
    reasoning?: string,
    options?: ThoughtOptions
  ): Promise<Thought> {
    const content = reasoning
      ? `${decision}\n\nReasoning: ${reasoning}`
      : decision
    return this.think('decision', content, options)
  }

  /**
   * Log filtering of irrelevant results
   */
  async filter(
    what: string,
    reason: string,
    options?: ThoughtOptions
  ): Promise<Thought> {
    return this.think('filter', `Filtered: ${what}\nReason: ${reason}`, options)
  }

  /**
   * Log context interpretation
   */
  async interpretContext(
    interpretation: string,
    options?: ThoughtOptions
  ): Promise<Thought> {
    return this.think('context', interpretation, options)
  }

  /**
   * Summarize the session's findings
   */
  async summarize(summary: string, options?: ThoughtOptions): Promise<Thought> {
    return this.think('summary', summary, options)
  }

  /**
   * Get all thoughts in this session
   */
  getThoughts(): Thought[] {
    return [...this.thoughts]
  }

  /**
   * Get the last thought
   */
  getLastThought(): Thought | null {
    return this.thoughts[this.thoughts.length - 1] ?? null
  }

  /**
   * Create a child session (for nested reasoning)
   */
  createChild(): ThinkingSession {
    const child = new ThinkingSession(this.context)
    // Link to parent session's last thought
    child.lastThoughtId = this.lastThoughtId
    return child
  }

  private async persistThought(thought: Thought): Promise<void> {
    try {
      await prisma.aIThought.create({
        data: {
          id: thought.id,
          sessionId: thought.sessionId,
          guildId: thought.context.guildId,
          channelId: thought.context.channelId,
          userId: thought.context.userId,
          type: thought.type,
          content: thought.content,
          query: thought.options?.query,
          sources: thought.options?.sources ?? [],
          result: thought.options?.result,
          model: thought.options?.model,
          tokensUsed: thought.options?.tokensUsed,
          durationMs: thought.options?.durationMs,
          confidence: thought.options?.confidence,
          parentId: thought.parentId,
          sequence: thought.sequence,
        },
      })
    } catch (error) {
      // Table might not exist yet
      console.warn('[Thinking] Could not persist thought (table may not exist):', error)
    }
  }
}

/**
 * Create a new thinking session
 */
export function startThinking(context: ThoughtContext = {}): ThinkingSession {
  return new ThinkingSession(context)
}

/**
 * Get thoughts for a session
 */
export async function getSessionThoughts(sessionId: string): Promise<Thought[]> {
  try {
    const thoughts = await prisma.aIThought.findMany({
      where: { sessionId },
      orderBy: { sequence: 'asc' },
    })

    return thoughts.map(t => ({
      id: t.id,
      sessionId: t.sessionId,
      type: t.type as ThoughtType,
      content: t.content,
      parentId: t.parentId ?? undefined,
      sequence: t.sequence,
      context: {
        guildId: t.guildId ?? undefined,
        channelId: t.channelId ?? undefined,
        userId: t.userId ?? undefined,
      },
      options: {
        query: t.query ?? undefined,
        sources: t.sources as string[],
        result: t.result ?? undefined,
        model: t.model ?? undefined,
        tokensUsed: t.tokensUsed ?? undefined,
        durationMs: t.durationMs ?? undefined,
        confidence: t.confidence ?? undefined,
      },
      createdAt: t.createdAt,
    }))
  } catch {
    return []
  }
}

/**
 * Get recent thoughts for a channel (for context)
 */
export async function getRecentChannelThoughts(
  guildId: string,
  channelId: string,
  limit = 20
): Promise<Thought[]> {
  try {
    const thoughts = await prisma.aIThought.findMany({
      where: { guildId, channelId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return thoughts.reverse().map(t => ({
      id: t.id,
      sessionId: t.sessionId,
      type: t.type as ThoughtType,
      content: t.content,
      parentId: t.parentId ?? undefined,
      sequence: t.sequence,
      context: {
        guildId: t.guildId ?? undefined,
        channelId: t.channelId ?? undefined,
        userId: t.userId ?? undefined,
      },
      options: {
        query: t.query ?? undefined,
        sources: t.sources as string[],
        result: t.result ?? undefined,
        model: t.model ?? undefined,
        tokensUsed: t.tokensUsed ?? undefined,
        durationMs: t.durationMs ?? undefined,
        confidence: t.confidence ?? undefined,
      },
      createdAt: t.createdAt,
    }))
  } catch {
    return []
  }
}

/**
 * Format thoughts as a readable log
 */
export function formatThoughts(thoughts: Thought[]): string {
  return thoughts
    .map(t => {
      const prefix = {
        question: '❓',
        reasoning: '💭',
        lookup: '🔍',
        decision: '✅',
        summary: '📝',
        filter: '🚫',
        context: '📋',
      }[t.type]

      let line = `${prefix} [${t.type.toUpperCase()}] ${t.content}`

      if (t.options?.query) {
        line += `\n   Query: "${t.options.query}"`
      }
      if (t.options?.sources?.length) {
        line += `\n   Sources: ${t.options.sources.join(', ')}`
      }
      if (t.options?.result) {
        const truncated = t.options.result.length > 100
          ? t.options.result.slice(0, 100) + '...'
          : t.options.result
        line += `\n   Result: ${truncated}`
      }
      if (t.options?.confidence !== undefined) {
        line += `\n   Confidence: ${Math.round(t.options.confidence * 100)}%`
      }

      return line
    })
    .join('\n\n')
}
