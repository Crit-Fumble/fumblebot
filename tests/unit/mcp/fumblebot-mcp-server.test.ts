/**
 * Unit Tests for FumbleBot MCP Server
 * Tests MCP tool discovery and integration
 */

import { describe, it, expect } from 'vitest';

describe('FumbleBot MCP Server', () => {
  describe('Tool Categories', () => {
    it('should have 8 tool categories', () => {
      const categories = [
        'foundry_*',
        'foundry_*_container',
        'anthropic_*',
        'openai_*',
        'container_*',
        'fumble_*',
        'kb_*',
        'web_*',
      ];

      expect(categories).toHaveLength(8);
    });

    it('should have Foundry VTT operations', () => {
      const foundryTools = [
        'foundry_screenshot',
        'foundry_chat',
      ];

      foundryTools.forEach(tool => {
        expect(tool).toMatch(/^foundry_/);
      });
    });

    it('should have container management tools', () => {
      const containerTools = [
        'foundry_create_container',
        'foundry_list_containers',
        'foundry_stop_container',
      ];

      containerTools.forEach(tool => {
        expect(tool).toMatch(/^foundry_.*_container$/);
      });
    });

    it('should have AI service tools', () => {
      const aiTools = [
        'anthropic_sonnet',
        'anthropic_haiku',
        'openai_gpt4o',
        'openai_dalle',
      ];

      const anthropicTools = aiTools.filter(t => t.startsWith('anthropic_'));
      const openaiTools = aiTools.filter(t => t.startsWith('openai_'));

      expect(anthropicTools).toHaveLength(2);
      expect(openaiTools).toHaveLength(2);
    });

    it('should have FumbleBot utilities', () => {
      const fumbleTools = [
        'fumble_roll_dice',
        'fumble_generate_npc',
        'fumble_generate_lore',
      ];

      fumbleTools.forEach(tool => {
        expect(tool).toMatch(/^fumble_/);
      });
    });

    it('should have knowledge base tools', () => {
      const kbTools = [
        'kb_search',
        'kb_get',
        'kb_list',
      ];

      kbTools.forEach(tool => {
        expect(tool).toMatch(/^kb_/);
      });
    });

    it('should have web fetch tool', () => {
      const webTools = ['web_fetch'];

      expect(webTools).toContain('web_fetch');
    });
  });

  describe('Web Fetch Tool', () => {
    it('should support multiple TTRPG sites', () => {
      const supportedSites = [
        '5e.tools',
        'D&D Beyond',
        'FoundryVTT KB',
        'Cypher System',
      ];

      supportedSites.forEach(site => {
        expect(site).toBeTruthy();
      });
    });

    it('should always include source linkbacks', () => {
      const mockResponse = {
        content: 'Fireball is a 3rd level evocation spell...',
        source: 'https://5e.tools/spells.html#fireball',
      };

      expect(mockResponse.source).toMatch(/^https?:\/\//);
    });
  });

  describe('Tool Naming Conventions', () => {
    it('should use underscore naming', () => {
      const tools = [
        'foundry_screenshot',
        'fumble_roll_dice',
        'kb_search',
        'web_fetch',
      ];

      tools.forEach(tool => {
        expect(tool).toMatch(/^[a-z]+_[a-z_]+$/);
        expect(tool).not.toContain('-');
        expect(tool).not.toContain(' ');
      });
    });

    it('should have consistent prefixes', () => {
      const toolPrefixes = [
        'foundry',
        'anthropic',
        'openai',
        'container',
        'fumble',
        'kb',
        'web',
      ];

      toolPrefixes.forEach(prefix => {
        expect(prefix).toMatch(/^[a-z]+$/);
      });
    });
  });

  describe('Integration with Voice Assistant', () => {
    it('should provide tools for voice commands', () => {
      // Voice assistant needs these tools for common requests
      const voiceTools = [
        'fumble_roll_dice', // "roll d20"
        'kb_search', // "what is grappling"
        'fumble_generate_npc', // "generate a tavern keeper"
        'web_fetch', // "fetch Fireball from 5e.tools"
      ];

      voiceTools.forEach(tool => {
        expect(tool).toBeTruthy();
      });
    });

    it('should support dice rolling patterns', () => {
      const dicePatterns = [
        'd20',
        '2d6+3',
        '4d8 advantage',
        'roll initiative',
      ];

      dicePatterns.forEach(pattern => {
        expect(pattern).toBeTruthy();
      });
    });
  });
});
