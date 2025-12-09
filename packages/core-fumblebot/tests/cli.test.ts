/**
 * @crit-fumble/core-fumblebot CLI Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TerminalCLI,
  createTerminalCLI,
  type TerminalCLIConfig,
} from '../src/cli/index.js';

// Mock fetch response helper
function createMockResponse(data: unknown, status = 200, ok = true): Response {
  return {
    ok,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: vi.fn().mockResolvedValue(data),
    headers: new Headers(),
    redirected: false,
    type: 'basic',
    url: '',
    clone: vi.fn(),
    body: null,
    bodyUsed: false,
    arrayBuffer: vi.fn(),
    blob: vi.fn(),
    formData: vi.fn(),
    text: vi.fn(),
  } as unknown as Response;
}

// Create a mock fetch function
function createMockFetch(response: Response | ((url: string) => Response)) {
  if (typeof response === 'function') {
    return vi.fn().mockImplementation((url: string) => Promise.resolve(response(url)));
  }
  return vi.fn().mockResolvedValue(response);
}

describe('TerminalCLI', () => {
  const baseConfig: TerminalCLIConfig = {
    baseUrl: 'https://api.fumblebot.test',
    apiKey: 'test-api-key',
    guildId: 'guild123',
    channelId: 'channel123',
  };

  describe('constructor', () => {
    it('should create CLI with required config', () => {
      const mockFetch = createMockFetch(createMockResponse({}));
      const cli = new TerminalCLI({ ...baseConfig, fetch: mockFetch });
      expect(cli).toBeInstanceOf(TerminalCLI);
    });

    it('should accept optional guildId and channelId', () => {
      const mockFetch = createMockFetch(createMockResponse({}));
      const cli = new TerminalCLI({
        baseUrl: 'https://api.fumblebot.test',
        apiKey: 'test-api-key',
        fetch: mockFetch,
      });
      expect(cli).toBeInstanceOf(TerminalCLI);
      expect(cli.connected).toBe(false);
    });

    it('should start in disconnected state', () => {
      const mockFetch = createMockFetch(createMockResponse({}));
      const cli = new TerminalCLI({ ...baseConfig, fetch: mockFetch });
      expect(cli.connected).toBe(false);
    });

    it('should have null containerId initially', () => {
      const mockFetch = createMockFetch(createMockResponse({}));
      const cli = new TerminalCLI({ ...baseConfig, fetch: mockFetch });
      expect(cli.currentContainerId).toBeNull();
    });
  });

  describe('connect', () => {
    it('should connect successfully with config guildId and channelId', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        containerId: 'container123',
        status: 'running',
        port: 8080,
        createdAt: new Date().toISOString(),
      }));
      const cli = new TerminalCLI({ ...baseConfig, fetch: mockFetch });

      const result = await cli.connect();

      expect(result.success).toBe(true);
      expect(result.containerId).toBe('container123');
      expect(cli.connected).toBe(true);
      expect(cli.currentContainerId).toBe('container123');
    });

    it('should connect with provided guildId and channelId', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        containerId: 'container456',
        status: 'running',
        port: 8080,
        createdAt: new Date().toISOString(),
      }));
      const cli = new TerminalCLI({
        baseUrl: 'https://api.fumblebot.test',
        apiKey: 'test-api-key',
        fetch: mockFetch,
      });

      const result = await cli.connect('guild456', 'channel456');

      expect(result.success).toBe(true);
      expect(result.containerId).toBe('container456');
      expect(cli.connected).toBe(true);
    });

    it('should pass userId and userName to terminalStart', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        containerId: 'container123',
        status: 'running',
        port: 8080,
        createdAt: new Date().toISOString(),
      }));
      const cli = new TerminalCLI({ ...baseConfig, fetch: mockFetch });

      await cli.connect(undefined, undefined, 'user123', 'TestUser');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/terminal/start'),
        expect.objectContaining({
          body: JSON.stringify({
            guildId: 'guild123',
            channelId: 'channel123',
            userId: 'user123',
            userName: 'TestUser',
          }),
        })
      );
    });

    it('should return error when guildId is missing', async () => {
      const mockFetch = createMockFetch(createMockResponse({}));
      const cli = new TerminalCLI({
        baseUrl: 'https://api.fumblebot.test',
        apiKey: 'test-api-key',
        fetch: mockFetch,
      });

      const result = await cli.connect(undefined, 'channel123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Guild ID and Channel ID are required');
    });

    it('should return error when channelId is missing', async () => {
      const mockFetch = createMockFetch(createMockResponse({}));
      const cli = new TerminalCLI({
        baseUrl: 'https://api.fumblebot.test',
        apiKey: 'test-api-key',
        fetch: mockFetch,
      });

      const result = await cli.connect('guild123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Guild ID and Channel ID are required');
    });

    it('should handle connection errors', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Connection refused'));
      const cli = new TerminalCLI({ ...baseConfig, fetch: mockFetch });

      const result = await cli.connect();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
      expect(cli.connected).toBe(false);
    });

    it('should handle non-Error exceptions', async () => {
      // When a non-Error is thrown, FumbleBotClient wraps it in FumbleBotError
      // with 'Unknown error' message, which then gets propagated
      const mockFetch = vi.fn().mockRejectedValue('Unknown error');
      const cli = new TerminalCLI({ ...baseConfig, fetch: mockFetch });

      const result = await cli.connect();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });
  });

  describe('disconnect', () => {
    it('should disconnect successfully', async () => {
      const mockFetch = createMockFetch((url: string) => {
        if (url.includes('/terminal/start')) {
          return createMockResponse({
            containerId: 'container123',
            status: 'running',
            port: 8080,
            createdAt: new Date().toISOString(),
          });
        }
        return createMockResponse({ success: true, message: 'Terminal stopped' });
      });
      const cli = new TerminalCLI({ ...baseConfig, fetch: mockFetch });

      await cli.connect();
      const result = await cli.disconnect();

      expect(result.success).toBe(true);
      expect(cli.connected).toBe(false);
      expect(cli.currentContainerId).toBeNull();
    });

    it('should return error when not connected', async () => {
      const mockFetch = createMockFetch(createMockResponse({}));
      const cli = new TerminalCLI({
        baseUrl: 'https://api.fumblebot.test',
        apiKey: 'test-api-key',
        fetch: mockFetch,
      });

      const result = await cli.disconnect();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not connected');
    });

    it('should handle disconnect errors', async () => {
      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(createMockResponse({
            containerId: 'container123',
            status: 'running',
            port: 8080,
            createdAt: new Date().toISOString(),
          }));
        }
        return Promise.reject(new Error('Failed to stop terminal'));
      });
      const cli = new TerminalCLI({ ...baseConfig, fetch: mockFetch });

      await cli.connect();
      const result = await cli.disconnect();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to stop terminal');
    });

    it('should handle non-Error exceptions on disconnect', async () => {
      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(createMockResponse({
            containerId: 'container123',
            status: 'running',
            port: 8080,
            createdAt: new Date().toISOString(),
          }));
        }
        // When a non-Error is thrown, FumbleBotClient wraps it in FumbleBotError
        return Promise.reject('Unknown disconnect error');
      });
      const cli = new TerminalCLI({ ...baseConfig, fetch: mockFetch });

      await cli.connect();
      const result = await cli.disconnect();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });
  });

  describe('exec', () => {
    it('should execute command successfully', async () => {
      const mockFetch = createMockFetch((url: string) => {
        if (url.includes('/terminal/start')) {
          return createMockResponse({
            containerId: 'container123',
            status: 'running',
            port: 8080,
            createdAt: new Date().toISOString(),
          });
        }
        if (url.includes('/terminal/exec')) {
          return createMockResponse({
            success: true,
            stdout: 'You rolled a 15!',
            stderr: '',
            exitCode: 0,
            executionTime: 50,
          });
        }
        return createMockResponse({});
      });
      const cli = new TerminalCLI({ ...baseConfig, fetch: mockFetch });

      await cli.connect();
      const result = await cli.exec('roll 1d20');

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('15');
      expect(result.exitCode).toBe(0);
    });

    it('should return error response when not connected', async () => {
      const mockFetch = createMockFetch(createMockResponse({}));
      const cli = new TerminalCLI({
        baseUrl: 'https://api.fumblebot.test',
        apiKey: 'test-api-key',
        fetch: mockFetch,
      });

      const result = await cli.exec('roll 1d20');

      expect(result.success).toBe(false);
      expect(result.stderr).toBe('Not connected to a terminal session');
      expect(result.exitCode).toBe(-1);
    });

    it('should pass timeout parameter', async () => {
      const mockFetch = createMockFetch((url: string) => {
        if (url.includes('/terminal/start')) {
          return createMockResponse({
            containerId: 'container123',
            status: 'running',
            port: 8080,
            createdAt: new Date().toISOString(),
          });
        }
        return createMockResponse({
          success: true,
          stdout: 'output',
          stderr: '',
          exitCode: 0,
        });
      });
      const cli = new TerminalCLI({ ...baseConfig, fetch: mockFetch });

      await cli.connect();
      await cli.exec('long-running-command', 60000);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/terminal/exec'),
        expect.objectContaining({
          body: JSON.stringify({
            guildId: 'guild123',
            channelId: 'channel123',
            command: 'long-running-command',
            timeout: 60000,
          }),
        })
      );
    });

    it('should handle failed command execution', async () => {
      const mockFetch = createMockFetch((url: string) => {
        if (url.includes('/terminal/start')) {
          return createMockResponse({
            containerId: 'container123',
            status: 'running',
            port: 8080,
            createdAt: new Date().toISOString(),
          });
        }
        return createMockResponse({
          success: false,
          stdout: '',
          stderr: 'Command not found',
          exitCode: 127,
        });
      });
      const cli = new TerminalCLI({ ...baseConfig, fetch: mockFetch });

      await cli.connect();
      const result = await cli.exec('invalid-command');

      expect(result.success).toBe(false);
      expect(result.stderr).toBe('Command not found');
      expect(result.exitCode).toBe(127);
    });
  });

  describe('status', () => {
    it('should return status when connected', async () => {
      const mockFetch = createMockFetch((url: string) => {
        if (url.includes('/terminal/start')) {
          return createMockResponse({
            containerId: 'container123',
            status: 'running',
            port: 8080,
            createdAt: new Date().toISOString(),
          });
        }
        if (url.includes('/terminal/status')) {
          return createMockResponse({
            exists: true,
            containerId: 'container123',
            status: 'running',
            port: 8080,
            uptime: 3600,
          });
        }
        return createMockResponse({});
      });
      const cli = new TerminalCLI({ ...baseConfig, fetch: mockFetch });

      await cli.connect();
      const result = await cli.status();

      expect(result.exists).toBe(true);
      expect(result.status).toBe('running');
    });

    it('should return exists: false when not connected', async () => {
      const mockFetch = createMockFetch(createMockResponse({}));
      const cli = new TerminalCLI({
        baseUrl: 'https://api.fumblebot.test',
        apiKey: 'test-api-key',
        fetch: mockFetch,
      });

      const result = await cli.status();

      expect(result.exists).toBe(false);
    });
  });

  describe('getWsUrl', () => {
    it('should return WebSocket URL when connected', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        containerId: 'container123',
        status: 'running',
        port: 8080,
        createdAt: new Date().toISOString(),
      }));
      const cli = new TerminalCLI({ ...baseConfig, fetch: mockFetch });

      await cli.connect();
      const wsUrl = cli.getWsUrl();

      expect(wsUrl).toBe('wss://api.fumblebot.test/terminal/ws?guildId=guild123&channelId=channel123');
    });

    it('should return null when not connected', async () => {
      const mockFetch = createMockFetch(createMockResponse({}));
      const cli = new TerminalCLI({
        baseUrl: 'https://api.fumblebot.test',
        apiKey: 'test-api-key',
        fetch: mockFetch,
      });

      const wsUrl = cli.getWsUrl();

      expect(wsUrl).toBeNull();
    });
  });

  describe('connected getter', () => {
    it('should return false initially', () => {
      const mockFetch = createMockFetch(createMockResponse({}));
      const cli = new TerminalCLI({ ...baseConfig, fetch: mockFetch });

      expect(cli.connected).toBe(false);
    });

    it('should return true after successful connect', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        containerId: 'container123',
        status: 'running',
        port: 8080,
        createdAt: new Date().toISOString(),
      }));
      const cli = new TerminalCLI({ ...baseConfig, fetch: mockFetch });

      await cli.connect();

      expect(cli.connected).toBe(true);
    });

    it('should return false after disconnect', async () => {
      const mockFetch = createMockFetch((url: string) => {
        if (url.includes('/terminal/start')) {
          return createMockResponse({
            containerId: 'container123',
            status: 'running',
            port: 8080,
            createdAt: new Date().toISOString(),
          });
        }
        return createMockResponse({ success: true });
      });
      const cli = new TerminalCLI({ ...baseConfig, fetch: mockFetch });

      await cli.connect();
      await cli.disconnect();

      expect(cli.connected).toBe(false);
    });
  });

  describe('currentContainerId getter', () => {
    it('should return null initially', () => {
      const mockFetch = createMockFetch(createMockResponse({}));
      const cli = new TerminalCLI({ ...baseConfig, fetch: mockFetch });

      expect(cli.currentContainerId).toBeNull();
    });

    it('should return containerId after connect', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        containerId: 'container123',
        status: 'running',
        port: 8080,
        createdAt: new Date().toISOString(),
      }));
      const cli = new TerminalCLI({ ...baseConfig, fetch: mockFetch });

      await cli.connect();

      expect(cli.currentContainerId).toBe('container123');
    });

    it('should return null after disconnect', async () => {
      const mockFetch = createMockFetch((url: string) => {
        if (url.includes('/terminal/start')) {
          return createMockResponse({
            containerId: 'container123',
            status: 'running',
            port: 8080,
            createdAt: new Date().toISOString(),
          });
        }
        return createMockResponse({ success: true });
      });
      const cli = new TerminalCLI({ ...baseConfig, fetch: mockFetch });

      await cli.connect();
      await cli.disconnect();

      expect(cli.currentContainerId).toBeNull();
    });
  });
});

describe('createTerminalCLI', () => {
  it('should create a TerminalCLI instance', () => {
    const mockFetch = createMockFetch(createMockResponse({}));
    const cli = createTerminalCLI({
      baseUrl: 'https://api.fumblebot.test',
      apiKey: 'test-key',
      guildId: 'guild123',
      channelId: 'channel123',
      fetch: mockFetch,
    });

    expect(cli).toBeInstanceOf(TerminalCLI);
  });
});

describe('runTerminalREPL', () => {
  // Import the function
  let runTerminalREPL: typeof import('../src/cli/index.js').runTerminalREPL;

  beforeEach(async () => {
    const cli = await import('../src/cli/index.js');
    runTerminalREPL = cli.runTerminalREPL;
  });

  it('should exit early when guildId is missing', async () => {
    const mockFetch = createMockFetch(createMockResponse({}));
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await runTerminalREPL({
        baseUrl: 'https://api.fumblebot.test',
        apiKey: 'test-key',
        channelId: 'channel123', // Missing guildId
        fetch: mockFetch,
      });
    } catch (e) {
      // Expected - process.exit throws
    }

    expect(consoleSpy).toHaveBeenCalledWith('Error: guildId and channelId are required');
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('should exit early when channelId is missing', async () => {
    const mockFetch = createMockFetch(createMockResponse({}));
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await runTerminalREPL({
        baseUrl: 'https://api.fumblebot.test',
        apiKey: 'test-key',
        guildId: 'guild123', // Missing channelId
        fetch: mockFetch,
      });
    } catch (e) {
      // Expected - process.exit throws
    }

    expect(consoleSpy).toHaveBeenCalledWith('Error: guildId and channelId are required');
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('should exit when connection fails', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Connection failed'));
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await runTerminalREPL({
        baseUrl: 'https://api.fumblebot.test',
        apiKey: 'test-key',
        guildId: 'guild123',
        channelId: 'channel123',
        fetch: mockFetch,
      });
    } catch (e) {
      // Expected - process.exit throws
    }

    expect(consoleLogSpy).toHaveBeenCalledWith('Connecting to adventure terminal...');
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to connect:'));
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should connect successfully and set up readline', async () => {
    // Mock successful connection
    const mockFetch = createMockFetch((url: string) => {
      if (url.includes('/terminal/start')) {
        return createMockResponse({
          containerId: 'container123',
          status: 'running',
          port: 8080,
          createdAt: new Date().toISOString(),
        });
      }
      if (url.includes('/terminal/stop')) {
        return createMockResponse({ success: true });
      }
      return createMockResponse({});
    });

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Mock readline module
    const mockClose = vi.fn();
    const mockQuestion = vi.fn((prompt: string, callback: (input: string) => void) => {
      // Simulate user typing 'exit'
      setTimeout(() => callback('exit'), 10);
    });

    vi.doMock('readline', () => ({
      createInterface: vi.fn().mockReturnValue({
        question: mockQuestion,
        close: mockClose,
      }),
    }));

    const promise = runTerminalREPL({
      baseUrl: 'https://api.fumblebot.test',
      apiKey: 'test-key',
      guildId: 'guild123',
      channelId: 'channel123',
      fetch: mockFetch,
    });

    // Wait a bit for async operations
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(consoleLogSpy).toHaveBeenCalledWith('Connecting to adventure terminal...');
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Connected to terminal'));

    vi.doUnmock('readline');
    consoleLogSpy.mockRestore();
  });
});
