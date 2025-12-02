/**
 * FumbleBot MCP Server
 *
 * Unified MCP server exposing:
 * - Foundry VTT operations (screenshots, chat, etc.)
 * - AI operations (Anthropic Claude & OpenAI GPT models)
 * - FumbleBot utilities (dice rolling, NPC generation, etc.)
 * - Docker operations for Foundry instance management
 * - Knowledge Base operations (TTRPG rules, references, and guides)
 *
 * This allows AI agents to autonomously interact with all FumbleBot capabilities.
 * Non-admin Discord commands also call these MCP tools directly.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { FoundryClient, getScreenshotService } from '../services/foundry/index.js';
import { AIService } from '../services/ai/service.js';
import { getContainerClient, type UserContext } from '../services/container/index.js';
import { getCoreClient } from '../lib/core-client.js';
import { readFile } from 'fs/promises';
import type { prisma } from '../services/db/client.js';

// Configuration
const FOUNDRY_URL = process.env.FOUNDRY_URL || 'http://localhost:30000';
const FOUNDRY_API_KEY = process.env.FOUNDRY_API_KEY;

/**
 * FumbleBot MCP Server
 * Comprehensive tool server for AI agents
 */
class FumbleBotMCPServer {
  private server: Server;
  private foundryClient: FoundryClient;
  private aiService: AIService;

