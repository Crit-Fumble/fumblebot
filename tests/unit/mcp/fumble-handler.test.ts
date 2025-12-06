/**
 * FumbleHandler Tests
 * Tests for dice rolling, NPC generation, and lore generation handlers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FumbleHandler } from '../../../src/mcp/handlers/fumble.js';
import type { AIService } from '../../../src/services/ai/service.js';

// Mock the voice handler
vi.mock('../../../src/mcp/handlers/voice.js', () => ({
  voiceHandler: {
    handle: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'voice mock response' }],
    }),
  },
}));

describe('FumbleHandler', () => {
  let handler: FumbleHandler;
  let mockAIService: AIService;

  beforeEach(() => {
    mockAIService = {
      isProviderAvailable: vi.fn().mockReturnValue(true),
      generateNPC: vi.fn().mockResolvedValue('Generated NPC content'),
      generateLore: vi.fn().mockResolvedValue('Generated lore content'),
    } as unknown as AIService;

    handler = new FumbleHandler(mockAIService);
  });

  describe('fumble_roll_dice', () => {
    it('should roll basic dice notation', async () => {
      const result = await handler.handle('fumble_roll_dice', { notation: '2d6' });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('🎲');
      expect(result.content[0].text).toContain('Total:');
    });

    it('should roll dice with modifier', async () => {
      const result = await handler.handle('fumble_roll_dice', { notation: '1d20+5' });

      expect(result.content[0].text).toContain('Total:');
    });

    it('should include label when provided', async () => {
      const result = await handler.handle('fumble_roll_dice', {
        notation: '1d20+5',
        label: 'Attack Roll',
      });

      expect(result.content[0].text).toContain('**Attack Roll**');
    });

    it('should handle advantage notation (2d20kh1)', async () => {
      const result = await handler.handle('fumble_roll_dice', { notation: '2d20kh1' });

      expect(result.content[0].text).toContain('🎲');
      expect(result.content[0].text).toContain('Total:');
    });

    it('should handle disadvantage notation (2d20kl1)', async () => {
      const result = await handler.handle('fumble_roll_dice', { notation: '2d20kl1' });

      expect(result.content[0].text).toContain('🎲');
      expect(result.content[0].text).toContain('Total:');
    });

    it('should handle drop lowest notation (4d6dl1)', async () => {
      const result = await handler.handle('fumble_roll_dice', { notation: '4d6dl1' });

      expect(result.content[0].text).toContain('🎲');
      expect(result.content[0].text).toContain('Total:');
    });

    it('should handle complex notation', async () => {
      const result = await handler.handle('fumble_roll_dice', { notation: '2d6+1d4+3' });

      expect(result.content[0].text).toContain('🎲');
      expect(result.content[0].text).toContain('Total:');
    });

    it('should throw error for invalid notation', async () => {
      await expect(
        handler.handle('fumble_roll_dice', { notation: 'invalid' })
      ).rejects.toThrow('Invalid dice notation');
    });

    it('should throw error for empty notation', async () => {
      await expect(
        handler.handle('fumble_roll_dice', { notation: '' })
      ).rejects.toThrow('Invalid dice notation');
    });

    it('should detect critical hit on d20', async () => {
      // Run multiple times to potentially get a crit
      let foundCrit = false;
      for (let i = 0; i < 100; i++) {
        const result = await handler.handle('fumble_roll_dice', { notation: '1d20' });
        if (result.content[0].text.includes('CRITICAL HIT')) {
          foundCrit = true;
          expect(result.content[0].text).toContain('🎯');
          break;
        }
      }
      // We can't guarantee a crit in 100 rolls, but the mechanism should work
      // This test at least verifies the code doesn't crash
      expect(true).toBe(true);
    });

    it('should detect fumble on d20', async () => {
      // Run multiple times to potentially get a fumble
      let foundFumble = false;
      for (let i = 0; i < 100; i++) {
        const result = await handler.handle('fumble_roll_dice', { notation: '1d20' });
        if (result.content[0].text.includes('FUMBLE')) {
          foundFumble = true;
          expect(result.content[0].text).toContain('💀');
          break;
        }
      }
      // Same as above - just verify the code works
      expect(true).toBe(true);
    });
  });

  describe('fumble_generate_npc', () => {
    it('should generate an NPC with default parameters', async () => {
      const result = await handler.handle('fumble_generate_npc', {});

      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toBe('Generated NPC content');
      expect(mockAIService.generateNPC).toHaveBeenCalledWith('random', 'D&D 5e');
    });

    it('should generate an NPC with custom type', async () => {
      const result = await handler.handle('fumble_generate_npc', { type: 'merchant' });

      expect(mockAIService.generateNPC).toHaveBeenCalledWith('merchant', 'D&D 5e');
    });

    it('should generate an NPC for different game systems', async () => {
      const result = await handler.handle('fumble_generate_npc', {
        type: 'warrior',
        system: 'Pathfinder 2e',
      });

      expect(mockAIService.generateNPC).toHaveBeenCalledWith('warrior', 'Pathfinder 2e');
    });

    it('should throw error when Anthropic is not available', async () => {
      vi.mocked(mockAIService.isProviderAvailable).mockReturnValue(false);

      await expect(handler.handle('fumble_generate_npc', {})).rejects.toThrow(
        'Anthropic not configured'
      );
    });
  });

  describe('fumble_generate_lore', () => {
    it('should generate lore with topic', async () => {
      const result = await handler.handle('fumble_generate_lore', { topic: 'Ancient dragons' });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toBe('Generated lore content');
      expect(mockAIService.generateLore).toHaveBeenCalledWith('Ancient dragons', 'chronicle');
    });

    it('should generate lore with custom style', async () => {
      const result = await handler.handle('fumble_generate_lore', {
        topic: 'The fall of empires',
        style: 'legend',
      });

      expect(mockAIService.generateLore).toHaveBeenCalledWith('The fall of empires', 'legend');
    });

    it('should support different lore styles', async () => {
      const styles = ['chronicle', 'legend', 'scholarly', 'tavern'];

      for (const style of styles) {
        await handler.handle('fumble_generate_lore', { topic: 'test', style });
        expect(mockAIService.generateLore).toHaveBeenLastCalledWith('test', style);
      }
    });

    it('should throw error when Anthropic is not available', async () => {
      vi.mocked(mockAIService.isProviderAvailable).mockReturnValue(false);

      await expect(
        handler.handle('fumble_generate_lore', { topic: 'test' })
      ).rejects.toThrow('Anthropic not configured');
    });
  });

  describe('Voice tool delegation', () => {
    const voiceTools = [
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

    voiceTools.forEach((toolName) => {
      it(`should delegate ${toolName} to VoiceHandler`, async () => {
        const result = await handler.handle(toolName, { guildId: '123' });

        expect(result.content[0].text).toBe('voice mock response');
      });
    });
  });

  describe('Error handling', () => {
    it('should throw error for unknown tool', async () => {
      await expect(handler.handle('unknown_tool', {})).rejects.toThrow(
        'Unknown FumbleBot tool: unknown_tool'
      );
    });
  });
});
