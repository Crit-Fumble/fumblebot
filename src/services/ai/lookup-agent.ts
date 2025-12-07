/**
 * Lookup Agent
 *
 * A focused Sonnet agent that:
 * 1. Receives a query + game context
 * 2. Searches appropriate sources (KB, web, database)
 * 3. Filters results by game system
 * 4. Returns 3-4 sentence summary + hyperlink
 *
 * Uses ThinkingService to log internal reasoning.
 */

import Anthropic from '@anthropic-ai/sdk'
import { getCoreClient } from '../../lib/core-client.js'
import { ThinkingSession } from './thinking.js'
import type { GameSystem, ChannelGameContext } from '../context/types.js'
import { getSystemDisplayName } from '../context/game-system-detector.js'

// Initialize Anthropic client
const anthropic = new Anthropic()

export type LookupType =
  | 'spell'
  | 'monster'
  | 'item'
  | 'rules'
  | 'lore'
  | 'class'
  | 'race'
  | 'feat'
  | 'condition'
  | 'general'

export type SourceType = 'kb' | 'web' | 'database' | 'cache'

export interface LookupRequest {
  query: string
  lookupType: LookupType
  gameContext: Partial<ChannelGameContext>
  thinking: ThinkingSession
  maxResults?: number
}

export interface LookupResult {
  found: boolean
  summary: string           // 3-4 sentences max
  sourceUrl: string | null  // Hyperlink to full content
  sourceType: SourceType
  sourceName: string        // "5e.tools", "Knowledge Base", etc.
  confidence: number        // 0-1
  gameSystem: GameSystem | null
  relevanceScore: number    // How relevant to the query (0-1)
  rawData?: any             // Original data if needed
}

export interface LookupAgentResult {
  results: LookupResult[]
  thinking: ThinkingSession
  totalDurationMs: number
}

// Source priority by lookup type
const SOURCE_PRIORITY: Record<LookupType, SourceType[]> = {
  spell: ['database', 'kb', 'web'],
  monster: ['database', 'kb', 'web'],
  item: ['database', 'kb', 'web'],
  rules: ['kb', 'web'],
  lore: ['kb', 'web'],
  class: ['kb', 'web'],
  race: ['kb', 'web'],
  feat: ['kb', 'web'],
  condition: ['kb', 'web'],
  general: ['kb', 'web'],
}

// Web source URLs by game system
const WEB_SOURCES: Record<GameSystem, string[]> = {
  '5e': ['https://5e.tools', 'https://www.dndbeyond.com'],
  'pf2e': ['https://2e.aonprd.com', 'https://pf2easy.com'],
  'pf1e': ['https://aonprd.com', 'https://www.d20pfsrd.com'],
  'cypher': ['https://cypher-srd.com'],
  'bitd': ['https://bladesinthedark.com'],
  'swn': ['https://sectors-without-number.com'],
  'mothership': ['https://mothershiprpg.com'],
  'coc': ['https://www.chaosium.com/cthulhu'],
  'fate': ['https://fate-srd.com'],
  'pbta': ['https://www.apocalypse-world.com'],
  'savage': ['https://www.peginc.com'],
  'dcc': ['https://goodman-games.com'],
  'osr': ['https://oldschoolessentials.necroticgnome.com'],
  'other': [],
}

/**
 * Main Lookup Agent class
 */
