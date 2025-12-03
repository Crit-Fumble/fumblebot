/**
 * AI Service
 * Unified interface for OpenAI and Anthropic APIs
 *
 * Provider responsibilities:
 * - Anthropic Sonnet: General chat, DM responses, NPC generation, lore
 * - Anthropic Haiku: Rules lookup, core concepts queries, creature AI behaviors
 * - OpenAI GPT-4o: Content generation, function calling, generative dungeons
 * - OpenAI DALL-E: Image generation (future)
 */

import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import type {
  AIProvider,
  AIMessage,
  AICompletionOptions,
  AICompletionResult,
  OpenAIConfig,
  AnthropicConfig,
} from '../../models/types.js'
import {
  webFetchService,
  type WebFetchResult,
} from '../web/index.js'

// Anthropic model constants
const CLAUDE_SONNET = 'claude-sonnet-4-20250514'
const CLAUDE_HAIKU = 'claude-3-5-haiku-20241022'

// OpenAI model constants
const GPT_4O = 'gpt-4o'

export class AIService {
  private static instance: AIService | null = null

  private openai: OpenAI | null = null
  private anthropic: Anthropic | null = null
  private openaiConfig: OpenAIConfig | null = null
  private anthropicConfig: AnthropicConfig | null = null

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService()
    }
    return AIService.instance
  }

  /**
   * Initialize OpenAI client
   */
  initializeOpenAI(config: OpenAIConfig): void {
    this.openai = new OpenAI({
      apiKey: config.apiKey,
    })
    this.openaiConfig = config
    console.log('[AI] OpenAI initialized (GPT-4o, DALL-E)')
  }

  /**
   * Initialize Anthropic client
   */
  initializeAnthropic(config: AnthropicConfig): void {
    this.anthropic = new Anthropic({
      apiKey: config.apiKey,
    })
    this.anthropicConfig = config
    console.log('[AI] Anthropic initialized (Sonnet, Haiku)')
  }

  /**
   * Check if a provider is available
   */
  isProviderAvailable(provider: AIProvider): boolean {
    if (provider === 'openai') return !!this.openai
    if (provider === 'anthropic') return !!this.anthropic
    return false
  }

  // ===========================================
  // ANTHROPIC SONNET - General chat & creativity
  // ===========================================

  /**
   * General chat completion using Claude Sonnet
   * Use for: DM responses, NPC generation, lore, general questions
   */
  async chat(
    messages: AIMessage[],
    systemPrompt?: string,
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<AICompletionResult> {
    return this.completeWithAnthropic({
      messages,
      systemPrompt,
      model: CLAUDE_SONNET,
      maxTokens: options?.maxTokens ?? 2048,
      temperature: options?.temperature ?? 0.7,
    })
  }

  /**
   * Generate DM/GM response for TTRPG scenarios
   */
  async dmResponse(scenario: string, system = '5e', tone = 'dramatic'): Promise<string> {
    const result = await this.chat(
      [{ role: 'user', content: scenario }],
      `You are an experienced Dungeon Master for ${system}. Generate a ${tone} response.
Include vivid descriptions and suggest any relevant dice rolls or mechanics.`,
      { temperature: 0.8 }
    )
    return result.content
  }

  /**
   * Generate NPC description
   */
  async generateNPC(type: string, setting = 'fantasy'): Promise<string> {
    const result = await this.chat(
      [{ role: 'user', content: `Generate a ${type} NPC for a ${setting} setting.` }],
      `You are a creative TTRPG character designer. Create memorable NPCs with:
- Name and appearance
- 2-3 personality traits
- Brief backstory
- A memorable quirk
- A secret or hidden motivation
- A sample quote`,
      { temperature: 0.9 }
    )
    return result.content
  }

  /**
   * Generate lore/world-building content
   */
  async generateLore(topic: string, style = 'chronicle'): Promise<string> {
    const styleMap: Record<string, string> = {
      chronicle: 'a historical chronicle written by a scholar',
      legend: 'an ancient legend passed down through generations',
      scholarly: 'an academic essay from a learned institution',
      tavern: 'a tale told by a traveling bard in a tavern',
    }

    const result = await this.chat(
      [{ role: 'user', content: `Write ${styleMap[style] || style} about: ${topic}` }],
      'You are a master storyteller and world-builder for fantasy settings.',
      { temperature: 0.8 }
    )
    return result.content
  }

  // ===========================================
  // ANTHROPIC HAIKU - Fast lookups & simple AI
  // ===========================================

  /**
   * Quick lookup using Claude Haiku
   * Use for: Rules queries, core concepts, creature behaviors
   */
  async lookup(
    query: string,
    context?: string,
    options?: { maxTokens?: number }
  ): Promise<AICompletionResult> {
    const messages: AIMessage[] = [{ role: 'user', content: query }]

    return this.completeWithAnthropic({
      messages,
      systemPrompt: context || 'Provide a concise, accurate answer.',
      model: CLAUDE_HAIKU,
      maxTokens: options?.maxTokens ?? 500,
      temperature: 0.3, // Lower temp for factual lookups
    })
  }

  /**
   * Look up TTRPG rules
   */
  async lookupRule(query: string, system = '5e'): Promise<string> {
    const result = await this.lookup(
      query,
      `You are a ${system} rules expert. Provide accurate, concise rule explanations.
Cite specific rules or page numbers when possible. Be brief but complete.`
    )
    return result.content
  }

  /**
   * Query core concepts data
   */
  async queryCoreConcepts(query: string, conceptData?: string): Promise<string> {
    const context = conceptData
      ? `You are a rules assistant. Use this reference data:\n${conceptData}\n\nAnswer questions about it accurately.`
      : 'You are a TTRPG rules assistant. Provide accurate information.'

    const result = await this.lookup(query, context)
    return result.content
  }

  /**
   * Generate creature behavior/decision (for VTT AI)
   * Fast, deterministic responses for game AI
   */
  async creatureBehavior(
    creatureType: string,
    situation: string,
    options?: string[]
  ): Promise<string> {
    const optionsList = options?.length
      ? `\n\nAvailable actions: ${options.join(', ')}`
      : ''

    const result = await this.lookup(
      `${creatureType} in situation: ${situation}${optionsList}\n\nWhat action should this creature take? Be brief.`,
      `You are a game AI determining creature behavior. Consider the creature's nature and instincts.
Respond with just the action and a one-sentence reasoning.`,
      { maxTokens: 150 }
    )
    return result.content
  }

  // ===========================================
  // OPENAI GPT-4o - Content generation & functions
  // ===========================================

  /**
   * Generate content using OpenAI GPT-4o
   * Use for: Complex content generation, function calling, structured output
   */
  async generate(
    prompt: string,
    systemPrompt?: string,
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<AICompletionResult> {
    return this.completeWithOpenAI({
      messages: [{ role: 'user', content: prompt }],
      systemPrompt,
      model: GPT_4O,
      maxTokens: options?.maxTokens ?? 2048,
      temperature: options?.temperature ?? 0.7,
    })
  }

  /**
   * Generate dungeon/encounter using function calling
   * Returns structured JSON for game use
   */
  async generateDungeon(params: {
    theme: string
    size: 'small' | 'medium' | 'large'
    level: number
    style?: string
  }): Promise<any> {
    if (!this.openai) throw new Error('OpenAI not initialized')

    const response = await this.openai.chat.completions.create({
      model: GPT_4O,
      messages: [
        {
          role: 'system',
          content: 'You are a dungeon generator for TTRPGs. Generate balanced, interesting encounters.',
        },
        {
          role: 'user',
          content: `Generate a ${params.size} ${params.theme} dungeon for level ${params.level} characters.${params.style ? ` Style: ${params.style}` : ''}`,
        },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'create_dungeon',
            description: 'Create a dungeon with rooms, encounters, and treasure',
            parameters: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Dungeon name' },
                description: { type: 'string', description: 'Brief dungeon description' },
                rooms: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'number' },
                      name: { type: 'string' },
                      description: { type: 'string' },
                      encounters: { type: 'array', items: { type: 'string' } },
                      treasure: { type: 'array', items: { type: 'string' } },
                      connections: { type: 'array', items: { type: 'number' } },
                    },
                  },
                },
                totalCR: { type: 'number', description: 'Total challenge rating' },
              },
              required: ['name', 'description', 'rooms'],
            },
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: 'create_dungeon' } },
    })

    const toolCall = response.choices[0].message.tool_calls?.[0]
    if (toolCall?.type === 'function' && toolCall.function.arguments) {
      return JSON.parse(toolCall.function.arguments)
    }

    throw new Error('Failed to generate dungeon')
  }

  /**
   * Generate encounter with structured output
   */
  async generateEncounter(params: {
    type: string
    difficulty: 'easy' | 'medium' | 'hard' | 'deadly'
    partyLevel: number
    partySize: number
    environment?: string
  }): Promise<any> {
    if (!this.openai) throw new Error('OpenAI not initialized')

    const response = await this.openai.chat.completions.create({
      model: GPT_4O,
      messages: [
        {
          role: 'system',
          content: 'You are an encounter designer. Create balanced, thematic encounters.',
        },
        {
          role: 'user',
          content: `Create a ${params.difficulty} ${params.type} encounter for ${params.partySize} level ${params.partyLevel} characters.${params.environment ? ` Environment: ${params.environment}` : ''}`,
        },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'create_encounter',
            description: 'Create a combat encounter',
            parameters: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                enemies: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      count: { type: 'number' },
                      cr: { type: 'string' },
                      tactics: { type: 'string' },
                    },
                  },
                },
                terrain: { type: 'array', items: { type: 'string' } },
                rewards: { type: 'array', items: { type: 'string' } },
                adjustedXP: { type: 'number' },
              },
              required: ['name', 'enemies'],
            },
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: 'create_encounter' } },
    })

    const toolCall = response.choices[0].message.tool_calls?.[0]
    if (toolCall?.type === 'function' && toolCall.function.arguments) {
      return JSON.parse(toolCall.function.arguments)
    }

    throw new Error('Failed to generate encounter')
  }

  // ===========================================
  // OPENAI DALL-E - Image generation (future)
  // ===========================================

  /**
   * Generate image using DALL-E
   */
  async generateImage(prompt: string, size: '1024x1024' | '1792x1024' | '1024x1792' = '1024x1024'): Promise<string> {
    if (!this.openai) throw new Error('OpenAI not initialized')

    const response = await this.openai.images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size,
      quality: 'standard',
    })

    return response.data?.[0]?.url || ''
  }

  // ===========================================
  // WEB FETCH - External TTRPG content
  // ===========================================

  /**
   * Fetch content from an external URL and summarize it
   * Only allows whitelisted TTRPG sites (5e.tools, D&D Beyond, FoundryVTT KB, Cypher)
   */
  async fetchAndSummarize(
    url: string,
    query?: string,
    options?: { maxTokens?: number }
  ): Promise<{ success: boolean; content: string; source?: string; error?: string }> {
    // Fetch the content
    const fetchResult = await webFetchService.fetch(url, { query });

    if (!fetchResult.success) {
      return {
        success: false,
        content: '',
        error: fetchResult.error,
      };
    }

    // If content is short enough, return directly
    if (fetchResult.content && fetchResult.content.length < 2000) {
      return {
        success: true,
        content: fetchResult.content,
        source: fetchResult.source,
      };
    }

    // Use AI to summarize longer content
    try {
      const summarizePrompt = query
        ? `Summarize the following content, focusing on information about "${query}":\n\n${fetchResult.content}`
        : `Summarize the following TTRPG content concisely:\n\n${fetchResult.content}`;

      const result = await this.lookup(
        summarizePrompt,
        'You are a TTRPG assistant. Provide concise, accurate summaries of game content. Include key stats, mechanics, and descriptions. IMPORTANT: Always include source citations with book name and page number when available (e.g., "PHB p.241" or "Monster Manual, p.166").',
        { maxTokens: options?.maxTokens ?? 800 }
      );

      return {
        success: true,
        content: result.content + `\n\nSource: ${fetchResult.source}`,
        source: fetchResult.source,
      };
    } catch (error) {
      // If AI summarization fails, return raw content (truncated)
      const truncated = fetchResult.content?.substring(0, 2000) + '...\n\n[Content truncated]';
      return {
        success: true,
        content: truncated + `\n\nSource: ${fetchResult.source}`,
        source: fetchResult.source,
      };
    }
  }

  /**
   * Search 5e.tools for D&D 5e content
   * Returns content, source URL, and optional screenshot
   */
  async search5eTools(
    query: string,
    category: string = 'spells'
  ): Promise<{ success: boolean; content: string; source?: string; screenshot?: string; error?: string }> {
    const fetchResult = await webFetchService.search5eTools(query, category);

    if (!fetchResult.success) {
      return {
        success: false,
        content: '',
        error: fetchResult.error,
      };
    }

    // Use AI to extract and format the relevant information
    try {
      const extractPrompt = `Extract information about "${query}" from this 5e.tools content. Format it clearly with stats, descriptions, and mechanics:\n\n${fetchResult.content}`;

      const result = await this.lookup(
        extractPrompt,
        `Extract ${category} info from 5e.tools. Format cleanly:
- Name, level/CR, type
- Key mechanics (stats, damage, duration, etc.)
- Brief description
- Source (PHB p.X, MM p.X, etc.)

Be concise. No fluff. Just the facts.`,
        { maxTokens: 600 }
      );

      return {
        success: true,
        content: result.content + `\n\nSource: ${fetchResult.source}`,
        source: fetchResult.source,
        screenshot: fetchResult.screenshot,
      };
    } catch (error) {
      return {
        success: true,
        content: fetchResult.content || '',
        source: fetchResult.source,
        screenshot: fetchResult.screenshot,
      };
    }
  }

  /**
   * Search any Fandom wiki for lore content
   * @param wiki - The wiki subdomain (e.g., 'forgottenrealms', 'eberron', 'criticalrole')
   * @param query - The search query
   */
  async searchFandomWiki(
    wiki: string,
    query: string
  ): Promise<{ success: boolean; content: string; source?: string; error?: string }> {
    const fetchResult = await webFetchService.searchFandomWiki(wiki, query);

    if (!fetchResult.success) {
      return {
        success: false,
        content: '',
        error: fetchResult.error,
      };
    }

    return {
      success: true,
      content: fetchResult.content || '',
      source: fetchResult.source,
    };
  }

  /**
   * Search Forgotten Realms Wiki for lore content (convenience wrapper)
   */
  async searchForgottenRealms(
    query: string
  ): Promise<{ success: boolean; content: string; source?: string; error?: string }> {
    return this.searchFandomWiki('forgottenrealms', query);
  }

  /**
   * Check if a URL is allowed for fetching
   */
  isUrlAllowed(url: string): boolean {
    return webFetchService.isAllowed(url);
  }

  /**
   * Get the list of allowed domains for user feedback
   */
  getAllowedDomains(): string {
    return webFetchService.getAllowedDomainsMessage();
  }

  // ===========================================
  // Low-level completion methods
  // ===========================================

  /**
   * Generic completion - routes to appropriate provider
   */
  async complete(options: AICompletionOptions & { messages: AIMessage[] }): Promise<AICompletionResult> {
    if (options.provider === 'openai') {
      return this.completeWithOpenAI(options)
    }
    return this.completeWithAnthropic(options)
  }

  private async completeWithOpenAI(
    options: AICompletionOptions & { messages: AIMessage[] }
  ): Promise<AICompletionResult> {
    if (!this.openai || !this.openaiConfig) {
      throw new Error('OpenAI not initialized')
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = []

    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt })
    }

    for (const msg of options.messages) {
      messages.push({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      })
    }

    const response = await this.openai.chat.completions.create({
      model: options.model || GPT_4O,
      messages,
      max_tokens: options.maxTokens || 2048,
      temperature: options.temperature ?? 0.7,
    })

    const choice = response.choices[0]

    return {
      content: choice.message.content || '',
      provider: 'openai',
      model: response.model,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
    }
  }

  private async completeWithAnthropic(
    options: AICompletionOptions & { messages: AIMessage[] }
  ): Promise<AICompletionResult> {
    if (!this.anthropic || !this.anthropicConfig) {
      throw new Error('Anthropic not initialized')
    }

    const messages: Anthropic.MessageParam[] = options.messages.map((msg) => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    }))

    const response = await this.anthropic.messages.create({
      model: options.model || CLAUDE_SONNET,
      max_tokens: options.maxTokens || 2048,
      system: options.systemPrompt,
      messages,
    })

    const textContent = response.content.find((c) => c.type === 'text')
    const content = textContent && 'text' in textContent ? textContent.text : ''

    return {
      content,
      provider: 'anthropic',
      model: response.model,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    }
  }
}
