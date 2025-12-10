/**
 * Foundry Container Management Tool Handlers
 * Handles Foundry VTT container lifecycle via Core API
 *
 * Features (v10.14.1+):
 * - Container lifecycle (create, list, get, stop)
 * - World management (list, get, backup)
 * - Module management (list, install, uninstall)
 * - System and user listing
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
      // Container lifecycle
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

      // World management (v10.14.1+)
      case 'foundry_list_worlds':
        return await this.listWorlds(coreClient, args);

      case 'foundry_get_world':
        return await this.getWorld(coreClient, args);

      case 'foundry_backup_world':
        return await this.backupWorld(coreClient, args);

      // Module management (v10.14.1+)
      case 'foundry_list_modules':
        return await this.listModules(coreClient, args);

      case 'foundry_install_module':
        return await this.installModule(coreClient, args);

      case 'foundry_uninstall_module':
        return await this.uninstallModule(coreClient, args);

      // System & user listing (v10.14.1+)
      case 'foundry_list_systems':
        return await this.listSystems(coreClient, args);

      case 'foundry_list_users':
        return await this.listUsers(coreClient, args);

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

  // =============================================================================
  // World Management (v10.14.1+)
  // =============================================================================

  private async listWorlds(coreClient: any, args: any): Promise<MCPToolResult> {
    const { containerId } = args;

    const { worlds } = await coreClient.foundry.listWorlds(containerId);

    if (!worlds || worlds.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No worlds found in this Foundry container.',
          },
        ],
      };
    }

    const worldList = worlds.map((w: any) => ({
      id: w.id,
      title: w.title,
      system: w.system,
      lastPlayed: w.lastPlayed,
    }));

    return {
      content: [
        {
          type: 'text',
          text: `Found ${worlds.length} world(s):\n\n` + JSON.stringify(worldList, null, 2),
        },
      ],
    };
  }

  private async getWorld(coreClient: any, args: any): Promise<MCPToolResult> {
    const { containerId, worldId } = args;

    const { world } = await coreClient.foundry.getWorld(containerId, worldId);

    return {
      content: [
        {
          type: 'text',
          text:
            `**World: ${world.title}**\n\n` +
            `**System**: ${world.system} (${world.systemVersion || 'N/A'})\n` +
            `**Core Version**: ${world.coreVersion || 'N/A'}\n` +
            `**Last Played**: ${world.lastPlayed || 'Never'}\n\n` +
            `**Content Counts**:\n` +
            `- Actors: ${world.actors || 0}\n` +
            `- Items: ${world.items || 0}\n` +
            `- Scenes: ${world.scenes || 0}\n` +
            `- Journals: ${world.journals || 0}\n` +
            `- Tables: ${world.tables || 0}\n` +
            `- Playlists: ${world.playlists || 0}\n` +
            `- Macros: ${world.macros || 0}\n` +
            `- Compendium Packs: ${world.compendiumPacks || 0}`,
        },
      ],
    };
  }

  private async backupWorld(coreClient: any, args: any): Promise<MCPToolResult> {
    const { containerId, worldId } = args;

    const { backup } = await coreClient.foundry.backupWorld(containerId, worldId);

    return {
      content: [
        {
          type: 'text',
          text:
            `✅ Backup created successfully!\n\n` +
            `**World**: ${backup.worldTitle}\n` +
            `**Filename**: ${backup.filename}\n` +
            `**Size**: ${Math.round(backup.size / 1024)} KB\n` +
            `**Created**: ${backup.createdAt}`,
        },
      ],
    };
  }

  // =============================================================================
  // Module Management (v10.14.1+)
  // =============================================================================

  private async listModules(coreClient: any, args: any): Promise<MCPToolResult> {
    const { containerId } = args;

    const { modules } = await coreClient.foundry.listModules(containerId);

    if (!modules || modules.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No modules installed in this Foundry container.',
          },
        ],
      };
    }

    const moduleList = modules.map((m: any) => ({
      id: m.id,
      title: m.title,
      version: m.version,
      active: m.active ?? false,
    }));

    const activeCount = moduleList.filter((m: any) => m.active).length;

    return {
      content: [
        {
          type: 'text',
          text:
            `Found ${modules.length} module(s) (${activeCount} active):\n\n` +
            JSON.stringify(moduleList, null, 2),
        },
      ],
    };
  }

  private async installModule(coreClient: any, args: any): Promise<MCPToolResult> {
    const { containerId, manifestUrl } = args;

    const { module, success } = await coreClient.foundry.installModule(containerId, manifestUrl);

    if (!success) {
      return {
        content: [
          {
            type: 'text',
            text: 'Failed to install module. Check the manifest URL and try again.',
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text:
            `✅ Module installed successfully!\n\n` +
            `**${module.title}** (${module.id})\n` +
            `Version: ${module.version}\n` +
            `Author: ${module.author || 'Unknown'}`,
        },
      ],
    };
  }

  private async uninstallModule(coreClient: any, args: any): Promise<MCPToolResult> {
    const { containerId, moduleId } = args;

    const { success } = await coreClient.foundry.uninstallModule(containerId, moduleId);

    if (!success) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to uninstall module "${moduleId}".`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `✅ Module "${moduleId}" uninstalled successfully.`,
        },
      ],
    };
  }

  // =============================================================================
  // System & User Listing (v10.14.1+)
  // =============================================================================

  private async listSystems(coreClient: any, args: any): Promise<MCPToolResult> {
    const { containerId } = args;

    const { systems } = await coreClient.foundry.listSystems(containerId);

    if (!systems || systems.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No game systems installed in this Foundry container.',
          },
        ],
      };
    }

    const systemList = systems.map((s: any) => ({
      id: s.id,
      title: s.title,
      version: s.version,
    }));

    return {
      content: [
        {
          type: 'text',
          text:
            `Found ${systems.length} game system(s):\n\n` + JSON.stringify(systemList, null, 2),
        },
      ],
    };
  }

  private async listUsers(coreClient: any, args: any): Promise<MCPToolResult> {
    const { containerId } = args;

    const { users } = await coreClient.foundry.listUsers(containerId);

    if (!users || users.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No users found in this Foundry container.',
          },
        ],
      };
    }

    // Map role numbers to names
    const roleNames: Record<number, string> = {
      0: 'None',
      1: 'Player',
      2: 'Trusted',
      3: 'Assistant',
      4: 'Gamemaster',
    };

    const userList = users.map((u: any) => ({
      id: u.id,
      name: u.name,
      role: roleNames[u.role] || `Role ${u.role}`,
      character: u.character || null,
    }));

    return {
      content: [
        {
          type: 'text',
          text: `Found ${users.length} user(s):\n\n` + JSON.stringify(userList, null, 2),
        },
      ],
    };
  }
}