export class LookupAgent {
  /**
   * Perform a lookup with full thinking trace
   */
  async lookup(request: LookupRequest): Promise<LookupAgentResult> {
    const startTime = Date.now()
    const { query, lookupType, gameContext, thinking, maxResults = 3 } = request

    // Log initial question
    await thinking.ask(
      `What is "${query}"? (Type: ${lookupType}, System: ${gameContext.activeSystem || 'unknown'})`
    )

    // Interpret context
    await thinking.interpretContext(
      `Game system: ${gameContext.activeSystem ? getSystemDisplayName(gameContext.activeSystem) : 'Not specified'}
Campaign setting: ${gameContext.campaignSetting || 'Not specified'}
Recent topics: ${gameContext.recentTopics?.join(', ') || 'None'}`
    )

    // Decide on search strategy
    const sources = SOURCE_PRIORITY[lookupType]
    await thinking.decide(
      `Will search: ${sources.join(' → ')}`,
      `Lookup type "${lookupType}" suggests these sources in priority order`
    )

    const results: LookupResult[] = []

    // Try each source in priority order
    for (const sourceType of sources) {
      if (results.length >= maxResults) break

      try {
        const sourceResults = await this.searchSource(
          sourceType,
          query,
          lookupType,
          gameContext,
          thinking
        )

        // Filter by game system if specified
        const filtered = await this.filterByGameSystem(
          sourceResults,
          gameContext.activeSystem ?? null,
          thinking
        )

        results.push(...filtered)
      } catch (error) {
        await thinking.reason(`Source ${sourceType} failed: ${error}`)
      }
    }

    // Summarize findings
    if (results.length > 0) {
      const bestResult = results[0]
      await thinking.summarize(
        `Found ${results.length} result(s). Best match: "${bestResult.summary.slice(0, 50)}..." from ${bestResult.sourceName}`
      )
    } else {
      await thinking.summarize(`No results found for "${query}"`)
    }

    return {
      results: results.slice(0, maxResults),
      thinking,
      totalDurationMs: Date.now() - startTime,
    }
  }

  /**
   * Search a specific source type
   */
  private async searchSource(
    sourceType: SourceType,
    query: string,
    lookupType: LookupType,
    gameContext: Partial<ChannelGameContext>,
    thinking: ThinkingSession
  ): Promise<LookupResult[]> {
    const startTime = Date.now()

    await thinking.lookup(query, [sourceType], null, {
      durationMs: 0, // Will update after
    })

    switch (sourceType) {
      case 'kb':
        return this.searchKnowledgeBase(query, lookupType, gameContext, thinking)
      case 'web':
        return this.searchWeb(query, lookupType, gameContext, thinking)
      case 'database':
        return this.searchDatabase(query, lookupType, gameContext, thinking)
      default:
        return []
    }
  }

  /**
   * Search the Knowledge Base via Core API
   */
  private async searchKnowledgeBase(
    query: string,
    lookupType: LookupType,
    gameContext: Partial<ChannelGameContext>,
    thinking: ThinkingSession
  ): Promise<LookupResult[]> {
    try {
      const coreClient = getCoreClient()

      // Map lookup type to KB category
      const category = this.lookupTypeToCategory(lookupType)

      // Build search params - Core SDK uses kb.list with search parameter
      const searchParams: {
        search?: string
        system?: string
        category?: string
        limit?: number
      } = {
        search: query,
        limit: 5,
      }

      if (category) {
        searchParams.category = category
      }

      if (gameContext.activeSystem) {
        searchParams.system = gameContext.activeSystem
      }

      // Use kb.list with search parameter
      const response = await coreClient.kb.list(searchParams)

      if (!response.articles || response.articles.length === 0) {
        await thinking.reason('KB search returned no results')
        return []
      }

      await thinking.reason(`KB returned ${response.articles.length} result(s)`)

      // Generate summaries for each result
      const results: LookupResult[] = []

      for (const listItem of response.articles.slice(0, 3)) {
        try {
          // Fetch full article to get content for summarization
          const { article: fullArticle } = await coreClient.kb.get(listItem.slug)
          const summary = await this.generateSummary(fullArticle, thinking)

          // Construct URL from slug (Core KB convention)
          const kbBaseUrl = 'https://core.crit-fumble.com/kb'
          const sourceUrl = `${kbBaseUrl}/${listItem.slug}`

          results.push({
            found: true,
            summary,
            sourceUrl,
            sourceType: 'kb',
            sourceName: 'Knowledge Base',
            confidence: 0.8,
            gameSystem: (listItem.system as GameSystem) || gameContext.activeSystem || null,
            relevanceScore: 0.8,
            rawData: fullArticle,
          })
        } catch (fetchError) {
          await thinking.reason(`Failed to fetch article ${listItem.slug}: ${fetchError}`)
          // Still include with just the title
          results.push({
            found: true,
            summary: `${listItem.title} (${listItem.category})`,
            sourceUrl: null,
            sourceType: 'kb',
            sourceName: 'Knowledge Base',
            confidence: 0.5,
            gameSystem: (listItem.system as GameSystem) || gameContext.activeSystem || null,
            relevanceScore: 0.5,
            rawData: listItem,
          })
        }
      }

      return results
    } catch (error) {
      await thinking.reason(`KB search failed: ${error}`)
      return []
    }
  }

