/**
 * AI Service Tests
 * Tests for the unified AI service (OpenAI + Anthropic)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to create mock functions that are available before imports
const {
  mockOpenAICreate,
  mockOpenAIImagesGenerate,
  mockAnthropicCreate,
  mockWebFetch,
  mockSearch5eTools,
  mockSearchFandomWiki,
  mockIsAllowed,
  mockGetAllowedDomainsMessage,
} = vi.hoisted(() => ({
  mockOpenAICreate: vi.fn(),
  mockOpenAIImagesGenerate: vi.fn(),
  mockAnthropicCreate: vi.fn(),
  mockWebFetch: vi.fn(),
  mockSearch5eTools: vi.fn(),
  mockSearchFandomWiki: vi.fn(),
  mockIsAllowed: vi.fn(),
  mockGetAllowedDomainsMessage: vi.fn(),
}));

// Unmock the AI service (it's mocked in tests/setup.ts)
vi.unmock('../../../../src/services/ai/service.js');

// Mock OpenAI SDK
vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockOpenAICreate,
        },
      };
      images = {
        generate: mockOpenAIImagesGenerate,
      };
    },
  };
});

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: mockAnthropicCreate,
      };
    },
  };
});

// Mock web service
vi.mock('../../../../src/services/web/index.js', () => ({
  webFetchService: {
    fetch: mockWebFetch,
    search5eTools: mockSearch5eTools,
    searchFandomWiki: mockSearchFandomWiki,
    isAllowed: mockIsAllowed,
    getAllowedDomainsMessage: mockGetAllowedDomainsMessage,
  },
}));

// Import after mocks are set up
import { AIService } from '../../../../src/services/ai/service.js';

describe('AIService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton
    (AIService as any).instance = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
    (AIService as any).instance = null;
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = AIService.getInstance();
      const instance2 = AIService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('initialization', () => {
    it('should initialize OpenAI client', () => {
      const service = AIService.getInstance();
      service.initializeOpenAI({ apiKey: 'test-openai-key' });
      expect(service.isProviderAvailable('openai')).toBe(true);
    });

    it('should initialize Anthropic client', () => {
      const service = AIService.getInstance();
      service.initializeAnthropic({ apiKey: 'test-anthropic-key' });
      expect(service.isProviderAvailable('anthropic')).toBe(true);
    });

    it('should return false for uninitialized providers', () => {
      const service = AIService.getInstance();
      expect(service.isProviderAvailable('openai')).toBe(false);
      expect(service.isProviderAvailable('anthropic')).toBe(false);
    });

    it('should return false for unknown providers', () => {
      const service = AIService.getInstance();
      expect(service.isProviderAvailable('unknown' as any)).toBe(false);
    });
  });

  describe('Anthropic methods', () => {
    let service: InstanceType<typeof AIService>;

    beforeEach(() => {
      service = AIService.getInstance();
      service.initializeAnthropic({ apiKey: 'test-anthropic-key' });
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Test response' }],
        model: 'claude-sonnet-4-20250514',
        usage: { input_tokens: 10, output_tokens: 20 },
      });
    });

    describe('chat', () => {
      it('should call Anthropic with messages', async () => {
        const result = await service.chat([{ role: 'user', content: 'Hello' }]);

        expect(mockAnthropicCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            model: 'claude-sonnet-4-20250514',
            messages: [{ role: 'user', content: 'Hello' }],
          })
        );
        expect(result.content).toBe('Test response');
        expect(result.provider).toBe('anthropic');
      });

      it('should include system prompt', async () => {
        await service.chat([{ role: 'user', content: 'Hello' }], 'You are helpful');

        expect(mockAnthropicCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            system: 'You are helpful',
          })
        );
      });

      it('should use custom temperature and maxTokens', async () => {
        await service.chat([{ role: 'user', content: 'Hello' }], undefined, {
          maxTokens: 500,
          temperature: 0.5,
        });

        expect(mockAnthropicCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            max_tokens: 500,
          })
        );
      });
    });

    describe('dmResponse', () => {
      it('should generate DM response with system and tone', async () => {
        const result = await service.dmResponse('The party enters the cave', '5e', 'dramatic');

        expect(mockAnthropicCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: [{ role: 'user', content: 'The party enters the cave' }],
            system: expect.stringContaining('Dungeon Master'),
          })
        );
        expect(result).toBe('Test response');
      });
    });

    describe('generateNPC', () => {
      it('should generate NPC description', async () => {
        const result = await service.generateNPC('merchant', 'steampunk');

        expect(mockAnthropicCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: [{ role: 'user', content: expect.stringContaining('merchant') }],
            system: expect.stringContaining('character designer'),
          })
        );
        expect(result).toBe('Test response');
      });
    });

    describe('generateLore', () => {
      it('should generate lore with different styles', async () => {
        await service.generateLore('The Great War', 'chronicle');

        expect(mockAnthropicCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: [{ role: 'user', content: expect.stringContaining('historical chronicle') }],
          })
        );
      });

      it('should handle unknown style', async () => {
        await service.generateLore('Dragons', 'custom-style');

        expect(mockAnthropicCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: [{ role: 'user', content: expect.stringContaining('custom-style') }],
          })
        );
      });
    });

    describe('lookup', () => {
      it('should use Haiku model for lookups', async () => {
        await service.lookup('What is a saving throw?');

        expect(mockAnthropicCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            model: 'claude-3-5-haiku-20241022',
          })
        );
      });

      it('should include context when provided', async () => {
        await service.lookup('What is AC?', 'You are a 5e rules expert');

        expect(mockAnthropicCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            system: 'You are a 5e rules expert',
          })
        );
      });
    });

    describe('lookupRule', () => {
      it('should lookup rules with system context', async () => {
        const result = await service.lookupRule('advantage', '5e');

        expect(mockAnthropicCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            system: expect.stringContaining('5e rules expert'),
          })
        );
        expect(result).toBe('Test response');
      });
    });

    describe('queryCoreConcepts', () => {
      it('should query with concept data', async () => {
        const result = await service.queryCoreConcepts('What is AC?', 'AC = Armor Class');

        expect(mockAnthropicCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            system: expect.stringContaining('AC = Armor Class'),
          })
        );
        expect(result).toBe('Test response');
      });

      it('should work without concept data', async () => {
        const result = await service.queryCoreConcepts('What is a spell slot?');

        expect(mockAnthropicCreate).toHaveBeenCalled();
        expect(result).toBe('Test response');
      });
    });

    describe('creatureBehavior', () => {
      it('should generate creature behavior', async () => {
        const result = await service.creatureBehavior('Goblin', 'cornered by adventurers', [
          'fight',
          'flee',
          'surrender',
        ]);

        expect(mockAnthropicCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: [{ role: 'user', content: expect.stringContaining('fight, flee, surrender') }],
            max_tokens: 150,
          })
        );
        expect(result).toBe('Test response');
      });

      it('should work without options list', async () => {
        await service.creatureBehavior('Dragon', 'sees intruders');

        expect(mockAnthropicCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: [{ role: 'user', content: expect.not.stringContaining('Available actions') }],
          })
        );
      });
    });

    describe('error handling', () => {
      it('should throw when Anthropic not initialized', async () => {
        (AIService as any).instance = null;
        const uninitializedService = AIService.getInstance();

        await expect(uninitializedService.chat([{ role: 'user', content: 'Hello' }])).rejects.toThrow(
          'Anthropic not initialized'
        );
      });
    });
  });

  describe('OpenAI methods', () => {
    let service: InstanceType<typeof AIService>;

    beforeEach(() => {
      service = AIService.getInstance();
      service.initializeOpenAI({ apiKey: 'test-openai-key' });
      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: 'OpenAI response' } }],
        model: 'gpt-4o',
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      });
    });

    describe('generate', () => {
      it('should call OpenAI with prompt', async () => {
        const result = await service.generate('Write a poem');

        expect(mockOpenAICreate).toHaveBeenCalledWith(
          expect.objectContaining({
            model: 'gpt-4o',
            messages: expect.arrayContaining([{ role: 'user', content: 'Write a poem' }]),
          })
        );
        expect(result.content).toBe('OpenAI response');
        expect(result.provider).toBe('openai');
      });

      it('should include system prompt', async () => {
        await service.generate('Write a poem', 'You are a poet');

        expect(mockOpenAICreate).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: expect.arrayContaining([{ role: 'system', content: 'You are a poet' }]),
          })
        );
      });
    });

    describe('generateDungeon', () => {
      it('should generate dungeon with function calling', async () => {
        const dungeonData = {
          name: 'Dark Cave',
          description: 'A spooky cave',
          rooms: [{ id: 1, name: 'Entrance', description: 'Cave entrance', encounters: [], treasure: [], connections: [2] }],
        };

        mockOpenAICreate.mockResolvedValue({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    type: 'function',
                    function: { arguments: JSON.stringify(dungeonData) },
                  },
                ],
              },
            },
          ],
        });

        const result = await service.generateDungeon({
          theme: 'undead',
          size: 'medium',
          level: 5,
        });

        expect(result).toEqual(dungeonData);
        expect(mockOpenAICreate).toHaveBeenCalledWith(
          expect.objectContaining({
            tools: expect.arrayContaining([
              expect.objectContaining({
                type: 'function',
                function: expect.objectContaining({ name: 'create_dungeon' }),
              }),
            ]),
          })
        );
      });

      it('should throw when no tool call returned', async () => {
        mockOpenAICreate.mockResolvedValue({
          choices: [{ message: { content: 'No function call' } }],
        });

        await expect(
          service.generateDungeon({ theme: 'test', size: 'small', level: 1 })
        ).rejects.toThrow('Failed to generate dungeon');
      });

      it('should throw when OpenAI not initialized', async () => {
        (AIService as any).instance = null;
        const uninitializedService = AIService.getInstance();

        await expect(
          uninitializedService.generateDungeon({ theme: 'test', size: 'small', level: 1 })
        ).rejects.toThrow('OpenAI not initialized');
      });
    });

    describe('generateEncounter', () => {
      it('should generate encounter with function calling', async () => {
        const encounterData = {
          name: 'Goblin Ambush',
          enemies: [{ name: 'Goblin', count: 4, cr: '1/4', tactics: 'Swarm' }],
        };

        mockOpenAICreate.mockResolvedValue({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    type: 'function',
                    function: { arguments: JSON.stringify(encounterData) },
                  },
                ],
              },
            },
          ],
        });

        const result = await service.generateEncounter({
          type: 'combat',
          difficulty: 'medium',
          partyLevel: 3,
          partySize: 4,
        });

        expect(result).toEqual(encounterData);
      });

      it('should include environment in prompt', async () => {
        mockOpenAICreate.mockResolvedValue({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    type: 'function',
                    function: { arguments: '{"name":"Test","enemies":[]}' },
                  },
                ],
              },
            },
          ],
        });

        await service.generateEncounter({
          type: 'combat',
          difficulty: 'hard',
          partyLevel: 5,
          partySize: 4,
          environment: 'forest',
        });

        expect(mockOpenAICreate).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: expect.arrayContaining([
              expect.objectContaining({
                content: expect.stringContaining('forest'),
              }),
            ]),
          })
        );
      });
    });

    describe('generateImage', () => {
      it('should generate image with DALL-E', async () => {
        mockOpenAIImagesGenerate.mockResolvedValue({
          data: [{ url: 'https://example.com/image.png' }],
        });

        const result = await service.generateImage('A dragon');

        expect(mockOpenAIImagesGenerate).toHaveBeenCalledWith({
          model: 'dall-e-3',
          prompt: 'A dragon',
          n: 1,
          size: '1024x1024',
          quality: 'standard',
        });
        expect(result).toBe('https://example.com/image.png');
      });

      it('should support different sizes', async () => {
        mockOpenAIImagesGenerate.mockResolvedValue({
          data: [{ url: 'https://example.com/wide.png' }],
        });

        await service.generateImage('A landscape', '1792x1024');

        expect(mockOpenAIImagesGenerate).toHaveBeenCalledWith(
          expect.objectContaining({ size: '1792x1024' })
        );
      });

      it('should return empty string if no URL', async () => {
        mockOpenAIImagesGenerate.mockResolvedValue({ data: [{}] });

        const result = await service.generateImage('Test');
        expect(result).toBe('');
      });

      it('should throw when OpenAI not initialized', async () => {
        (AIService as any).instance = null;
        const uninitializedService = AIService.getInstance();

        await expect(uninitializedService.generateImage('Test')).rejects.toThrow(
          'OpenAI not initialized'
        );
      });
    });
  });

  describe('Web fetch methods', () => {
    let service: InstanceType<typeof AIService>;

    beforeEach(() => {
      service = AIService.getInstance();
      service.initializeAnthropic({ apiKey: 'test-key' });
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Summarized content' }],
        model: 'claude-3-5-haiku-20241022',
        usage: { input_tokens: 10, output_tokens: 20 },
      });
    });

    describe('fetchAndSummarize', () => {
      it('should return content directly if short', async () => {
        mockWebFetch.mockResolvedValue({
          success: true,
          content: 'Short content',
          source: 'https://5e.tools/spells.html',
        });

        const result = await service.fetchAndSummarize('https://5e.tools/spells.html');

        expect(result.success).toBe(true);
        expect(result.content).toBe('Short content');
        expect(mockAnthropicCreate).not.toHaveBeenCalled();
      });

      it('should summarize long content', async () => {
        mockWebFetch.mockResolvedValue({
          success: true,
          content: 'A'.repeat(3000),
          source: 'https://5e.tools/spells.html',
        });

        const result = await service.fetchAndSummarize('https://5e.tools/spells.html');

        expect(result.success).toBe(true);
        expect(result.content).toContain('Summarized content');
        expect(mockAnthropicCreate).toHaveBeenCalled();
      });

      it('should handle fetch failure', async () => {
        mockWebFetch.mockResolvedValue({
          success: false,
          error: 'URL not allowed',
        });

        const result = await service.fetchAndSummarize('https://bad-site.com');

        expect(result.success).toBe(false);
        expect(result.error).toBe('URL not allowed');
      });

      it('should handle AI summarization failure gracefully', async () => {
        mockWebFetch.mockResolvedValue({
          success: true,
          content: 'A'.repeat(3000),
          source: 'https://5e.tools/spells.html',
        });
        mockAnthropicCreate.mockRejectedValue(new Error('API error'));

        const result = await service.fetchAndSummarize('https://5e.tools/spells.html');

        expect(result.success).toBe(true);
        expect(result.content).toContain('[Content truncated]');
      });
    });

    describe('search5eTools', () => {
      it('should search and format 5e.tools content', async () => {
        mockSearch5eTools.mockResolvedValue({
          success: true,
          content: 'Fireball spell data',
          source: 'https://5e.tools/spells.html#fireball',
        });

        const result = await service.search5eTools('fireball', 'spells');

        expect(result.success).toBe(true);
        expect(result.content).toContain('Summarized content');
        expect(mockAnthropicCreate).toHaveBeenCalled();
      });

      it('should handle search failure', async () => {
        mockSearch5eTools.mockResolvedValue({
          success: false,
          error: 'Not found',
        });

        const result = await service.search5eTools('nonexistent');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Not found');
      });
    });

    describe('searchFandomWiki', () => {
      it('should search Fandom wiki', async () => {
        mockSearchFandomWiki.mockResolvedValue({
          success: true,
          content: 'Drizzt is a dark elf ranger',
          source: 'https://forgottenrealms.fandom.com/wiki/Drizzt',
        });

        const result = await service.searchFandomWiki('forgottenrealms', 'Drizzt');

        expect(result.success).toBe(true);
        expect(result.content).toBe('Drizzt is a dark elf ranger');
      });
    });

    describe('searchForgottenRealms', () => {
      it('should be a convenience wrapper for searchFandomWiki', async () => {
        mockSearchFandomWiki.mockResolvedValue({
          success: true,
          content: 'Waterdeep info',
          source: 'https://forgottenrealms.fandom.com/wiki/Waterdeep',
        });

        const result = await service.searchForgottenRealms('Waterdeep');

        expect(mockSearchFandomWiki).toHaveBeenCalledWith('forgottenrealms', 'Waterdeep');
        expect(result.success).toBe(true);
      });
    });

    describe('URL validation', () => {
      it('should check if URL is allowed', () => {
        mockIsAllowed.mockReturnValue(true);
        expect(service.isUrlAllowed('https://5e.tools/spells.html')).toBe(true);

        mockIsAllowed.mockReturnValue(false);
        expect(service.isUrlAllowed('https://malicious.com')).toBe(false);
      });

      it('should return allowed domains message', () => {
        mockGetAllowedDomainsMessage.mockReturnValue('Allowed: 5e.tools, dndbeyond.com');
        expect(service.getAllowedDomains()).toBe('Allowed: 5e.tools, dndbeyond.com');
      });
    });
  });

  describe('complete method routing', () => {
    let service: InstanceType<typeof AIService>;

    beforeEach(() => {
      service = AIService.getInstance();
      service.initializeOpenAI({ apiKey: 'openai-key' });
      service.initializeAnthropic({ apiKey: 'anthropic-key' });

      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: 'OpenAI' } }],
        model: 'gpt-4o',
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      });

      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Anthropic' }],
        model: 'claude-sonnet-4-20250514',
        usage: { input_tokens: 10, output_tokens: 20 },
      });
    });

    it('should route to OpenAI when specified', async () => {
      const result = await service.complete({
        provider: 'openai',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result.provider).toBe('openai');
      expect(mockOpenAICreate).toHaveBeenCalled();
    });

    it('should route to Anthropic by default', async () => {
      const result = await service.complete({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result.provider).toBe('anthropic');
      expect(mockAnthropicCreate).toHaveBeenCalled();
    });
  });

  describe('usage tracking', () => {
    let service: InstanceType<typeof AIService>;

    beforeEach(() => {
      service = AIService.getInstance();
    });

    it('should return OpenAI usage stats', async () => {
      service.initializeOpenAI({ apiKey: 'test-key' });
      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: 'Test' } }],
        model: 'gpt-4o',
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      });

      const result = await service.generate('Test');

      expect(result.usage).toEqual({
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      });
    });

    it('should return Anthropic usage stats', async () => {
      service.initializeAnthropic({ apiKey: 'test-key' });
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Test' }],
        model: 'claude-sonnet-4-20250514',
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const result = await service.chat([{ role: 'user', content: 'Test' }]);

      expect(result.usage).toEqual({
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      });
    });
  });
});
