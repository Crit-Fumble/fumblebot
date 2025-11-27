/**
 * Foundry VTT MCP Server
 *
 * Exposes Foundry VTT operations as MCP tools for AI agents
 * This allows Claude/GPT-4 to autonomously interact with Foundry instances
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { FoundryClient } from '../foundry/client.js';
import { getScreenshotService } from '../foundry/screenshot.js';
import { readFile } from 'fs/promises';

// Configuration
const FOUNDRY_URL = process.env.FOUNDRY_URL || 'http://localhost:30000';
const FOUNDRY_API_KEY = process.env.FOUNDRY_API_KEY;

/**
 * Foundry VTT MCP Server
 * Provides tools for interacting with Foundry VTT instances
 */
class FoundryMCPServer {
  private server: Server;
  private foundryClient: FoundryClient;

  constructor() {
    this.server = new Server(
      {
        name: 'foundry-vtt',
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
        switch (name) {
          case 'foundry_health_check':
            return await this.handleHealthCheck();

          case 'foundry_screenshot':
            return await this.handleScreenshot(args);

          case 'foundry_screenshot_canvas':
            return await this.handleScreenshotCanvas(args);

          case 'foundry_get_chat':
            return await this.handleGetChat(args);

          case 'foundry_send_chat':
            return await this.handleSendChat(args);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
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
      {
        name: 'foundry_health_check',
        description:
          'Check if Foundry VTT instance is running and accessible. Returns status information about the instance.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'foundry_screenshot',
        description:
          'Capture a screenshot of the Foundry VTT instance. Returns a base64-encoded PNG image. Use this when the user asks to see what\'s happening in the game or wants a visual of the VTT.',
        inputSchema: {
          type: 'object',
          properties: {
            fullPage: {
              type: 'boolean',
              description: 'Capture full page (scroll and capture everything)',
              default: false,
            },
          },
        },
      },
      {
        name: 'foundry_screenshot_canvas',
        description:
          'Capture a screenshot of just the game canvas/board (where tokens and maps are displayed). Returns a base64-encoded PNG image.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'foundry_get_chat',
        description:
          'Retrieve recent chat messages from Foundry VTT. Use this to see what players have said in-game.',
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
        description:
          'Send a chat message to Foundry VTT as the bot. Use this to communicate with players in-game.',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'The message to send',
            },
            type: {
              type: 'string',
              description: 'Message type: "ooc" (out of character), "ic" (in character), "emote", or "whisper"',
              enum: ['ooc', 'ic', 'emote', 'whisper'],
              default: 'ooc',
            },
          },
          required: ['message'],
        },
      },
    ];
  }

  /**
   * Handle health check tool
   */
  private async handleHealthCheck() {
    const health = await this.foundryClient.healthCheck();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(health, null, 2),
        },
      ],
    };
  }

  /**
   * Handle screenshot tool
   */
  private async handleScreenshot(args: any) {
    const screenshotService = getScreenshotService();
    const fullPage = args?.fullPage || false;

    const result = await screenshotService.captureScreenshot(FOUNDRY_URL, {
      fullPage,
    });

    // Read screenshot and convert to base64
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
          text: `Screenshot captured at ${result.viewport.width}x${result.viewport.height}`,
        },
      ],
    };
  }

  /**
   * Handle canvas screenshot tool
   */
  private async handleScreenshotCanvas(args: any) {
    const screenshotService = getScreenshotService();

    const result = await screenshotService.captureCanvas(FOUNDRY_URL);

    // Read screenshot and convert to base64
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

  /**
   * Handle get chat tool
   */
  private async handleGetChat(args: any) {
    const limit = args?.limit || 10;

    try {
      const messages = await this.foundryClient.getChatMessages(limit);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(messages, null, 2),
          },
        ],
      };
    } catch (error) {
      // Not implemented yet - return placeholder
      return {
        content: [
          {
            type: 'text',
            text: 'Chat retrieval not yet implemented (Phase 1 feature)',
          },
        ],
      };
    }
  }

  /**
   * Handle send chat tool
   */
  private async handleSendChat(args: any) {
    const message = args?.message;
    const type = args?.type || 'ooc';

    if (!message) {
      throw new Error('Message is required');
    }

    try {
      await this.foundryClient.sendChatMessage(message, { type: getMessageType(type) });

      return {
        content: [
          {
            type: 'text',
            text: `Message sent: "${message}"`,
          },
        ],
      };
    } catch (error) {
      // Not implemented yet - return placeholder
      return {
        content: [
          {
            type: 'text',
            text: 'Chat sending not yet implemented (Phase 1 feature)',
          },
        ],
      };
    }
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error('Foundry VTT MCP server started');
  }
}

/**
 * Convert string message type to numeric type
 */
function getMessageType(type: string): number {
  switch (type) {
    case 'ooc':
      return 0;
    case 'ic':
      return 1;
    case 'emote':
      return 2;
    case 'whisper':
      return 3;
    default:
      return 0;
  }
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`.replace(/\\/g, '/')) {
  const server = new FoundryMCPServer();
  server.start().catch(console.error);
}

export { FoundryMCPServer };