  /**
   * Search web sources (5e.tools, etc.)
   */
  private async searchWeb(
    query: string,
    lookupType: LookupType,
    gameContext: Partial<ChannelGameContext>,
    thinking: ThinkingSession
  ): Promise<LookupResult[]> {
    // Get appropriate web sources for game system
    const system = gameContext.activeSystem || '5e'
    const sources = WEB_SOURCES[system] || WEB_SOURCES['5e']

    if (sources.length === 0) {
      await thinking.reason(`No web sources available for ${system}`)
      return []
    }

    await thinking.reason(`Will check web sources: ${sources.join(', ')}`)

    // For now, use 5e.tools search pattern for D&D
    if (system === '5e') {
      return this.search5eTools(query, lookupType, thinking)
    }

    // For other systems, we'd add specific handlers
    await thinking.reason(`Web search for ${system} not yet implemented`)
    return []
  }

  /**
   * Search 5e.tools specifically
   */
  private async search5eTools(
    query: string,
    lookupType: LookupType,
    thinking: ThinkingSession
  ): Promise<LookupResult[]> {
    // Build 5e.tools URL based on lookup type
    const typeToPath: Record<string, string> = {
      spell: 'spells',
      monster: 'bestiary',
      item: 'items',
      class: 'classes',
      race: 'races',
      feat: 'feats',
      condition: 'conditionsdiseases',
      rules: 'rules',
    }

    const path = typeToPath[lookupType] || 'search'
    const searchUrl = `https://5e.tools/${path}.html#${encodeURIComponent(query.toLowerCase().replace(/\s+/g, '%20'))}`

    await thinking.reason(`5e.tools URL: ${searchUrl}`)

    // Generate a helpful summary based on the query
    // In production, this would actually fetch and parse the page
    const summary = await this.generateWebSummary(query, lookupType, '5e', thinking)

    if (summary) {
      return [{
        found: true,
        summary,
        sourceUrl: searchUrl,
        sourceType: 'web',
        sourceName: '5e.tools',
        confidence: 0.7,
        gameSystem: '5e',
        relevanceScore: 0.7,
      }]
    }

    return []
  }

  /**
   * Search direct database (for future Core SDK expansion)
   */
  private async searchDatabase(
    query: string,
    lookupType: LookupType,
    gameContext: Partial<ChannelGameContext>,
    thinking: ThinkingSession
  ): Promise<LookupResult[]> {
    // Placeholder for direct DB access via Core SDK
    await thinking.reason('Direct database access not yet implemented')
    return []
  }

  /**
   * Filter results by game system
   */
  private async filterByGameSystem(
    results: LookupResult[],
    targetSystem: GameSystem | null,
    thinking: ThinkingSession
  ): Promise<LookupResult[]> {
    if (!targetSystem || results.length === 0) {
      return results
    }

    const filtered = results.filter(r => {
      // Keep if system matches or is null
      if (!r.gameSystem || r.gameSystem === targetSystem) {
        return true
      }

      // Log filtered results
      thinking.filter(
        `"${r.summary.slice(0, 30)}..."`,
        `System mismatch: ${r.gameSystem} ≠ ${targetSystem}`
      )

      return false
    })

    if (filtered.length < results.length) {
      await thinking.reason(
        `Filtered ${results.length - filtered.length} result(s) due to system mismatch`
      )
    }

    return filtered
  }

