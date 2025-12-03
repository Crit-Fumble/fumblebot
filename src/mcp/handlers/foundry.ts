/**
 * Foundry VTT Tool Handlers
 * Handles screenshot, chat, and direct Foundry VTT operations
 */

import { readFile } from 'fs/promises';
import { FoundryClient, getScreenshotService } from '../../services/foundry/index.js';
import type { MCPToolResult } from './types.js';

const FOUNDRY_URL = process.env.FOUNDRY_URL || 'http://localhost:30000';

export class FoundryHandler {
  constructor(private foundryClient: FoundryClient) {}

  async handle(name: string, args: any): Promise<MCPToolResult> {
    switch (name) {
      case 'foundry_health_check':
        return await this.healthCheck();

      case 'foundry_screenshot':
        return await this.captureScreenshot(args);

      case 'foundry_screenshot_canvas':
        return await this.captureCanvasScreenshot();

      case 'foundry_get_chat':
        return await this.getChat(args);

      case 'foundry_send_chat':
        return await this.sendChat(args);

      default:
        throw new Error(`Unknown Foundry tool: ${name}`);
    }
  }

  private async healthCheck(): Promise<MCPToolResult> {
    const health = await this.foundryClient.healthCheck();
    return {
      content: [{ type: 'text', text: JSON.stringify(health, null, 2) }],
    };
  }

  private async captureScreenshot(args: any): Promise<MCPToolResult> {
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

  private async captureCanvasScreenshot(): Promise<MCPToolResult> {
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

  private async getChat(args: any): Promise<MCPToolResult> {
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

  private async sendChat(args: any): Promise<MCPToolResult> {
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
}
