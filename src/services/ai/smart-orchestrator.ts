/**
 * Smart Orchestrator
 *
 * Main Agent (Sonnet) that:
 * 1. Understands message context (game system, recent topics)
 * 2. Decides what lookups are needed
 * 3. Delegates to LookupAgent for summaries
 * 4. Synthesizes final response
 *
 * Uses ThinkingService to log all internal reasoning.
 */

import Anthropic from '@anthropic-ai/sdk'
import { GuildContextManager } from '../context/guild-context-manager.js'
import { detectGameSystem, extractTopics, getSystemDisplayName } from '../context/game-system-detector.js'
import type { ChannelGameContext, GameSystem } from '../context/types.js'
import { startThinking, type ThinkingSession } from './thinking.js'
import { lookupAgent, classifyLookup, formatLookupResults, type LookupResult } from './lookup-agent.js'

// Initialize Anthropic client
const anthropic = new Anthropic()

export interface OrchestratorRequest {
  content: string
  guildId: string
  channelId: string
  userId: string
  userName: string
  recentMessages?: Array<{ author: string; content: string }>
}

export interface OrchestratorResponse {
  response: string
  thinking: ThinkingSession
  lookupResults: LookupResult[]
  gameContext: Partial<ChannelGameContext>
  needsLookup: boolean
  durationMs: number
}

/**
 * Smart Orchestrator - Main Agent
 */
export class SmartOrchestrator {
  private contextManager: GuildContextManager

  constructor() {
    this.contextManager = GuildContextManager.getInstance()
  }

  /**
   * Process a message through the smart orchestration pipeline
   */
  async process(request: OrchestratorRequest): Promise<OrchestratorResponse> {
    const startTime = Date.now()

    // Start thinking session
    const thinking = startThinking({
      guildId: request.guildId,
      channelId: request.channelId,
      userId: request.userId,
    })

    await thinking.ask(`How should I respond to: "${request.content}"`)

    // Step 1: Detect and update game context
    const gameContext = await this.updateGameContext(
      request.guildId,
      request.channelId,
      request.content,
      thinking
    )

    // Step 2: Extract topics from message
    const topics = extractTopics(request.content)
    if (topics.length > 0) {
      this.contextManager.addTopics(request.guildId, request.channelId, topics)
      await thinking.interpretContext(`Detected topics: ${topics.join(', ')}`)
    }

    // Step 3: Decide if we need to look something up
    const needsLookup = await this.shouldLookup(request.content, thinking)

    let lookupResults: LookupResult[] = []

    if (needsLookup) {
      // Step 4: Classify and perform lookup
      const lookupType = await classifyLookup(request.content, thinking)

      await thinking.decide(
        `Will perform ${lookupType} lookup`,
        `Query "${request.content}" appears to need information retrieval`
      )

      const lookupResult = await lookupAgent.lookup({
        query: request.content,
        lookupType,
        gameContext,
        thinking,
      })

      lookupResults = lookupResult.results

      if (lookupResults.length > 0) {
        // Found results - format and return
        const formattedResults = formatLookupResults(lookupResults)
        await thinking.summarize(`Found ${lookupResults.length} result(s), returning formatted response`)

        return {
          response: formattedResults,
          thinking,
          lookupResults,
          gameContext,
          needsLookup: true,
          durationMs: Date.now() - startTime,
        }
      }
    }

    // Step 5: Generate conversational response with Sonnet
    await thinking.decide('Generate conversational response', needsLookup ? 'Lookup returned no results' : 'Not a lookup request')

    const response = await this.generateResponse(
      request.content,
      gameContext,
      request.recentMessages || [],
      thinking
    )

    await thinking.summarize(`Generated ${response.length} char response`)

    return {
      response,
      thinking,
      lookupResults,
      gameContext,
      needsLookup,
      durationMs: Date.now() - startTime,
    }
  }