  /**
   * Generate a 3-4 sentence summary using Claude
   */
  private async generateSummary(
    article: any,
    thinking: ThinkingSession
  ): Promise<string> {
    // If article already has a short summary, use it
    if (article.summary && article.summary.length < 500) {
      return article.summary
    }

    // Extract content to summarize
    const content = article.content || article.description || article.title || ''

    if (content.length < 100) {
      return content
    }

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Summarize this in 3-4 sentences. Focus on the most important game mechanics or facts. Be concise:

${content.slice(0, 2000)}`
        }],
      })

      const summary = response.content[0].type === 'text'
        ? response.content[0].text
        : content.slice(0, 300)

      await thinking.reason(`Generated ${summary.length} char summary`)

      return summary
    } catch (error) {
      await thinking.reason(`Summary generation failed: ${error}`)
      return content.slice(0, 300) + '...'
    }
  }

  /**
   * Generate summary for web content
   */
  private async generateWebSummary(
    query: string,
    lookupType: LookupType,
    system: GameSystem,
    thinking: ThinkingSession
  ): Promise<string | null> {
    // Use Claude to generate a helpful pointer
    try {
      const systemName = getSystemDisplayName(system)

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: `In 2-3 sentences, briefly describe what "${query}" is in ${systemName}. If you're not sure, say so. Be factual and concise.`
        }],
      })

      const summary = response.content[0].type === 'text'
        ? response.content[0].text
        : null

      return summary
    } catch (error) {
      await thinking.reason(`Web summary generation failed: ${error}`)
      return null
    }
  }

  /**
   * Map lookup type to KB category
   */
  private lookupTypeToCategory(lookupType: LookupType): string | null {
    const mapping: Record<LookupType, string | null> = {
      spell: 'spells',
      monster: 'monsters',
      item: 'items',
      rules: 'rules',
      lore: 'lore',
      class: 'classes',
      race: 'races',
      feat: 'feats',
      condition: 'conditions',
      general: null,
    }

    return mapping[lookupType]
  }
}

/**
 * Classify what type of lookup is needed
 */
export async function classifyLookup(
  query: string,
  thinking: ThinkingSession
): Promise<LookupType> {
  await thinking.ask(`What type of lookup is "${query}"?`)

  // Pattern-based classification
  const patterns: Array<{ pattern: RegExp; type: LookupType }> = [
    { pattern: /\b(spell|cast|cantrip|magic missile|fireball|cure wounds)\b/i, type: 'spell' },
    { pattern: /\b(monster|creature|dragon|goblin|orc|demon|beast|cr\s*\d+)\b/i, type: 'monster' },
    { pattern: /\b(item|weapon|armor|sword|shield|potion|magic item|ring of)\b/i, type: 'item' },
    { pattern: /\b(class|fighter|wizard|rogue|cleric|barbarian|multiclass)\b/i, type: 'class' },
    { pattern: /\b(race|elf|dwarf|human|halfling|ancestry|heritage)\b/i, type: 'race' },
    { pattern: /\b(feat|ability|talent|feature)\b/i, type: 'feat' },
    { pattern: /\b(condition|stunned|prone|poisoned|exhaustion|frightened)\b/i, type: 'condition' },
    { pattern: /\b(rule|how (does|do)|mechanic|can i|attack of opportunity)\b/i, type: 'rules' },
    { pattern: /\b(lore|history|god|deity|kingdom|region|setting|world)\b/i, type: 'lore' },
  ]

  for (const { pattern, type } of patterns) {
    if (pattern.test(query)) {
      await thinking.decide(`Lookup type: ${type}`, `Matched pattern for ${type}`)
      return type
    }
  }

  await thinking.decide('Lookup type: general', 'No specific pattern matched')
  return 'general'
}

/**
 * Format lookup results for display
 */
export function formatLookupResults(results: LookupResult[]): string {
  if (results.length === 0) {
    return 'No results found.'
  }

  return results
    .map((r, i) => {
      let text = r.summary

      if (r.sourceUrl) {
        text += `\n📖 [Full details](${r.sourceUrl})`
      } else {
        text += `\n📚 Source: ${r.sourceName}`
      }

      if (r.gameSystem) {
        text += ` (${getSystemDisplayName(r.gameSystem)})`
      }

      return text
    })
    .join('\n\n---\n\n')
}

// Export singleton instance
export const lookupAgent = new LookupAgent()
