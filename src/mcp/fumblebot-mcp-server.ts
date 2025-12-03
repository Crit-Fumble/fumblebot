/**
 * FumbleBot MCP Server
 *
 * Unified MCP server exposing:
 * - Foundry VTT operations (screenshots, chat, etc.)
 * - AI operations (Anthropic Claude & OpenAI GPT models)
 * - FumbleBot utilities (dice rolling, NPC generation, etc.)
 * - Docker operations for Foundry instance management
 * - Knowledge Base operations (TTRPG rules, references, and guides)
 * - Web fetch operations (5e.tools, D&D Beyond, Cypher SRD)
 *
 * This allows AI agents to autonomously interact with all FumbleBot capabilities.
 * Non-admin Discord commands also call these MCP tools directly.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { FoundryClient } from '../services/foundry/index.js';
import { AIService } from '../services/ai/service.js';
import type { prisma } from '../services/db/client.js';

// Import modular tool definitions and handlers
import { getAllTools } from './tools/index.js';
import {
  FoundryHandler,
  FoundryContainerHandler,
  AIHandler,
  FumbleHandler,
  ContainerHandler,
  KBHandler,
  WebHandler,
  WorldAnvilHandler,
} from './handlers/index.js';

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

  // Handlers
  private foundryHandler: FoundryHandler;
  private foundryContainerHandler: FoundryContainerHandler;
  private aiHandler: AIHandler;
  private fumbleHandler: FumbleHandler;
  private containerHandler: ContainerHandler;
  private kbHandler: KBHandler;
  private webHandler: WebHandler;
  private worldAnvilHandler: WorldAnvilHandler;

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

    // Initialize handlers
    this.foundryHandler = new FoundryHandler(this.foundryClient);
    this.foundryContainerHandler = new FoundryContainerHandler();
    this.aiHandler = new AIHandler(this.aiService);
    this.fumbleHandler = new FumbleHandler(this.aiService);
    this.containerHandler = new ContainerHandler();
    this.kbHandler = new KBHandler();
    this.webHandler = new WebHandler();
    this.worldAnvilHandler = new WorldAnvilHandler();

    this.setupHandlers();
  }

  /**
   * Set up MCP request handlers
   */
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: getAllTools(),
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        return await this.routeToolCall(name, args);
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
   * Route tool call to appropriate handler
   */
  private async routeToolCall(name: string, args: any) {
    // Foundry VTT tools (screenshots, chat)
    if (name.startsWith('foundry_') && !name.startsWith('foundry_container') && !name.includes('_container')) {
      return await this.foundryHandler.handle(name, args);
    }

    // Foundry container management tools (via Core API)
    if (name.includes('_container')) {
      return await this.foundryContainerHandler.handle(name, args);
    }

    // AI tools (OpenAI & Anthropic)
    if (name.startsWith('openai_') || name.startsWith('anthropic_') || name.startsWith('ai_')) {
      return await this.aiHandler.handle(name, args);
    }

    // FumbleBot utility tools
    if (name.startsWith('fumble_')) {
      return await this.fumbleHandler.handle(name, args);
    }

    // Container tools (adventure terminal environment)
    if (name.startsWith('container_')) {
      return await this.containerHandler.handle(name, args);
    }

    // Knowledge Base tools
    if (name.startsWith('kb_')) {
      return await this.kbHandler.handle(name, args);
    }

    // Web fetch tools
    if (name.startsWith('web_')) {
      return await this.webHandler.handle(name, args);
    }

    // World Anvil tools
    if (name.startsWith('worldanvil_')) {
      return await this.worldAnvilHandler.handle(name, args);
    }

    throw new Error(`Unknown tool: ${name}`);
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error('FumbleBot MCP server started');
    console.error('Available tool categories:');
    console.error('  - foundry_*           : Foundry VTT operations (screenshots, chat)');
    console.error('  - foundry_*_container : Foundry container management (create, list, stop)');
    console.error('  - anthropic_*         : Claude (Sonnet, Haiku) operations');
    console.error('  - openai_*            : OpenAI (GPT-4o, DALL-E) operations');
    console.error('  - container_*         : Sandboxed terminal containers (via Core API)');
    console.error('  - fumble_*            : FumbleBot utilities (dice, NPC, lore)');
    console.error('  - kb_*                : Knowledge Base (TTRPG rules, FoundryVTT docs)');
    console.error('  - web_*               : Web fetch & search (5e.tools, D&D Beyond, Cypher, Fandom wikis)');
    console.error('  - worldanvil_*        : World Anvil (campaign worlds, articles, lore)');
    console.error('');
    console.error(`AI Service status: Anthropic ${this.aiService.isProviderAvailable('anthropic') ? 'configured' : 'NOT configured'}, OpenAI ${this.aiService.isProviderAvailable('openai') ? 'configured' : 'NOT configured'}`);
  }
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`.replace(/\\/g, '/')) {
  const server = new FumbleBotMCPServer();
  server.start().catch(console.error);
}

export { FumbleBotMCPServer };
