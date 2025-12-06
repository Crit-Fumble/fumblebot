/**
 * Container Service Client
 *
 * Client for interacting with Core's container API.
 * Manages adventure terminal environments for Discord Activities.
 *
 * Now uses @crit-fumble/core SDK instead of direct HTTP calls.
 *
 * @see https://core.crit-fumble.com README for API documentation
 */

import type {
  ContainerStartResponse,
  ContainerStopResponse,
  ContainerStatusResponse,
  ContainerExecResponse,
} from '@crit-fumble/core';
import { getCoreClient } from '../../lib/core-client.js';
import { getCoreProxyConfig } from '../../config.js';

export interface UserContext {
  userId: string;
  userName?: string;
  guildId: string;
  channelId: string;
}

/**
 * Client for Core's container API
 *
 * Provides service-to-service communication with Core for container management.
 * Uses the @crit-fumble/core SDK for API calls.
 *
 * @example
 * ```typescript
 * // Use the singleton (configured from centralized config)
 * const client = getContainerClient();
 *
 * // Start a container
 * const container = await client.start({
 *   userId: '123456789',
 *   userName: 'Player1',
 *   guildId: '987654321',
 *   channelId: '111222333',
 * });
 *
 * // Execute a command
 * const result = await client.exec(
 *   { userId: '123', guildId: '987', channelId: '111' },
 *   { command: 'roll 2d6+3', timeout: 5000 }
 * );
 * ```
 */
export class ContainerClient {
  private coreUrl: string;

  constructor(coreUrl: string) {
    this.coreUrl = coreUrl;
  }

  /**
   * Start a container for guild/channel
   *
   * Creates a new adventure terminal environment scoped to the guild+channel.
   * If a container already exists for this scope, it returns the existing one.
   */
  async start(context: UserContext): Promise<ContainerStartResponse> {
    console.log(`[Container] Starting container for guild ${context.guildId}, channel ${context.channelId}`);

    const coreClient = getCoreClient();
    const response = await coreClient.container.start({
      guildId: context.guildId,
      channelId: context.channelId,
    });

    console.log(`[Container] Started: ${response.containerId} on port ${response.port}`);
    return response;
  }

  /**
   * Stop a container
   */
  async stop(context: UserContext): Promise<ContainerStopResponse> {
    console.log(`[Container] Stopping container for guild ${context.guildId}, channel ${context.channelId}`);

    const coreClient = getCoreClient();
    const response = await coreClient.container.stop(context.guildId, context.channelId);

    console.log(`[Container] Stopped`);
    return response;
  }

  /**
   * Get container status
   */
  async status(context: UserContext): Promise<ContainerStatusResponse> {
    const coreClient = getCoreClient();
    return coreClient.container.status(context.guildId, context.channelId);
  }

  /**
   * Execute a command in the container
   *
   * Runs a command and returns the output. Useful for MCP tool integration.
   *
   * @example
   * ```typescript
   * const result = await client.exec(context, {
   *   command: 'ls -la',
   *   timeout: 5000,
   * });
   * console.log(result.stdout);
   * ```
   */
  async exec(
    context: UserContext,
    options: { command: string; timeout?: number }
  ): Promise<ContainerExecResponse> {
    console.log(`[Container] Executing: ${options.command}`);

    const coreClient = getCoreClient();
    const response = await coreClient.container.exec({
      guildId: context.guildId,
      channelId: context.channelId,
      command: options.command,
      timeout: options.timeout,
    });

    if (!response.success) {
      console.warn(`[Container] Command failed with exit code ${response.exitCode}`);
      if (response.stderr) {
        console.warn(`[Container] stderr: ${response.stderr}`);
      }
    }

    return response;
  }

  /**
   * Get WebSocket URL for terminal connection
   */
  getTerminalWsUrl(context: UserContext): string {
    const params = new URLSearchParams({
      guildId: context.guildId,
      channelId: context.channelId,
    });

    // Use wss:// for HTTPS core URL, ws:// for HTTP
    const wsProtocol = this.coreUrl.startsWith('https') ? 'wss' : 'ws';
    const baseUrl = this.coreUrl.replace(/^https?/, wsProtocol);

    return `${baseUrl}/api/container/terminal?${params}`;
  }

  /**
   * Check if Core API is reachable
   */
  async healthCheck(): Promise<boolean> {
    try {
      const coreClient = getCoreClient();
      const health = await coreClient.health();
      return health.status === 'ok';
    } catch {
      return false;
    }
  }
}

// Singleton instance - configured from centralized config
let instance: ContainerClient | null = null;

export function getContainerClient(): ContainerClient {
  if (!instance) {
    const coreConfig = getCoreProxyConfig();

    if (!coreConfig) {
      throw new Error('CORE_SERVER_URL environment variable is required for container client');
    }

    const coreUrl = coreConfig.url.includes(':') ? coreConfig.url : `${coreConfig.url}:${coreConfig.port}`;

    instance = new ContainerClient(coreUrl);
  }

  return instance;
}

export function configureContainerClient(coreUrl: string): ContainerClient {
  instance = new ContainerClient(coreUrl);
  return instance;
}
