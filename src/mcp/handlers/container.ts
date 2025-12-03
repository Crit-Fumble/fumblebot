/**
 * Container Tool Handlers
 * Handles sandboxed terminal container operations
 */

import { getContainerClient, type UserContext } from '../../services/container/index.js';
import type { MCPToolResult } from './types.js';

export class ContainerHandler {
  async handle(name: string, args: any): Promise<MCPToolResult> {
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
}
