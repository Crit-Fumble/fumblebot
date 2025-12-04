/**
 * FumbleBot Utility Tool Handlers
 * Handles dice rolling, NPC generation, lore generation, and voice control
 */

import { rollDice, validateDiceNotation } from '@crit-fumble/core';
import type { AIService } from '../../services/ai/service.js';
import type { MCPToolResult } from './types.js';
import { voiceHandler } from './voice.js';

/** Voice tool names that should be delegated to VoiceHandler */
const VOICE_TOOLS = [
  'fumble_join_voice_assistant',
  'fumble_join_voice_transcribe',
  'fumble_stop_assistant',
  'fumble_stop_transcribe',
  'fumble_get_voice_status',
  'fumble_set_voice',
  'fumble_assume_role',
  'fumble_clear_role',
  'fumble_list_voices',
];

export class FumbleHandler {
  constructor(private aiService: AIService) {}

  async handle(name: string, args: any): Promise<MCPToolResult> {
    // Delegate voice tools to VoiceHandler
    if (VOICE_TOOLS.includes(name)) {
      return await voiceHandler.handle(name, args);
    }

    switch (name) {
      case 'fumble_roll_dice':
        return await this.handleRollDice(args);

      case 'fumble_generate_npc':
        return await this.generateNPC(args);

      case 'fumble_generate_lore':
        return await this.generateLore(args);

      default:
        throw new Error(`Unknown FumbleBot tool: ${name}`);
    }
  }

  private async handleRollDice(args: any): Promise<MCPToolResult> {
    const { notation, label } = args;

    // Validate notation first
    if (!validateDiceNotation(notation)) {
      throw new Error(`Invalid dice notation: ${notation}. Examples: 2d6+3, 4d6dl (drop lowest), 2d20kh (advantage), 1d20+5`);
    }

    // Use core's full-featured dice roller
    const result = rollDice(notation, label);

    // Format output for display
    let output = '';
    if (label) {
      output += `**${label}**\n`;
    }
    output += `🎲 ${result.output}\n`;
    output += `**Total: ${result.total}**`;

    if (result.isCrit) {
      output += ' 🎯 **CRITICAL HIT!**';
    } else if (result.isFumble) {
      output += ' 💀 **FUMBLE!**';
    }

    return {
      content: [
        {
          type: 'text',
          text: output,
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
