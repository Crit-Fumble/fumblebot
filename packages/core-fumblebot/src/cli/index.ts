/**
 * Adventure Terminal CLI
 *
 * Interactive command-line interface for the adventure terminal.
 * Allows connecting to and interacting with terminal sessions.
 *
 * @example
 * ```bash
 * # Using npx
 * npx @crit-fumble/core-fumblebot terminal --guild 123 --channel 456
 *
 * # Or via API in code
 * import { TerminalCLI } from '@crit-fumble/core-fumblebot/cli';
 * const cli = new TerminalCLI({ baseUrl, apiKey });
 * await cli.connect(guildId, channelId);
 * ```
 */

import { createFumbleBotClient, type FumbleBotClient, type FumbleBotClientConfig } from '../client/index.js';
import type { TerminalExecResponse, TerminalStatusResponse } from '../types/index.js';

export interface TerminalCLIConfig extends FumbleBotClientConfig {
  /** Guild ID to connect to */
  guildId?: string;
  /** Channel ID to connect to */
  channelId?: string;
  /** User ID for the session */
  userId?: string;
  /** Username for terminal prompt */
  userName?: string;
}

/**
 * Interactive terminal client for adventure terminal sessions
 */
export class TerminalCLI {
  private client: FumbleBotClient;
  private guildId: string | null = null;
  private channelId: string | null = null;
  private containerId: string | null = null;
  private isConnected = false;

  constructor(config: TerminalCLIConfig) {
    this.client = createFumbleBotClient(config);
    this.guildId = config.guildId ?? null;
    this.channelId = config.channelId ?? null;
  }

  /**
   * Connect to an adventure terminal session
   */
  async connect(
    guildId?: string,
    channelId?: string,
    userId?: string,
    userName?: string
  ): Promise<{ success: boolean; containerId?: string; error?: string }> {
    const targetGuildId = guildId ?? this.guildId;
    const targetChannelId = channelId ?? this.channelId;

    if (!targetGuildId || !targetChannelId) {
      return { success: false, error: 'Guild ID and Channel ID are required' };
    }

    try {
      const result = await this.client.terminalStart({
        guildId: targetGuildId,
        channelId: targetChannelId,
        userId,
        userName,
      });

      this.guildId = targetGuildId;
      this.channelId = targetChannelId;
      this.containerId = result.containerId;
      this.isConnected = true;

      return { success: true, containerId: result.containerId };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect',
      };
    }
  }

  /**
   * Disconnect from the terminal session
   */
  async disconnect(): Promise<{ success: boolean; error?: string }> {
    if (!this.guildId || !this.channelId) {
      return { success: false, error: 'Not connected' };
    }

    try {
      await this.client.terminalStop(this.guildId, this.channelId);
      this.isConnected = false;
      this.containerId = null;
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to disconnect',
      };
    }
  }

  /**
   * Execute a command in the terminal
   */
  async exec(command: string, timeout?: number): Promise<TerminalExecResponse> {
    if (!this.guildId || !this.channelId) {
      return {
        success: false,
        stdout: '',
        stderr: 'Not connected to a terminal session',
        exitCode: -1,
      };
    }

    return this.client.terminalExec({
      guildId: this.guildId,
      channelId: this.channelId,
      command,
      timeout,
    });
  }

  /**
   * Get terminal status
   */
  async status(): Promise<TerminalStatusResponse> {
    if (!this.guildId || !this.channelId) {
      return { exists: false };
    }

    return this.client.terminalStatus(this.guildId, this.channelId);
  }

  /**
   * Get WebSocket URL for direct connection
   */
  getWsUrl(): string | null {
    if (!this.guildId || !this.channelId) {
      return null;
    }
    return this.client.getTerminalWsUrl(this.guildId, this.channelId);
  }

  /**
   * Check if connected
   */
  get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Get current container ID
   */
  get currentContainerId(): string | null {
    return this.containerId;
  }
}

/**
 * Create a terminal CLI instance
 */
export function createTerminalCLI(config: TerminalCLIConfig): TerminalCLI {
  return new TerminalCLI(config);
}

/**
 * Simple REPL-style terminal runner
 * Reads commands from stdin and outputs to stdout
 */
export async function runTerminalREPL(config: TerminalCLIConfig): Promise<void> {
  const cli = new TerminalCLI(config);

  // Check if we have required config
  if (!config.guildId || !config.channelId) {
    console.error('Error: guildId and channelId are required');
    process.exit(1);
  }

  console.log('Connecting to adventure terminal...');
  const connectResult = await cli.connect();

  if (!connectResult.success) {
    console.error(`Failed to connect: ${connectResult.error}`);
    process.exit(1);
  }

  console.log(`Connected to terminal: ${connectResult.containerId}`);
  console.log('Type commands to execute. Type "exit" or "quit" to disconnect.\n');

  // Set up readline for interactive input
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = () => {
    rl.question('terminal> ', async (input) => {
      const trimmed = input.trim();

      if (trimmed === 'exit' || trimmed === 'quit') {
        console.log('Disconnecting...');
        await cli.disconnect();
        rl.close();
        return;
      }

      if (trimmed === 'status') {
        const status = await cli.status();
        console.log('Status:', JSON.stringify(status, null, 2));
        prompt();
        return;
      }

      if (trimmed === '') {
        prompt();
        return;
      }

      try {
        const result = await cli.exec(trimmed);
        if (result.stdout) {
          console.log(result.stdout);
        }
        if (result.stderr) {
          console.error(result.stderr);
        }
        if (!result.success) {
          console.log(`Exit code: ${result.exitCode}`);
        }
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
      }

      prompt();
    });
  };

  prompt();
}