  /**
   * Update game context based on message content
   */
  private async updateGameContext(
    guildId: string,
    channelId: string,
    content: string,
    thinking: ThinkingSession
  ): Promise<Partial<ChannelGameContext>> {
    // Get existing context
    const existingContext = this.contextManager.getGameContext(guildId, channelId)
    const { system: effectiveSystem, source } = this.contextManager.getEffectiveGameSystem(guildId, channelId)

    // Detect if message indicates a game system
    const detection = detectGameSystem(content)

    if (detection.system) {
      if (detection.isExplicit) {
        // User explicitly set the system
        await thinking.interpretContext(
          `User explicitly set game system to ${getSystemDisplayName(detection.system)}`
        )
        await this.contextManager.setGameSystem(guildId, channelId, detection.system, 'explicit')
      } else if (detection.confidence >= 0.7) {
        // High confidence inference
        await thinking.interpretContext(
          `Inferred game system: ${getSystemDisplayName(detection.system)} (${Math.round(detection.confidence * 100)}% confidence)`
        )
        await this.contextManager.inferGameSystem(guildId, channelId, detection.system, detection.confidence)
      }
    }

    // Get the updated context
    const updatedContext = this.contextManager.getOrCreateGameContext(guildId, channelId)

    // Log the context state
    await thinking.interpretContext(
      `Current context:
- System: ${updatedContext.activeSystem ? getSystemDisplayName(updatedContext.activeSystem) : 'Unknown'} (${updatedContext.systemSource})
- Setting: ${updatedContext.campaignSetting || 'Not set'}
- Recent topics: ${updatedContext.recentTopics.join(', ') || 'None'}`
    )

    return updatedContext
  }

  /**
   * Decide if the message needs a lookup
   */
  private async shouldLookup(content: string, thinking: ThinkingSession): Promise<boolean> {
    // Quick pattern check first
    const lookupPatterns = [
      /\b(what|how|tell me|look up|search|find|explain|define)\b/i,
      /\b(spell|monster|creature|item|weapon|armor|feat|class|race|rule|condition)\b/i,
      /\b(stats?|abilities?|damage|range|duration|level|cr)\b/i,
    ]

    const hasLookupPattern = lookupPatterns.some(p => p.test(content))

    if (!hasLookupPattern) {
      await thinking.reason('No lookup patterns detected, treating as chat')
      return false
    }

    // Use Sonnet for nuanced classification
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 50,
        messages: [{
          role: 'user',
          content: `Is this a request to look up TTRPG rules/content, or just chat? Answer "LOOKUP" or "CHAT":
"${content}"`
        }],
      })

      const answer = response.content[0].type === 'text' ? response.content[0].text.trim() : 'CHAT'
      const isLookup = answer.toUpperCase().includes('LOOKUP')

      await thinking.decide(
        isLookup ? 'This needs a lookup' : 'This is conversational',
        `Sonnet classification: ${answer}`
      )

      return isLookup
    } catch (error) {
      await thinking.reason(`Classification failed, defaulting to pattern match: ${hasLookupPattern}`)
      return hasLookupPattern
    }
  }

  /**
   * Generate a conversational response
   */
  private async generateResponse(
    content: string,
    gameContext: Partial<ChannelGameContext>,
    recentMessages: Array<{ author: string; content: string }>,
    thinking: ThinkingSession
  ): Promise<string> {
    const systemName = gameContext.activeSystem
      ? getSystemDisplayName(gameContext.activeSystem)
      : 'general TTRPG'

    const contextLines = recentMessages
      .slice(-5)
      .map(m => `${m.author}: ${m.content}`)
      .join('\n')

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content,
        }],
        system: `You're FumbleBot - a chill TTRPG nerd in the Crit-Fumble Discord.

Current game context:
- System: ${systemName}
- Setting: ${gameContext.campaignSetting || 'Not specified'}
- Recent topics: ${gameContext.recentTopics?.join(', ') || 'None'}

Personality:
- Casual and friendly, not corporate
- Give straight answers without preamble
- Use Discord markdown naturally
- Keep responses brief

Recent conversation:
${contextLines || '(none)'}`
      })

      if (response.content[0].type === 'text') {
        return response.content[0].text
      }

      return "Hmm, something went weird. Try that again?"
    } catch (error) {
      await thinking.reason(`Response generation failed: ${error}`)
      throw error
    }
  }
}

// Export singleton
export const smartOrchestrator = new SmartOrchestrator()

/**
 * Quick helper to process a message through the orchestrator
 */
export async function processWithOrchestrator(
  request: OrchestratorRequest
): Promise<OrchestratorResponse> {
  return smartOrchestrator.process(request)
}
