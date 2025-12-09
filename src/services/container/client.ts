/**
 * Container Service Client
 *
 * @deprecated Use adventure-service.ts for MUD-style text adventures.
 * This client uses the legacy Container API which has been replaced by the Adventure API.
 *
 * Client for interacting with Core's container API.
 * Manages adventure terminal environments for Discord Activities.
 *
 * @see https://core.crit-fumble.com README for API documentation
 */

import { getCoreClient } from '../../lib/core-client.js';
import { getCoreProxyConfig } from '../../config.js';

// Local response types (Container API has changed in Core SDK v10.13)
export interface ContainerStartResponse {
  containerId: string;
  status: string;
  port: number;
  createdAt: string;
  wsUrl?: string;
}

export interface ContainerStopResponse {
  success: boolean;
  message?: string;
}

export interface ContainerStatusResponse {
  exists: boolean;
  containerId?: string;
  status?: string;
  port?: number;
  createdAt?: string;
  uptime?: number;
}

export interface ContainerExecResponse {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime?: number;
}

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
   * @deprecated Use adventure-service.ts instead. Container API has changed.
   * Creates a new adventure terminal environment scoped to the guild+channel.
   * If a container already exists for this scope, it returns the existing one.
   */
  async start(_context: UserContext): Promise<ContainerStartResponse> {
    // The old Container API is no longer available in Core SDK v10.13+
    // Use the new Adventure API via adventure-service.ts instead
    throw new Error(
      'Container.start is deprecated. Use adventure-service.ts for MUD-style text adventures.'
    );
  }

  /**
   * Stop a container
   * @deprecated Use adventure-service.ts instead. Container API has changed.
   */
  async stop(_context: UserContext): Promise<ContainerStopResponse> {
    throw new Error(
      'Container.stop is deprecated. Use adventure-service.ts for MUD-style text adventures.'
    );
  }

  /**
   * Get container status
   * @deprecated Use adventure-service.ts instead. Container API has changed.
   */
  async status(_context: UserContext): Promise<ContainerStatusResponse> {
    throw new Error(
      'Container.status is deprecated. Use adventure-service.ts for MUD-style text adventures.'
    );
  }

  /**
   * Execute a command in the container
   *
   * @deprecated Use adventure-service.ts instead. Container API has changed.
   * Runs a command and returns the output. Useful for MCP tool integration.
   */
  async exec(
    _context: UserContext,
    _options: { command: string; timeout?: number }
  ): Promise<ContainerExecResponse> {
    throw new Error(
      'Container.exec is deprecated. Use adventure-service.ts for MUD-style text adventures.'
    );
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
