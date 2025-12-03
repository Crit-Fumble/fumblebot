/**
 * Foundry Container Management Tool Handlers
 * Handles Foundry VTT container lifecycle via Core API
 */

import { getCoreClient } from '../../lib/core-client.js';
import type { MCPToolResult } from './types.js';

export class FoundryContainerHandler {
  async handle(name: string, args: any): Promise<MCPToolResult> {
    let coreClient;
    try {
      coreClient = getCoreClient();
    } catch (error) {
      throw new Error('Foundry Container management not available: Core API not configured. Set CORE_SERVER_URL and CORE_SECRET.');
    }

    switch (name) {
      case 'foundry_create_container':
        return await this.createContainer(coreClient, args);

      case 'foundry_list_containers':
        return await this.listContainers(coreClient);

      case 'foundry_list_guild_containers':
        return await this.listGuildContainers(coreClient, args);

      case 'foundry_get_container':
        return await this.getContainer(coreClient, args);

      case 'foundry_stop_container':
        return await this.stopContainer(coreClient, args);

      default:
        throw new Error(`Unknown Foundry container tool: ${name}`);
    }
  }

  private async createContainer(coreClient: any, args: any): Promise<MCPToolResult> {
    const { guildId, campaignId, worldName, foundryVersion = '12', maxIdleMinutes = 120 } = args;

    const { container } = await coreClient.foundry.createContainer({
      guildId,
      campaignId,
      worldName,
      foundryVersion,
      maxIdleMinutes,
    });

    if (!container.success) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to create Foundry container: ${container.error || 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `✅ Foundry container created successfully!\n\n` +
                `**Container ID**: ${container.containerId}\n` +
                `**Access URL**: ${container.accessUrl}\n` +
                `**License Source**: ${container.licenseSource}\n` +
                `**Port**: ${container.port}\n\n` +
                `The Foundry instance is starting up and will be ready in ~30 seconds.`,
        },
      ],
    };
  }

  private async listContainers(coreClient: any): Promise<MCPToolResult> {
    const { containers, total } = await coreClient.foundry.listContainers();

    if (total === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No active Foundry containers found.',
          },
        ],
      };
    }

    const containerList = containers.map((c: any) => ({
      id: c.id,
      containerId: c.containerId,
      status: c.status,
      worldName: c.worldName,
      foundryVersion: c.foundryVersion,
      guildId: c.guildId,
      startedAt: c.startedAt,
      expiresAt: c.expiresAt,
    }));

    return {
      content: [
        {
          type: 'text',
          text: `Found ${total} active container(s):\n\n` +
                JSON.stringify(containerList, null, 2),
        },
      ],
    };
  }

  private async listGuildContainers(coreClient: any, args: any): Promise<MCPToolResult> {
    const { guildId } = args;

    const { containers, total } = await coreClient.foundry.listGuildContainers(guildId);

    if (total === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No active Foundry containers found for guild ${guildId}.`,
          },
        ],
      };
    }

    const containerList = containers.map((c: any) => ({
      id: c.id,
      containerId: c.containerId,
      status: c.status,
      worldName: c.worldName,
      ownerId: c.ownerId,
      startedAt: c.startedAt,
    }));

    return {
      content: [
        {
          type: 'text',
          text: `Found ${total} container(s) for guild ${guildId}:\n\n` +
                JSON.stringify(containerList, null, 2),
        },
      ],
    };
  }

  private async getContainer(coreClient: any, args: any): Promise<MCPToolResult> {
    const { containerId } = args;

    const { container } = await coreClient.foundry.getContainer(containerId);

    return {
      content: [
        {
          type: 'text',
          text: `**Container Details**\n\n` +
                `**ID**: ${container.containerId}\n` +
                `**Status**: ${container.status}\n` +
                `**World**: ${container.worldName || 'N/A'}\n` +
                `**Version**: ${container.foundryVersion}\n` +
                `**Port**: ${container.port}\n` +
                `**Started**: ${container.startedAt}\n` +
                `**Expires**: ${container.expiresAt || 'Never'}\n` +
                `**Max Idle**: ${container.maxIdleMinutes} minutes\n\n` +
                `License: ${container.license.status} (${container.license.userId ? 'User' : 'Pool'})`,
        },
      ],
    };
  }

  private async stopContainer(coreClient: any, args: any): Promise<MCPToolResult> {
    const { containerId } = args;

    const { message } = await coreClient.foundry.stopContainer(containerId);

    return {
      content: [
        {
          type: 'text',
          text: `✅ Container stopped: ${message}`,
        },
      ],
    };
  }
}
