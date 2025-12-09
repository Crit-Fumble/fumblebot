/**
 * Terminal Service
 *
 * @deprecated Use adventure-service.ts instead for MUD-style text adventures.
 * This service uses the deprecated Container API which has been replaced by the Adventure API.
 *
 * The Container API was removed in Core SDK v10.13. Use the new Adventure API via:
 * - adventure-service.ts for service methods
 * - /adventure commands in Discord
 *
 * This file is kept for backwards compatibility but all methods will throw errors.
 */

import {
  getContainerClient,
  type UserContext,
  type ContainerStatusResponse,
} from '../container/client.js';

export interface TerminalSession {
  containerId: string;
  guildId: string;
  channelId: string;
  startedBy: string;
  startedAt: Date;
  status: 'running' | 'stopped' | 'error';
}

export interface TerminalExecResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime?: number;
}

class TerminalService {
  private static instance: TerminalService;
  private sessions: Map<string, TerminalSession> = new Map();

  private constructor() {}

  static getInstance(): TerminalService {
    if (!TerminalService.instance) {
      TerminalService.instance = new TerminalService();
    }
    return TerminalService.instance;
  }

  /**
   * Generate session key from guild and channel IDs
   */
  private getSessionKey(guildId: string, channelId: string): string {
    return `${guildId}:${channelId}`;
  }

  /**
   * Start a terminal session for a channel
   */
  async start(
    guildId: string,
    channelId: string,
    userId: string,
    userName?: string
  ): Promise<{ session: TerminalSession; isNew: boolean }> {
    const key = this.getSessionKey(guildId, channelId);

    // Check if session already exists locally
    const existingSession = this.sessions.get(key);
    if (existingSession && existingSession.status === 'running') {
      // Verify with Core that it's still running
      try {
        const status = await this.getStatus(guildId, channelId);
        if (status.exists && status.status === 'running') {
          console.log(`[Terminal] Session already running for ${key}`);
          return { session: existingSession, isNew: false };
        }
      } catch {
        // Session may have been cleaned up, continue to start new one
      }
    }

    console.log(`[Terminal] Starting session for ${key}`);

    const client = getContainerClient();
    const context: UserContext = {
      userId,
      userName,
      guildId,
      channelId,
    };

    const response = await client.start(context);

    const session: TerminalSession = {
      containerId: response.containerId,
      guildId,
      channelId,
      startedBy: userId,
      startedAt: new Date(),
      status: 'running',
    };

    this.sessions.set(key, session);
    console.log(`[Terminal] Session started: ${response.containerId}`);

    return { session, isNew: true };
  }

  /**
   * Stop a terminal session
   */
  async stop(guildId: string, channelId: string): Promise<boolean> {
    const key = this.getSessionKey(guildId, channelId);

    console.log(`[Terminal] Stopping session for ${key}`);

    const client = getContainerClient();
    const context: UserContext = {
      userId: '',
      guildId,
      channelId,
    };

    try {
      await client.stop(context);
      this.sessions.delete(key);
      console.log(`[Terminal] Session stopped for ${key}`);
      return true;
    } catch (error) {
      console.error(`[Terminal] Failed to stop session for ${key}:`, error);
      // Still remove from local tracking
      this.sessions.delete(key);
      return false;
    }
  }

  /**
   * Execute a command in the terminal
   */
  async exec(
    guildId: string,
    channelId: string,
    command: string,
    timeout?: number
  ): Promise<TerminalExecResult> {
    const key = this.getSessionKey(guildId, channelId);

    console.log(`[Terminal] Executing in ${key}: ${command}`);

    const client = getContainerClient();
    const context: UserContext = {
      userId: '',
      guildId,
      channelId,
    };

    const startTime = Date.now();
    const response = await client.exec(context, { command, timeout });
    const executionTime = Date.now() - startTime;

    return {
      success: response.success,
      stdout: response.stdout,
      stderr: response.stderr,
      exitCode: response.exitCode,
      executionTime,
    };
  }

  /**
   * Get terminal status
   */
  async getStatus(
    guildId: string,
    channelId: string
  ): Promise<ContainerStatusResponse> {
    const client = getContainerClient();
    const context: UserContext = {
      userId: '',
      guildId,
      channelId,
    };

    return client.status(context);
  }

  /**
   * Check if a terminal is running for this channel (local check)
   */
  hasSession(guildId: string, channelId: string): boolean {
    const key = this.getSessionKey(guildId, channelId);
    const session = this.sessions.get(key);
    return session?.status === 'running';
  }

  /**
   * Get local session info
   */
  getSession(guildId: string, channelId: string): TerminalSession | null {
    const key = this.getSessionKey(guildId, channelId);
    return this.sessions.get(key) || null;
  }

  /**
   * List all active sessions for a guild
   */
  getGuildSessions(guildId: string): TerminalSession[] {
    const sessions: TerminalSession[] = [];
    for (const session of this.sessions.values()) {
      if (session.guildId === guildId && session.status === 'running') {
        sessions.push(session);
      }
    }
    return sessions;
  }

  /**
   * Get WebSocket URL for terminal connection
   */
  getWsUrl(guildId: string, channelId: string): string {
    const client = getContainerClient();
    return client.getTerminalWsUrl({
      userId: '',
      guildId,
      channelId,
    });
  }

  /**
   * Health check for Core container API
   */
  async healthCheck(): Promise<boolean> {
    const client = getContainerClient();
    return client.healthCheck();
  }
}

export default TerminalService.getInstance();
export { TerminalService };
