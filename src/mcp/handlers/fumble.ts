/**
 * FumbleBot Utility Tool Handlers
 * Handles dice rolling, NPC generation, and lore generation
 */

import type { AIService } from '../../services/ai/service.js';
import type { MCPToolResult } from './types.js';

export class FumbleHandler {
  constructor(private aiService: AIService) {}

  async handle(name: string, args: any): Promise<MCPToolResult> {
    switch (name) {
      case 'fumble_roll_dice':
        return await this.rollDice(args);

      case 'fumble_generate_npc':
        return await this.generateNPC(args);

      case 'fumble_generate_lore':
        return await this.generateLore(args);

      default:
        throw new Error(`Unknown FumbleBot tool: ${name}`);
    }
  }

  private async rollDice(args: any): Promise<MCPToolResult> {
    const { notation, label } = args;

    // Simple dice roller (can be enhanced)
    const match = notation.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
    if (!match) {
      throw new Error(`Invalid dice notation: ${notation}`);
    }

    const [, numDice, sides, modifier] = match;
    const rolls: number[] = [];
    let total = 0;

    for (let i = 0; i < parseInt(numDice); i++) {
      const roll = Math.floor(Math.random() * parseInt(sides)) + 1;
      rolls.push(roll);
      total += roll;
    }

    if (modifier) {
      total += parseInt(modifier);
    }

    const result = {
      notation,
      label,
      rolls,
      total,
      modifier: modifier || '+0',
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  private async generateNPC(args: any): Promise<MCPToolResult> {
    const { type = 'random', system = 'D&D 5e' } = args;

    if (!this.aiService.isProviderAvailable('anthropic')) {
      throw new Error('Anthropic not configured (required for NPC generation)');
    }

    const response = await this.aiService.generateNPC(type, system);

    return {
      content: [
        {
          type: 'text',
          text: response,
        },
      ],
    };
  }

  private async generateLore(args: any): Promise<MCPToolResult> {
    const { topic, style = 'chronicle' } = args;

    if (!this.aiService.isProviderAvailable('anthropic')) {
      throw new Error('Anthropic not configured (required for lore generation)');
    }

    const response = await this.aiService.generateLore(topic, style);

    return {
      content: [
        {
          type: 'text',
          text: response,
        },
      ],
    };
  }
}
