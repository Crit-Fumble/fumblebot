/**
 * Terminal Service Tests
 * Tests for terminal session management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the container client before importing terminal service
vi.mock('../../../../src/services/container/client.js', () => {
  const mockContainerClient = {
    start: vi.fn(),
    stop: vi.fn(),
    status: vi.fn(),
    exec: vi.fn(),
    healthCheck: vi.fn(),
    getTerminalWsUrl: vi.fn(),
  };

  return {
    getContainerClient: () => mockContainerClient,
    ContainerClient: vi.fn(),
    __mockClient: mockContainerClient, // Expose for test access
  };
});

// Import after mocking
import { TerminalService } from '../../../../src/services/terminal/terminal-service.js';
import { getContainerClient } from '../../../../src/services/container/client.js';

describe('Terminal Service', () => {
  let service: TerminalService;
  let mockClient: ReturnType<typeof getContainerClient>;

  beforeEach(() => {
    // Get fresh instance and mock client
    service = TerminalService.getInstance();
    mockClient = getContainerClient();

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clear all sessions after each test
    vi.clearAllMocks();
  });

  describe('start', () => {
    it('should start a new terminal session', async () => {
      const mockResponse = {
        containerId: 'container123',
        status: 'running',
        port: 3000,
        createdAt: new Date().toISOString(),
      };

      vi.mocked(mockClient.start).mockResolvedValue(mockResponse);

      const result = await service.start('guild1', 'channel1', 'user1', 'testuser');

      expect(result.isNew).toBe(true);
      expect(result.session.containerId).toBe('container123');
      expect(result.session.guildId).toBe('guild1');
      expect(result.session.channelId).toBe('channel1');
      expect(result.session.startedBy).toBe('user1');
      expect(result.session.status).toBe('running');

      expect(mockClient.start).toHaveBeenCalledWith({
        userId: 'user1',
        userName: 'testuser',
        guildId: 'guild1',
        channelId: 'channel1',
      });
    });

    it('should return existing session if already running', async () => {
      // First start
      const mockResponse = {
        containerId: 'container123',
        status: 'running',
        port: 3000,
        createdAt: new Date().toISOString(),
      };

      vi.mocked(mockClient.start).mockResolvedValue(mockResponse);
      vi.mocked(mockClient.status).mockResolvedValue({
        exists: true,
        status: 'running',
        containerId: 'container123',
      });

      await service.start('guild2', 'channel2', 'user1');

      // Second start - should return existing
      const result = await service.start('guild2', 'channel2', 'user2');

      expect(result.isNew).toBe(false);
      expect(result.session.startedBy).toBe('user1'); // Original starter
      expect(mockClient.start).toHaveBeenCalledTimes(1); // Only called once
    });
  });

  describe('stop', () => {
    it('should stop a terminal session', async () => {
      // Start a session first
      const mockStartResponse = {
        containerId: 'container123',
        status: 'running',
        port: 3000,
        createdAt: new Date().toISOString(),
      };

      vi.mocked(mockClient.start).mockResolvedValue(mockStartResponse);
      vi.mocked(mockClient.stop).mockResolvedValue({ success: true });

      await service.start('guild3', 'channel3', 'user1');

      const stopped = await service.stop('guild3', 'channel3');

      expect(stopped).toBe(true);
      expect(mockClient.stop).toHaveBeenCalled();
    });

    it('should return false if stop fails but still remove from local tracking', async () => {
      const mockStartResponse = {
        containerId: 'container123',
        status: 'running',
        port: 3000,
        createdAt: new Date().toISOString(),
      };

      vi.mocked(mockClient.start).mockResolvedValue(mockStartResponse);
      vi.mocked(mockClient.stop).mockRejectedValue(new Error('Stop failed'));

      await service.start('guild4', 'channel4', 'user1');

      const stopped = await service.stop('guild4', 'channel4');

      expect(stopped).toBe(false);
      expect(service.hasSession('guild4', 'channel4')).toBe(false);
    });
  });

  describe('exec', () => {
    it('should execute a command in the terminal', async () => {
      const mockExecResponse = {
        success: true,
        stdout: 'Hello World',
        stderr: '',
        exitCode: 0,
      };

      vi.mocked(mockClient.exec).mockResolvedValue(mockExecResponse);

      const result = await service.exec('guild1', 'channel1', 'echo "Hello World"');

      expect(result.success).toBe(true);
      expect(result.stdout).toBe('Hello World');
      expect(result.exitCode).toBe(0);
      expect(result.executionTime).toBeDefined();
    });

    it('should pass timeout option to exec', async () => {
      vi.mocked(mockClient.exec).mockResolvedValue({
        success: true,
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      await service.exec('guild1', 'channel1', 'sleep 5', 10000);

      expect(mockClient.exec).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ timeout: 10000 })
      );
    });
  });

  describe('hasSession', () => {
    it('should return true for active sessions', async () => {
      const mockResponse = {
        containerId: 'container123',
        status: 'running',
        port: 3000,
        createdAt: new Date().toISOString(),
      };

      vi.mocked(mockClient.start).mockResolvedValue(mockResponse);

      await service.start('guild5', 'channel5', 'user1');

      expect(service.hasSession('guild5', 'channel5')).toBe(true);
    });

    it('should return false for non-existent sessions', () => {
      expect(service.hasSession('nonexistent', 'channel')).toBe(false);
    });
  });

  describe('getSession', () => {
    it('should return session info for active sessions', async () => {
      const mockResponse = {
        containerId: 'container123',
        status: 'running',
        port: 3000,
        createdAt: new Date().toISOString(),
      };

      vi.mocked(mockClient.start).mockResolvedValue(mockResponse);

      await service.start('guild6', 'channel6', 'user1');

      const session = service.getSession('guild6', 'channel6');

      expect(session).not.toBeNull();
      expect(session?.containerId).toBe('container123');
    });

    it('should return null for non-existent sessions', () => {
      expect(service.getSession('nonexistent', 'channel')).toBeNull();
    });
  });

  describe('getGuildSessions', () => {
    it('should return all sessions for a guild', async () => {
      const mockResponse = {
        containerId: 'container123',
        status: 'running',
        port: 3000,
        createdAt: new Date().toISOString(),
      };

      vi.mocked(mockClient.start).mockResolvedValue(mockResponse);

      await service.start('guild7', 'channel7a', 'user1');

      // Mock different container ID for second start
      vi.mocked(mockClient.start).mockResolvedValue({
        ...mockResponse,
        containerId: 'container456',
      });

      await service.start('guild7', 'channel7b', 'user2');

      const sessions = service.getGuildSessions('guild7');

      expect(sessions.length).toBe(2);
      expect(sessions.some((s) => s.channelId === 'channel7a')).toBe(true);
      expect(sessions.some((s) => s.channelId === 'channel7b')).toBe(true);
    });

    it('should not include sessions from other guilds', async () => {
      const mockResponse = {
        containerId: 'container123',
        status: 'running',
        port: 3000,
        createdAt: new Date().toISOString(),
      };

      vi.mocked(mockClient.start).mockResolvedValue(mockResponse);

      await service.start('guild8', 'channel8', 'user1');

      vi.mocked(mockClient.start).mockResolvedValue({
        ...mockResponse,
        containerId: 'container456',
      });

      await service.start('otherguild', 'channel9', 'user2');

      const sessions = service.getGuildSessions('guild8');

      expect(sessions.length).toBe(1);
      expect(sessions[0].channelId).toBe('channel8');
    });
  });

  describe('getWsUrl', () => {
    it('should return WebSocket URL from container client', () => {
      const expectedUrl = 'wss://core.example.com/api/container/terminal?guildId=g1&channelId=c1';
      vi.mocked(mockClient.getTerminalWsUrl).mockReturnValue(expectedUrl);

      const url = service.getWsUrl('g1', 'c1');

      expect(url).toBe(expectedUrl);
    });
  });

  describe('healthCheck', () => {
    it('should return true when Core API is healthy', async () => {
      vi.mocked(mockClient.healthCheck).mockResolvedValue(true);

      const healthy = await service.healthCheck();

      expect(healthy).toBe(true);
    });

    it('should return false when Core API is unhealthy', async () => {
      vi.mocked(mockClient.healthCheck).mockResolvedValue(false);

      const healthy = await service.healthCheck();

      expect(healthy).toBe(false);
    });
  });
});
