/**
 * MCP Tool Definitions Tests
 * Tests for all MCP tool schemas
 */

import { describe, it, expect } from 'vitest';
import {
  foundryTools,
  foundryContainerTools,
  aiTools,
  adventureTools,
  fumbleTools,
  voiceTools,
  kbTools,
  webTools,
  worldAnvilTools,
  personaTools,
  getAllTools,
} from '../../../src/mcp/tools/definitions.js';

describe('MCP Tool Definitions', () => {
  describe('Tool Schema Validation', () => {
    const allToolGroups = [
      { name: 'foundryTools', tools: foundryTools },
      { name: 'foundryContainerTools', tools: foundryContainerTools },
      { name: 'aiTools', tools: aiTools },
      { name: 'adventureTools', tools: adventureTools },
      { name: 'fumbleTools', tools: fumbleTools },
      { name: 'voiceTools', tools: voiceTools },
      { name: 'kbTools', tools: kbTools },
      { name: 'webTools', tools: webTools },
      { name: 'worldAnvilTools', tools: worldAnvilTools },
      { name: 'personaTools', tools: personaTools },
    ];

    allToolGroups.forEach(({ name, tools }) => {
      describe(name, () => {
        it('should be an array', () => {
          expect(Array.isArray(tools)).toBe(true);
        });

        it('should have at least one tool', () => {
          expect(tools.length).toBeGreaterThan(0);
        });

        tools.forEach((tool) => {
          describe(`${tool.name}`, () => {
            it('should have a valid name', () => {
              expect(tool.name).toBeDefined();
              expect(typeof tool.name).toBe('string');
              expect(tool.name.length).toBeGreaterThan(0);
            });

            it('should have a description', () => {
              expect(tool.description).toBeDefined();
              expect(typeof tool.description).toBe('string');
              expect(tool.description.length).toBeGreaterThan(0);
            });

            it('should have a valid input schema', () => {
              expect(tool.inputSchema).toBeDefined();
              expect(tool.inputSchema.type).toBe('object');
            });

            it('should have properties defined in input schema', () => {
              expect(tool.inputSchema.properties).toBeDefined();
              expect(typeof tool.inputSchema.properties).toBe('object');
            });

            it('should have required array if any properties are required', () => {
              if (tool.inputSchema.required) {
                expect(Array.isArray(tool.inputSchema.required)).toBe(true);
                tool.inputSchema.required.forEach((reqProp: string) => {
                  expect(tool.inputSchema.properties).toHaveProperty(reqProp);
                });
              }
            });
          });
        });
      });
    });
  });

  describe('getAllTools', () => {
    it('should return all tools combined', () => {
      const allTools = getAllTools();
      expect(Array.isArray(allTools)).toBe(true);
    });

    it('should include all tool groups', () => {
      const allTools = getAllTools();
      const expectedCount =
        foundryTools.length +
        foundryContainerTools.length +
        aiTools.length +
        adventureTools.length +
        fumbleTools.length +
        voiceTools.length +
        kbTools.length +
        webTools.length +
        worldAnvilTools.length +
        personaTools.length;

      expect(allTools.length).toBe(expectedCount);
    });

    it('should have unique tool names', () => {
      const allTools = getAllTools();
      const names = allTools.map((t) => t.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });
  });

  describe('Specific Tool Schemas', () => {
    describe('fumble_roll_dice', () => {
      const diceTool = fumbleTools.find((t) => t.name === 'fumble_roll_dice');

      it('should exist', () => {
        expect(diceTool).toBeDefined();
      });

      it('should require notation parameter', () => {
        expect(diceTool?.inputSchema.required).toContain('notation');
      });

      it('should have notation as string type', () => {
        expect(diceTool?.inputSchema.properties?.notation?.type).toBe('string');
      });

      it('should have optional label parameter', () => {
        expect(diceTool?.inputSchema.properties?.label).toBeDefined();
        expect(diceTool?.inputSchema.required).not.toContain('label');
      });
    });

    describe('kb_search', () => {
      const kbSearchTool = kbTools.find((t) => t.name === 'kb_search');

      it('should exist', () => {
        expect(kbSearchTool).toBeDefined();
      });

      it('should require search parameter', () => {
        expect(kbSearchTool?.inputSchema.required).toContain('search');
      });

      it('should have optional filter parameters', () => {
        expect(kbSearchTool?.inputSchema.properties?.system).toBeDefined();
        expect(kbSearchTool?.inputSchema.properties?.category).toBeDefined();
        expect(kbSearchTool?.inputSchema.properties?.tags).toBeDefined();
      });
    });

    describe('memory_remember', () => {
      const memoryTool = personaTools.find((t) => t.name === 'memory_remember');

      it('should exist', () => {
        expect(memoryTool).toBeDefined();
      });

      it('should require key and content', () => {
        expect(memoryTool?.inputSchema.required).toContain('key');
        expect(memoryTool?.inputSchema.required).toContain('content');
      });

      it('should have type enum', () => {
        expect(memoryTool?.inputSchema.properties?.type?.enum).toContain('fact');
        expect(memoryTool?.inputSchema.properties?.type?.enum).toContain('preference');
        expect(memoryTool?.inputSchema.properties?.type?.enum).toContain('correction');
        expect(memoryTool?.inputSchema.properties?.type?.enum).toContain('skill');
      });
    });

    describe('web_search_fandom_wiki', () => {
      const wikiTool = webTools.find((t) => t.name === 'web_search_fandom_wiki');

      it('should exist', () => {
        expect(wikiTool).toBeDefined();
      });

      it('should require query parameter', () => {
        expect(wikiTool?.inputSchema.required).toContain('query');
      });

      it('should support multiple wikis', () => {
        const wikis = wikiTool?.inputSchema.properties?.wiki?.enum;
        expect(wikis).toContain('forgotten-realms');
        expect(wikis).toContain('eberron');
        expect(wikis).toContain('critical-role');
        expect(wikis).toContain('pathfinder');
      });
    });

    describe('fumble_set_voice', () => {
      const voiceTool = voiceTools.find((t) => t.name === 'fumble_set_voice');

      it('should exist', () => {
        expect(voiceTool).toBeDefined();
      });

      it('should have voice enum with all voices', () => {
        const voices = voiceTool?.inputSchema.properties?.voice?.enum;
        expect(voices).toContain('orion');
        expect(voices).toContain('luna');
        expect(voices).toContain('zeus');
        expect(voices).toContain('athena');
        expect(voices).toContain('perseus');
        expect(voices).toContain('angus');
        expect(voices).toContain('stella');
      });
    });

    describe('anthropic_chat', () => {
      const chatTool = aiTools.find((t) => t.name === 'anthropic_chat');

      it('should exist', () => {
        expect(chatTool).toBeDefined();
      });

      it('should require prompt', () => {
        expect(chatTool?.inputSchema.required).toContain('prompt');
      });

      it('should have model enum', () => {
        expect(chatTool?.inputSchema.properties?.model?.enum).toContain('sonnet');
        expect(chatTool?.inputSchema.properties?.model?.enum).toContain('haiku');
      });

      it('should have temperature with numeric type', () => {
        expect(chatTool?.inputSchema.properties?.temperature?.type).toBe('number');
      });
    });

    describe('foundry_create_container', () => {
      const containerTool = foundryContainerTools.find(
        (t) => t.name === 'foundry_create_container'
      );

      it('should exist', () => {
        expect(containerTool).toBeDefined();
      });

      it('should require guildId', () => {
        expect(containerTool?.inputSchema.required).toContain('guildId');
      });

      it('should have optional worldName and foundryVersion', () => {
        expect(containerTool?.inputSchema.properties?.worldName).toBeDefined();
        expect(containerTool?.inputSchema.properties?.foundryVersion).toBeDefined();
        expect(containerTool?.inputSchema.properties?.foundryVersion?.default).toBe('12');
      });
    });
  });

  describe('Tool Naming Conventions', () => {
    it('foundry tools should start with foundry_', () => {
      foundryTools.forEach((tool) => {
        expect(tool.name.startsWith('foundry_')).toBe(true);
      });
      foundryContainerTools.forEach((tool) => {
        expect(tool.name.startsWith('foundry_')).toBe(true);
      });
    });

    it('AI tools should start with anthropic_ or openai_', () => {
      aiTools.forEach((tool) => {
        expect(
          tool.name.startsWith('anthropic_') || tool.name.startsWith('openai_')
        ).toBe(true);
      });
    });

    it('adventure tools should start with adventure_', () => {
      adventureTools.forEach((tool) => {
        expect(tool.name.startsWith('adventure_')).toBe(true);
      });
    });

    it('fumble tools should start with fumble_', () => {
      fumbleTools.forEach((tool) => {
        expect(tool.name.startsWith('fumble_')).toBe(true);
      });
      voiceTools.forEach((tool) => {
        expect(tool.name.startsWith('fumble_')).toBe(true);
      });
    });

    it('KB tools should start with kb_', () => {
      kbTools.forEach((tool) => {
        expect(tool.name.startsWith('kb_')).toBe(true);
      });
    });

    it('web tools should start with web_', () => {
      webTools.forEach((tool) => {
        expect(tool.name.startsWith('web_')).toBe(true);
      });
    });

    it('worldanvil tools should start with worldanvil_', () => {
      worldAnvilTools.forEach((tool) => {
        expect(tool.name.startsWith('worldanvil_')).toBe(true);
      });
    });

    it('persona/memory tools should start with memory_, skill_, or persona_', () => {
      personaTools.forEach((tool) => {
        expect(
          tool.name.startsWith('memory_') ||
            tool.name.startsWith('skill_') ||
            tool.name.startsWith('persona_')
        ).toBe(true);
      });
    });
  });
});
