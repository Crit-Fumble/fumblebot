/**
 * DigitalOcean Gradient AI Platform Integration
 *
 * Uses the OpenAI-compatible API at https://inference.do-ai.run
 * This allows using cheap Llama/Mistral models for simple tasks,
 * and Claude/OpenAI via partner provider keys.
 *
 * Available Open-Source Models (billed to DO credits):
 * - llama-3.3-70b-instruct: Best open-source LLM, great for most tasks
 * - llama-3.1-8b-instruct: Fast and cheap, good for simple tasks
 * - mistral-nemo-instruct: Good balance of speed and quality
 * - deepseek-r1-distill-llama-70b: Reasoning model
 * - qwen3-32b: Strong multilingual model
 *
 * Partner Provider Models (requires adding your API key in DO Control Panel):
 * - anthropic-claude-sonnet-4, anthropic-claude-4.5-sonnet
 * - anthropic-claude-3.5-haiku, anthropic-claude-4.5-haiku
 * - openai-gpt-4o, openai-gpt-4o-mini
 *
 * Pricing (open-source models are much cheaper):
 * - Llama 3.1 8B: ~$0.20/M tokens
 * - Llama 3.3 70B: ~$0.65/M tokens
 * - Claude via partner: billed to your Anthropic account
 *
 * @see https://docs.digitalocean.com/products/gradient-ai-platform/
 */

import OpenAI from 'openai'
import type { GradientConfig } from '../../models/types.js'

export interface GradientCompletionOptions {
  model?: string
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
}

export interface GradientCompletionResult {
  content: string
  model: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/** Available Gradient model names for inference */
export type GradientModel =
  // Open-source models (billed to DO)
  | 'llama-3.3-70b-instruct'
  | 'llama-3.1-8b-instruct'
  | 'mistral-nemo-instruct'
  | 'deepseek-r1-distill-llama-70b'
  | 'qwen3-32b'
  // Claude models (requires Anthropic API key in DO Control Panel)
  | 'anthropic-claude-sonnet-4'
  | 'anthropic-claude-4.5-sonnet'
  | 'anthropic-claude-3.5-haiku'
  | 'anthropic-claude-4.5-haiku'
  // OpenAI models (requires OpenAI API key in DO Control Panel)
  | 'openai-gpt-4o'
  | 'openai-gpt-4o-mini'

/**
 * DigitalOcean Gradient AI Service
 * Uses the OpenAI SDK with Gradient's inference endpoint
 */
export class GradientService {
  private static instance: GradientService | null = null
  private config: GradientConfig | null = null
  private client: OpenAI | null = null
  private enabled = false

  private constructor() {}

  static getInstance(): GradientService {
    if (!GradientService.instance) {
      GradientService.instance = new GradientService()
    }
    return GradientService.instance
  }

  /**
   * Initialize Gradient AI with config
   */
  initialize(config: GradientConfig): void {
    this.config = config

    // Create OpenAI client pointing to Gradient's inference API
    this.client = new OpenAI({
      apiKey: config.inferenceKey,
      baseURL: config.baseUrl || 'https://inference.do-ai.run/v1',
    })

    this.enabled = true
    console.log('[Gradient AI] Initialized with base URL:', config.baseUrl || 'https://inference.do-ai.run/v1')
    console.log('[Gradient AI] Default model:', config.defaultModel || 'llama-3.3-70b-instruct')
  }

  /**
   * Check if Gradient is available
   */
  isAvailable(): boolean {
    return this.enabled && this.client !== null
  }

  /**
   * Generate text completion using Gradient models
   *
   * @example
   * // Use cheap Llama for simple tasks
   * const result = await gradient.complete('Explain grappling in D&D 5e', {
   *   model: 'llama-3.3-70b-instruct'
   * })
   *
   * @example
   * // Use Claude via partner key (if configured in DO Control Panel)
   * const result = await gradient.complete('Write creative prose', {
   *   model: 'anthropic-claude-sonnet-4'
   * })
   */
  async complete(prompt: string, options: GradientCompletionOptions = {}): Promise<GradientCompletionResult> {
    if (!this.isAvailable() || !this.client) {
      throw new Error('Gradient AI not initialized')
    }

    const model = options.model || this.config?.defaultModel || 'llama-3.3-70b-instruct'

    const messages: OpenAI.ChatCompletionMessageParam[] = []

    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt })
    }

    messages.push({ role: 'user', content: prompt })

    const response = await this.client.chat.completions.create({
      model,
      messages,
      max_tokens: options.maxTokens || 2048,
      temperature: options.temperature ?? 0.7,
    })

    const choice = response.choices[0]

    return {
      content: choice?.message?.content || '',
      model: response.model,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
    }
  }

  /**
   * Chat completion with message history
   */
  async chat(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options: GradientCompletionOptions = {}
  ): Promise<GradientCompletionResult> {
    if (!this.isAvailable() || !this.client) {
      throw new Error('Gradient AI not initialized')
    }

    const model = options.model || this.config?.defaultModel || 'llama-3.3-70b-instruct'

    const apiMessages: OpenAI.ChatCompletionMessageParam[] = messages.map(m => ({
      role: m.role,
      content: m.content,
    }))

    const response = await this.client.chat.completions.create({
      model,
      messages: apiMessages,
      max_tokens: options.maxTokens || 2048,
      temperature: options.temperature ?? 0.7,
    })

    const choice = response.choices[0]

    return {
      content: choice?.message?.content || '',
      model: response.model,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
    }
  }

  /**
   * Fast lookup using the smallest/cheapest model (llama-3.1-8b)
   * Good for simple rule lookups, yes/no questions, entity extraction
   */
  async fastLookup(query: string, context?: string): Promise<GradientCompletionResult> {
    const systemPrompt = context
      ? `You are a helpful assistant. Answer the query concisely based on this context:\n\n${context}`
      : 'You are a helpful assistant. Answer the query concisely.'

    return this.complete(query, {
      model: 'llama-3.1-8b-instruct',
      systemPrompt,
      maxTokens: 500,
      temperature: 0.3,
    })
  }

  /**
   * Get cost estimate for a given token count
   * Useful for comparing Gradient vs direct Anthropic/OpenAI costs
   */
  estimateCost(tokens: number, model?: string): number {
    const selectedModel = model || this.config?.defaultModel || 'llama-3.3-70b-instruct'

    // Pricing per million tokens (approximate as of 2025)
    // Open-source models are billed to DO credits
    // Partner models are billed to your provider account
    const pricing: Record<string, number> = {
      'llama-3.1-8b-instruct': 0.20,
      'llama-3.3-70b-instruct': 0.65,
      'mistral-nemo-instruct': 0.30,
      'deepseek-r1-distill-llama-70b': 0.99,
      'qwen3-32b': 0.50,
      // Partner provider models (billed to your account)
      'anthropic-claude-sonnet-4': 3.00,
      'anthropic-claude-4.5-sonnet': 3.00,
      'anthropic-claude-3.5-haiku': 0.80,
      'anthropic-claude-4.5-haiku': 1.00,
      'openai-gpt-4o': 5.00,
      'openai-gpt-4o-mini': 0.15,
    }

    const pricePerMillion = pricing[selectedModel] || 0.65
    return (tokens / 1_000_000) * pricePerMillion
  }

  /**
   * Get the default model name
   */
  getDefaultModel(): string {
    return this.config?.defaultModel || 'llama-3.3-70b-instruct'
  }
}

export const gradient = GradientService.getInstance()
