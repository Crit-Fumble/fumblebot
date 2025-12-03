/**
 * AI Tool Handlers
 * Handles Anthropic (Claude) and OpenAI (GPT) operations
 */

import type { AIService } from '../../services/ai/service.js';
import type { MCPToolResult } from './types.js';

export class AIHandler {
  constructor(private aiService: AIService) {}

  async handle(name: string, args: any): Promise<MCPToolResult> {
    // Anthropic tools
    if (name.startsWith('anthropic_')) {
      switch (name) {
        case 'anthropic_chat':
          return await this.anthropicChat(args);
        case 'anthropic_dm_response':
          return await this.anthropicDMResponse(args);
        case 'anthropic_lookup_rule':
          return await this.anthropicLookupRule(args);
        default:
          throw new Error(`Unknown Anthropic tool: ${name}`);
      }
    }

    // OpenAI tools
    if (name.startsWith('openai_')) {
      switch (name) {
        case 'openai_chat':
          return await this.openAIGenerate(args);
        case 'openai_generate_dungeon':
          return await this.openAIGenerateDungeon(args);
        case 'openai_generate_encounter':
          return await this.openAIGenerateEncounter(args);
        default:
          throw new Error(`Unknown OpenAI tool: ${name}`);
      }
    }

    throw new Error(`Unknown AI tool: ${name}`);
  }

  private async anthropicChat(args: any): Promise<MCPToolResult> {
    const { prompt, model = 'sonnet', systemPrompt, temperature = 0.7, maxTokens = 2048 } = args;

    if (!this.aiService.isProviderAvailable('anthropic')) {
      throw new Error('Anthropic not configured');
    }

    const response = await this.aiService.chat(
      [{ role: 'user', content: prompt }],
      systemPrompt,
      { temperature, maxTokens }
    );

    return {
      content: [
        {
          type: 'text',
          text: response.content,
        },
      ],
    };
  }

  private async anthropicDMResponse(args: any): Promise<MCPToolResult> {
    const { scenario, system = 'D&D 5e', tone = 'dramatic' } = args;

    if (!this.aiService.isProviderAvailable('anthropic')) {
      throw new Error('Anthropic not configured');
    }

    const response = await this.aiService.dmResponse(scenario, system, tone);

    return {
      content: [
        {
          type: 'text',
          text: response,
        },
      ],
    };
  }

  private async anthropicLookupRule(args: any): Promise<MCPToolResult> {
    const { query, system = 'D&D 5e' } = args;

    if (!this.aiService.isProviderAvailable('anthropic')) {
      throw new Error('Anthropic not configured');
    }

    const response = await this.aiService.lookupRule(query, system);

    return {
      content: [
        {
          type: 'text',
          text: response,
        },
      ],
    };
  }

  private async openAIGenerate(args: any): Promise<MCPToolResult> {
    const { prompt, systemPrompt, temperature = 0.7, maxTokens = 2048 } = args;

    if (!this.aiService.isProviderAvailable('openai')) {
      throw new Error('OpenAI not configured');
    }

    const response = await this.aiService.generate(prompt, systemPrompt, {
      temperature,
      maxTokens,
    });

    return {
      content: [
        {
          type: 'text',
          text: response.content,
        },
      ],
    };
  }

  private async openAIGenerateDungeon(args: any): Promise<MCPToolResult> {
    const { theme, size = 'medium', level, style } = args;

    if (!this.aiService.isProviderAvailable('openai')) {
      throw new Error('OpenAI not configured');
    }

    const dungeon = await this.aiService.generateDungeon({
      theme,
      size,
      level,
      style,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(dungeon, null, 2),
        },
      ],
    };
  }

  private async openAIGenerateEncounter(args: any): Promise<MCPToolResult> {
    const { type = 'combat', difficulty = 'medium', partyLevel, partySize, environment } = args;

    if (!this.aiService.isProviderAvailable('openai')) {
      throw new Error('OpenAI not configured');
    }

    const encounter = await this.aiService.generateEncounter({
      type,
      difficulty,
      partyLevel,
      partySize,
      environment,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(encounter, null, 2),
        },
      ],
    };
  }
}
