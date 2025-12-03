/**
 * Container Service Client
 *
 * Client for interacting with Core's container API.
 * Manages adventure terminal environments for Discord Activities.
 *
 * @see https://core.crit-fumble.com README for API documentation
 */

import type {
  ContainerStartRequest,
  ContainerStartResponse,
  ContainerStopRequest,
  ContainerStopResponse,
  ContainerStatusResponse,
  ContainerExecRequest,
  ContainerExecResponse,
} from '@crit-fumble/core';
import { getCoreProxyConfig } from '../../config.js';

export interface ContainerClientConfig {
  /** Core API URL (internal or public) */
  coreUrl: string;
  /** Shared secret for service auth */
  coreSecret: string;
  /** Request timeout in ms */
  timeout?: number;
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
 * All requests are authenticated with X-Core-Secret header.
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
  private config: Required<ContainerClientConfig>;

  constructor(config: ContainerClientConfig) {
    this.config = {
      timeout: 30000,
      ...config,
    };
  }

  /**
   * Build headers for Core API requests
   */
  private buildHeaders(context: UserContext): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Core-Secret': this.config.coreSecret,
      'X-User-Id': context.userId,
      'X-Guild-Id': context.guildId,
      'X-Channel-Id': context.channelId,
    };

    if (context.userName) {
      headers['X-User-Name'] = context.userName;
    }

    return headers;
  }

  /**
   * Make a request to Core API
   */
  private async request<T>(
    method: string,
    path: string,
    context: UserContext,
    body?: object
  ): Promise<T> {
    const url = `${this.config.coreUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: this.buildHeaders(context),
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(`Container API error: ${error.message || response.statusText}`);
      }

      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Start a container for guild/channel
   *
   * Creates a new adventure terminal environment scoped to the guild+channel.
   * If a container already exists for this scope, it returns the existing one.
   */
  async start(context: UserContext): Promise<ContainerStartResponse> {
    const body: ContainerStartRequest = {
      guildId: context.guildId,
      channelId: context.channelId,
    };

    console.log(`[Container] Starting container for guild ${context.guildId}, channel ${context.channelId}`);

    const response = await this.request<ContainerStartResponse>(
      'POST',
      '/api/container/start',
      context,
      body
    );

    console.log(`[Container] Started: ${response.containerId} on port ${response.port}`);
    return response;
  }

  /**
   * Stop a container
   */
  async stop(context: UserContext): Promise<ContainerStopResponse> {
    const body: ContainerStopRequest = {
      guildId: context.guildId,
      channelId: context.channelId,
    };

    console.log(`[Container] Stopping container for guild ${context.guildId}, channel ${context.channelId}`);

    const response = await this.request<ContainerStopResponse>(
      'POST',
      '/api/container/stop',
      context,
      body
    );

    console.log(`[Container] Stopped`);
    return response;
  }

  /**
   * Get container status
   */
  async status(context: UserContext): Promise<ContainerStatusResponse> {
    const params = new URLSearchParams({
      guildId: context.guildId,
      channelId: context.channelId,
    });

    return this.request<ContainerStatusResponse>(
      'GET',
      `/api/container/status?${params}`,
      context
    );
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
    const body: ContainerExecRequest = {
      guildId: context.guildId,
      channelId: context.channelId,
      command: options.command,
      timeout: options.timeout,
    };

    console.log(`[Container] Executing: ${options.command}`);

    const response = await this.request<ContainerExecResponse>(
      'POST',
      '/api/container/exec',
      context,
      body
    );

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
    const wsProtocol = this.config.coreUrl.startsWith('https') ? 'wss' : 'ws';
    const baseUrl = this.config.coreUrl.replace(/^https?/, wsProtocol);

    return `${baseUrl}/api/container/terminal?${params}`;
  }

  /**
   * Check if Core API is reachable
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.coreUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
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
    if (!coreConfig.secret) {
      throw new Error('CORE_SECRET environment variable is required for container client');
    }

    const coreUrl = coreConfig.url.includes(':') ? coreConfig.url : `${coreConfig.url}:${coreConfig.port}`;

    instance = new ContainerClient({
      coreUrl,
      coreSecret: coreConfig.secret,
    });
  }

  return instance;
}

export function configureContainerClient(config: ContainerClientConfig): ContainerClient {
  instance = new ContainerClient(config);
  return instance;
}