  constructor(prismaClient?: typeof prisma) {
    this.server = new Server(
      {
        name: 'fumblebot',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.foundryClient = new FoundryClient({
      baseUrl: FOUNDRY_URL,
      apiKey: FOUNDRY_API_KEY,
      timeout: 10000,
    });

    this.aiService = AIService.getInstance();

    this.setupHandlers();
  }

  /**
   * Set up MCP request handlers
   */
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.getTools(),
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Foundry VTT tools
        if (name.startsWith('foundry_')) {
          return await this.handleFoundryTool(name, args);
        }

        // AI tools (OpenAI & Anthropic)
        if (name.startsWith('openai_') || name.startsWith('anthropic_') || name.startsWith('ai_')) {
          return await this.handleAITool(name, args);
        }

        // FumbleBot utility tools
        if (name.startsWith('fumble_')) {
          return await this.handleFumbleTool(name, args);
        }

        // Container tools (sandboxed terminal environment)
        if (name.startsWith('container_')) {
          return await this.handleContainerTool(name, args);
        }

        // Knowledge Base tools
        if (name.startsWith('kb_')) {
          return await this.handleKBTool(name, args);
        }

        throw new Error(`Unknown tool: ${name}`);
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  /**
   * Get list of available tools
   */
  private getTools(): Tool[] {
    return [
      // === Foundry VTT Tools ===
      {
        name: 'foundry_health_check',
        description:
          'Check if Foundry VTT instance is running and accessible. Returns status information.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'foundry_screenshot',
        description:
          'Capture a screenshot of the Foundry VTT instance. Use when asked to see what\'s happening in the game.',
        inputSchema: {
          type: 'object',
          properties: {
            fullPage: {
              type: 'boolean',
              description: 'Capture full scrollable page',
              default: false,
            },
          },
        },
      },
      {
        name: 'foundry_screenshot_canvas',
        description:
          'Capture screenshot of just the game canvas/board (tokens and maps).',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'foundry_get_chat',
        description: 'Retrieve recent chat messages from Foundry VTT.',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Number of messages to retrieve',
              default: 10,
            },
          },
        },
      },
      {
        name: 'foundry_send_chat',
        description: 'Send a chat message to Foundry VTT as the bot.',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'The message to send',
            },
            type: {
              type: 'string',
              description: 'Message type',
              enum: ['ooc', 'ic', 'emote', 'whisper'],
              default: 'ooc',
            },
          },
          required: ['message'],
        },
      },

      // === AI Tools - Anthropic (Claude) ===
      {
        name: 'anthropic_chat',
        description:
          'Chat with Claude (Sonnet or Haiku). Use for general AI assistance, creative writing, analysis, DM responses, NPC generation.',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'The message to send to Claude',
            },
            model: {
              type: 'string',
              description: 'Claude model to use',
              enum: ['sonnet', 'haiku'],
              default: 'sonnet',
            },
            systemPrompt: {
              type: 'string',
              description: 'Optional system prompt to guide Claude',
            },
            temperature: {
              type: 'number',
              description: 'Creativity/randomness (0.0 to 1.0)',
              default: 0.7,
            },
            maxTokens: {
              type: 'number',
              description: 'Maximum tokens in response',
              default: 2048,
            },
          },
          required: ['prompt'],
        },
      },
      {
        name: 'anthropic_dm_response',
        description:
          'Generate a Dungeon Master response for TTRPG scenarios using Claude. Includes vivid descriptions and suggests dice rolls.',
        inputSchema: {
          type: 'object',
          properties: {
            scenario: {
              type: 'string',
              description: 'The scenario or player action to respond to',
            },
            system: {
              type: 'string',
              description: 'Game system (e.g., "D&D 5e", "Pathfinder 2e")',
              default: 'D&D 5e',
            },
            tone: {
              type: 'string',
              description: 'Response tone',
              enum: ['dramatic', 'humorous', 'serious', 'dark'],
              default: 'dramatic',
            },
          },
          required: ['scenario'],
        },
      },
      {
        name: 'anthropic_lookup_rule',
        description:
          'Look up TTRPG rules using Claude Haiku (fast, accurate). Returns concise rule explanations.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The rule question to answer',
            },
            system: {
              type: 'string',
              description: 'Game system',
              default: 'D&D 5e',
            },
          },
          required: ['query'],
        },
      },

      // === AI Tools - OpenAI (GPT) ===
      {
        name: 'openai_chat',
        description:
          'Chat with OpenAI GPT-4o. Use for complex content generation, function calling, structured output.',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'The prompt/message to send to the model',
            },
            systemPrompt: {
              type: 'string',
              description: 'Optional system prompt to guide the model',
            },
            temperature: {
              type: 'number',
              description: 'Creativity/randomness (0.0 to 2.0)',
              default: 0.7,
            },
            maxTokens: {
              type: 'number',
              description: 'Maximum tokens in response',
              default: 2048,
            },
          },
          required: ['prompt'],
        },
      },
      {
        name: 'openai_generate_dungeon',
        description:
          'Generate a TTRPG dungeon with structured rooms, encounters, and treasure using OpenAI function calling.',
        inputSchema: {
          type: 'object',
          properties: {
            theme: {
              type: 'string',
              description: 'Dungeon theme (e.g., "undead crypt", "dwarven mine")',
            },
            size: {
              type: 'string',
              enum: ['small', 'medium', 'large'],
              description: 'Dungeon size',
              default: 'medium',
            },
            level: {
              type: 'number',
              description: 'Party level (for encounter balancing)',
            },
            style: {
              type: 'string',
              description: 'Optional style (e.g., "linear", "branching", "sandbox")',
            },
          },
          required: ['theme', 'level'],
        },
      },
      {
        name: 'openai_generate_encounter',
        description:
          'Generate a TTRPG combat encounter with enemies, terrain, and rewards using OpenAI.',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              description: 'Encounter type (e.g., "combat", "social", "exploration")',
              default: 'combat',
            },
            difficulty: {
              type: 'string',
              enum: ['easy', 'medium', 'hard', 'deadly'],
              description: 'Encounter difficulty',
              default: 'medium',
            },
            partyLevel: {
              type: 'number',
              description: 'Average party level',
            },
            partySize: {
              type: 'number',
              description: 'Number of players',
            },
            environment: {
              type: 'string',
              description: 'Optional environment (e.g., "forest", "dungeon")',
            },
          },
          required: ['partyLevel', 'partySize'],
        },
      },

      // === Container Tools - Sandboxed Terminal Environment ===
      {
        name: 'container_start',
        description: 'Start a sandboxed container for a guild/channel. Required before executing commands.',
        inputSchema: {
          type: 'object',
          properties: {
            guildId: {
              type: 'string',
              description: 'Discord guild ID',
            },
            channelId: {
              type: 'string',
              description: 'Discord channel ID',
            },
            userId: {
              type: 'string',
              description: 'Discord user ID',
            },
            userName: {
              type: 'string',
              description: 'Username for container prompt',
            },
          },
          required: ['guildId', 'channelId', 'userId'],
        },
      },
      {
        name: 'container_stop',
        description: 'Stop a running container for a guild/channel.',
        inputSchema: {
          type: 'object',
          properties: {
            guildId: {
              type: 'string',
              description: 'Discord guild ID',
            },
            channelId: {
              type: 'string',
              description: 'Discord channel ID',
            },
            userId: {
              type: 'string',
              description: 'Discord user ID',
            },
          },
          required: ['guildId', 'channelId', 'userId'],
        },
      },
      {
        name: 'container_status',
        description: 'Get status of a container for a guild/channel.',
        inputSchema: {
          type: 'object',
          properties: {
            guildId: {
              type: 'string',
              description: 'Discord guild ID',
            },
            channelId: {
              type: 'string',
              description: 'Discord channel ID',
            },
            userId: {
              type: 'string',
              description: 'Discord user ID',
            },
          },
          required: ['guildId', 'channelId', 'userId'],
        },
      },
      {
        name: 'container_exec',
        description: 'Execute a command in a container and get output. Useful for installing games/mods or running shell commands.',
        inputSchema: {
          type: 'object',
          properties: {
            guildId: {
              type: 'string',
              description: 'Discord guild ID',
            },
            channelId: {
              type: 'string',
              description: 'Discord channel ID',
            },
            userId: {
              type: 'string',
              description: 'Discord user ID',
            },
            command: {
              type: 'string',
              description: 'Shell command to execute',
            },
            timeout: {
              type: 'number',
              description: 'Command timeout in milliseconds',
              default: 30000,
            },
          },
          required: ['guildId', 'channelId', 'userId', 'command'],
        },
      },

      // === FumbleBot Utility Tools ===
      {
        name: 'fumble_roll_dice',
        description:
          'Roll dice using standard notation (e.g., "2d6+3", "1d20", "4d6 drop lowest"). Returns individual rolls and total.',
        inputSchema: {
          type: 'object',
          properties: {
            notation: {
              type: 'string',
              description: 'Dice notation (e.g., "2d6+3", "1d20")',
            },
            label: {
              type: 'string',
              description: 'Optional label for the roll',
            },
          },
          required: ['notation'],
        },
      },
      {
        name: 'fumble_generate_npc',
        description:
          'Generate a TTRPG NPC with name, backstory, personality, and stats. Use when DM needs a quick NPC.',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              description: 'NPC type or role',
              default: 'random',
            },
            system: {
              type: 'string',
              description: 'Game system (e.g., "D&D 5e", "Pathfinder 2e")',
              default: 'D&D 5e',
            },
          },
        },
      },
      {
        name: 'fumble_generate_lore',
        description:
          'Generate world-building lore (locations, items, factions, etc.). Use for campaign content.',
        inputSchema: {
          type: 'object',
          properties: {
            topic: {
              type: 'string',
              description: 'What to generate lore about',
            },
            style: {
              type: 'string',
              description: 'Writing style',
              enum: ['chronicle', 'legend', 'scholarly', 'tavern'],
              default: 'chronicle',
            },
          },
          required: ['topic'],
        },
      },

      // === Knowledge Base Tools ===
      {
        name: 'kb_search',
        description:
          'Search the TTRPG Knowledge Base for rules, references, and guides. Use when you need to look up game mechanics, spell descriptions, FoundryVTT API docs, or other TTRPG information.',
        inputSchema: {
          type: 'object',
          properties: {
            search: {
              type: 'string',
              description: 'Search query (keywords to search for)',
            },
            system: {
              type: 'string',
              description: 'Filter by game system (e.g., "dnd5e", "cypher", "foundry")',
            },
            category: {
              type: 'string',
              description: 'Filter by category (e.g., "rules", "api", "user-guide")',
            },
            tags: {
              type: 'string',
              description: 'Filter by tags (comma-separated)',
            },
          },
          required: ['search'],
        },
      },
      {
        name: 'kb_get_article',
        description:
          'Get a specific Knowledge Base article by its slug. Returns full article content in markdown format.',
        inputSchema: {
          type: 'object',
          properties: {
            slug: {
              type: 'string',
              description: 'Article slug (e.g., "common/dice-notation", "dnd5e/spellcasting", "foundry/api-basics")',
            },
          },
          required: ['slug'],
        },
      },
      {
        name: 'kb_list_systems',
        description:
          'List all available game systems in the Knowledge Base (e.g., dnd5e, cypher, foundry, pc-games).',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'kb_list_articles',
        description:
          'List all Knowledge Base articles with optional filters. Returns article metadata (titles, systems, categories) without full content.',
        inputSchema: {
          type: 'object',
          properties: {
            system: {
              type: 'string',
              description: 'Filter by game system',
            },
            category: {
              type: 'string',
              description: 'Filter by category',
            },
            tags: {
              type: 'string',
              description: 'Filter by tags (comma-separated)',
            },
          },
        },
      },
    ];
  }

  /**
   * Handle Foundry VTT tools
   */
  private async handleFoundryTool(name: string, args: any) {
    switch (name) {
      case 'foundry_health_check':
        const health = await this.foundryClient.healthCheck();
        return {
          content: [{ type: 'text', text: JSON.stringify(health, null, 2) }],
        };

      case 'foundry_screenshot':
        return await this.captureScreenshot(args);

      case 'foundry_screenshot_canvas':
        return await this.captureCanvasScreenshot();

      case 'foundry_get_chat':
        return await this.getFoundryChat(args);

      case 'foundry_send_chat':
        return await this.sendFoundryChat(args);

      default:
        throw new Error(`Unknown Foundry tool: ${name}`);
    }
  }

  /**
   * Handle AI tools (Anthropic & OpenAI)
   */
  private async handleAITool(name: string, args: any) {
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

  /**
   * Handle FumbleBot utility tools
   */
  private async handleFumbleTool(name: string, args: any) {
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

  /**
   * Handle Container tools for sandboxed terminal environment
   */
  private async handleContainerTool(name: string, args: any) {
    const containerClient = getContainerClient();

    // Build user context from args
    const context: UserContext = {
      userId: args.userId,
      userName: args.userName,
      guildId: args.guildId,
      channelId: args.channelId,
    };

    switch (name) {
      case 'container_start': {
        const result = await containerClient.start(context);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'container_stop': {
        const result = await containerClient.stop(context);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'container_status': {
        const result = await containerClient.status(context);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'container_exec': {
        const result = await containerClient.exec(context, {
          command: args.command,
          timeout: args.timeout,
        });
        return {
          content: [
            {
              type: 'text',
              text: result.success
                ? result.stdout || '(no output)'
                : `Error (exit ${result.exitCode}): ${result.stderr || result.stdout || 'unknown error'}`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown Container tool: ${name}`);
    }
  }

  // === Foundry Tool Implementations ===

  private async captureScreenshot(args: any) {
    const screenshotService = getScreenshotService();
    const fullPage = args?.fullPage || false;

    const result = await screenshotService.captureScreenshot(FOUNDRY_URL, {
      fullPage,
    });

    const imageBuffer = await readFile(result.filePath);
    const base64Image = imageBuffer.toString('base64');

    return {
      content: [
        {
          type: 'image',
          data: base64Image,
          mimeType: 'image/png',
        },
        {
          type: 'text',
          text: `Screenshot: ${result.viewport.width}x${result.viewport.height}`,
        },
      ],
    };
  }

  private async captureCanvasScreenshot() {
    const screenshotService = getScreenshotService();
    const result = await screenshotService.captureCanvas(FOUNDRY_URL);

    const imageBuffer = await readFile(result.filePath);
    const base64Image = imageBuffer.toString('base64');

    return {
      content: [
        {
          type: 'image',
          data: base64Image,
          mimeType: 'image/png',
        },
        {
          type: 'text',
          text: 'Canvas screenshot captured',
        },
      ],
    };
  }

  private async getFoundryChat(args: any) {
    const limit = args?.limit || 10;
    // TODO: Implement via Foundry LevelDB access
    return {
      content: [
        {
          type: 'text',
          text: 'Chat retrieval not yet implemented (requires LevelDB access)',
        },
      ],
    };
  }

  private async sendFoundryChat(args: any) {
    const message = args?.message;
    if (!message) throw new Error('Message required');

    // TODO: Implement via Foundry WebSocket
    return {
      content: [
        {
          type: 'text',
          text: 'Chat sending not yet implemented',
        },
      ],
    };
  }

  // === Anthropic Tool Implementations ===

  private async anthropicChat(args: any) {
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

  private async anthropicDMResponse(args: any) {
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

  private async anthropicLookupRule(args: any) {
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

  // === OpenAI Tool Implementations ===

  private async openAIGenerate(args: any) {
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

  private async openAIGenerateDungeon(args: any) {
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

  private async openAIGenerateEncounter(args: any) {
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

  // === FumbleBot Tool Implementations ===

  private async rollDice(args: any) {
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

  private async generateNPC(args: any) {
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

  private async generateLore(args: any) {
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

  // === Knowledge Base Tool Implementations ===

  /**
   * Handle Knowledge Base tools
   */
  private async handleKBTool(name: string, args: any) {
    let coreClient;
    try {
      coreClient = getCoreClient();
    } catch (error) {
      throw new Error('Knowledge Base not available: Core API not configured. Set CORE_SERVER_URL and CORE_SECRET.');
    }

    switch (name) {
      case 'kb_search':
        return await this.kbSearch(coreClient, args);

      case 'kb_get_article':
        return await this.kbGetArticle(coreClient, args);

      case 'kb_list_systems':
        return await this.kbListSystems(coreClient);

      case 'kb_list_articles':
        return await this.kbListArticles(coreClient, args);

      default:
        throw new Error(`Unknown KB tool: ${name}`);
    }
  }

  private async kbSearch(coreClient: any, args: any) {
    const { search, system, category, tags } = args;

    const { articles, total } = await coreClient.kb.list({
      search,
      system,
      category,
      tags,
    });

    // Format results
    const formattedResults = articles.map((article: any) => ({
      slug: article.slug,
      title: article.title,
      system: article.system,
      category: article.category,
      tags: article.tags,
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            query: search,
            results: formattedResults,
            total,
          }, null, 2),
        },
      ],
    };
  }

  private async kbGetArticle(coreClient: any, args: any) {
    const { slug } = args;

    const { article } = await coreClient.kb.get(slug);

    return {
      content: [
        {
          type: 'text',
          text: `# ${article.frontmatter.title}\n\n` +
                `**System**: ${article.frontmatter.system}\n` +
                `**Category**: ${article.frontmatter.category}\n` +
                `**Tags**: ${article.frontmatter.tags.join(', ')}\n\n` +
                `---\n\n${article.content}`,
        },
      ],
    };
  }

  private async kbListSystems(coreClient: any) {
    const { systems, total } = await coreClient.kb.getSystems();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            systems,
            total,
          }, null, 2),
        },
      ],
    };
  }

  private async kbListArticles(coreClient: any, args: any) {
    const { system, category, tags } = args;

    const { articles, total } = await coreClient.kb.list({
      system,
      category,
      tags,
    });

    const formattedArticles = articles.map((article: any) => ({
      slug: article.slug,
      title: article.title,
      system: article.system,
      category: article.category,
      tags: article.tags,
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            articles: formattedArticles,
            total,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error('FumbleBot MCP server started');
    console.error('Available tool categories:');
    console.error('  - foundry_*   : Foundry VTT operations');
    console.error('  - anthropic_* : Claude (Sonnet, Haiku) operations');
    console.error('  - openai_*    : OpenAI (GPT-4o, DALL-E) operations');
    console.error('  - container_* : Sandboxed container management (via Core API)');
    console.error('  - fumble_*    : FumbleBot utilities (dice, NPC, lore)');
    console.error('  - kb_*        : Knowledge Base (TTRPG rules, FoundryVTT docs)');
  }
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`.replace(/\\/g, '/')) {
  const server = new FumbleBotMCPServer();
  server.start().catch(console.error);
}

export { FumbleBotMCPServer };