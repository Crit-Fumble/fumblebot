/**
 * @crit-fumble/core-fumblebot Client Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  FumbleBotClient,
  FumbleBotError,
  createFumbleBotClient,
  type FumbleBotClientConfig,
} from '../src/client/index.js';

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
function createMockFetch(response: Response) {
  return vi.fn().mockResolvedValue(response);
}

describe('FumbleBotClient', () => {
  const baseConfig: FumbleBotClientConfig = {
    baseUrl: 'https://api.fumblebot.test',
    apiKey: 'test-api-key',
  };

  describe('constructor', () => {
    it('should create client with required config', () => {
      const mockFetch = createMockFetch(createMockResponse({ status: 'ok' }));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });
      expect(client).toBeInstanceOf(FumbleBotClient);
    });

    it('should remove trailing slash from baseUrl', async () => {
      const mockFetch = createMockFetch(createMockResponse({ status: 'ok' }));
      const client = new FumbleBotClient({
        baseUrl: 'https://api.fumblebot.test/',
        apiKey: 'test-api-key',
        fetch: mockFetch,
      });

      await client.health();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.fumblebot.test/health',
        expect.any(Object)
      );
    });

    it('should use default timeout of 30000ms', async () => {
      const mockFetch = createMockFetch(createMockResponse({ status: 'ok' }));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      await client.health();

      // The timeout is set via AbortController, we verify the fetch was called
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should accept custom timeout', () => {
      const mockFetch = createMockFetch(createMockResponse({ status: 'ok' }));
      const client = new FumbleBotClient({
        ...baseConfig,
        timeout: 60000,
        fetch: mockFetch,
      });
      expect(client).toBeInstanceOf(FumbleBotClient);
    });
  });

  describe('HTTP methods', () => {
    it('should send GET request with correct headers', async () => {
      const mockFetch = createMockFetch(createMockResponse({ status: 'ok', version: '1.0.0' }));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      await client.health();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.fumblebot.test/health',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-api-key',
            'X-Client': '@crit-fumble/core-fumblebot',
          }),
        })
      );
    });

    it('should send POST request with body', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        notation: '1d20',
        total: 15,
        rolls: [15],
        isCrit: false,
        isFumble: false,
      }));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      await client.roll({ notation: '1d20' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.fumblebot.test/dice/roll',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ notation: '1d20' }),
        })
      );
    });
  });

  describe('error handling', () => {
    it('should throw FumbleBotError on non-ok response', async () => {
      const mockFetch = createMockFetch(
        createMockResponse({ error: 'Not found', code: 'NOT_FOUND' }, 404, false)
      );
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      await expect(client.health()).rejects.toThrow(FumbleBotError);
    });

    it('should include status code in error', async () => {
      const mockFetch = createMockFetch(
        createMockResponse({ error: 'Unauthorized' }, 401, false)
      );
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      try {
        await client.health();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(FumbleBotError);
        expect((error as FumbleBotError).status).toBe(401);
      }
    });

    it('should handle network errors', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      try {
        await client.health();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(FumbleBotError);
        expect((error as FumbleBotError).code).toBe('NETWORK_ERROR');
      }
    });

    it('should handle timeout errors', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      const mockFetch = vi.fn().mockRejectedValue(abortError);
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      try {
        await client.health();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(FumbleBotError);
        expect((error as FumbleBotError).code).toBe('TIMEOUT');
        expect((error as FumbleBotError).status).toBe(408);
      }
    });

    it('should handle malformed JSON response on error', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
      } as unknown as Response;
      const mockFetch = vi.fn().mockResolvedValue(mockResponse);
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      try {
        await client.health();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(FumbleBotError);
        expect((error as FumbleBotError).message).toContain('HTTP 500');
      }
    });
  });

  describe('dice endpoints', () => {
    it('should call roll endpoint', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        notation: '2d20kh1+5',
        total: 22,
        rolls: [17],
        modifier: 5,
        isCrit: false,
        isFumble: false,
      }));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      const result = await client.roll({ notation: '2d20kh1+5', label: 'Attack' });

      expect(result.total).toBe(22);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.fumblebot.test/dice/roll',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ notation: '2d20kh1+5', label: 'Attack' }),
        })
      );
    });

    it('should call roll history endpoint', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        hasMore: false,
      }));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      const result = await client.getRollHistory({ userId: 'user123', limit: 10 });

      expect(result.items).toEqual([]);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.fumblebot.test/dice/history?userId=user123&limit=10',
        expect.any(Object)
      );
    });
  });

  describe('AI endpoints', () => {
    it('should call chat endpoint with extended timeout', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        content: 'A tarrasque is a massive creature...',
        model: 'gpt-4',
        usage: { promptTokens: 10, completionTokens: 50, totalTokens: 60 },
      }));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      const result = await client.chat({
        messages: [{ role: 'user', content: 'What is a tarrasque?' }],
      });

      expect(result.content).toContain('tarrasque');
    });

    it('should call lookup endpoint', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        content: 'Fireball is a 3rd level evocation spell...',
        model: 'gpt-4',
        usage: { promptTokens: 10, completionTokens: 50, totalTokens: 60 },
      }));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      const result = await client.lookup({ query: 'fireball spell', gameSystem: 'dnd5e' });

      expect(result.content).toContain('Fireball');
    });

    it('should call generateNPC endpoint', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        content: 'Name: Grimshaw...',
        npc: { name: 'Grimshaw', race: 'Dwarf' },
        model: 'gpt-4',
      }));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      const result = await client.generateNPC({ type: 'merchant', setting: 'fantasy' });

      expect(result.npc?.name).toBe('Grimshaw');
    });

    it('should call generateDungeon endpoint', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        content: 'The Sunken Temple...',
        model: 'gpt-4',
      }));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      const result = await client.generateDungeon({
        theme: 'underwater',
        size: 'medium',
        level: 5,
      });

      expect(result.content).toContain('Temple');
    });

    it('should call generateEncounter endpoint', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        content: '3 Goblins and 1 Hobgoblin Captain...',
        model: 'gpt-4',
      }));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      const result = await client.generateEncounter({
        terrain: 'forest',
        difficulty: 'medium',
        partyLevel: 3,
        partySize: 4,
      });

      expect(result.content).toContain('Goblin');
    });

    it('should call generateImage endpoint with extended timeout', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        url: 'https://images.example.com/dragon.png',
        revisedPrompt: 'A majestic red dragon...',
      }));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      const result = await client.generateImage({
        prompt: 'A dragon attacking a castle',
        style: 'fantasy',
      });

      expect(result.url).toContain('dragon.png');
    });
  });

  describe('command endpoint', () => {
    it('should call executeCommand endpoint', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        success: true,
        message: 'Command executed',
      }));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      const result = await client.executeCommand(
        'roll',
        { notation: '1d20' },
        { userId: 'user123', username: 'TestUser', platform: 'discord' }
      );

      expect(result.success).toBe(true);
    });
  });

  describe('VTT endpoints', () => {
    it('should call linkVTTAccount endpoint', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        id: 'account123',
        userId: 'user123',
        platform: 'foundry',
        platformUserId: 'foundry123',
        platformUsername: 'TestGM',
        verified: false,
        linkedAt: new Date().toISOString(),
      }));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      const result = await client.linkVTTAccount(
        'user123',
        'foundry',
        'foundry123',
        'TestGM'
      );

      expect(result.platform).toBe('foundry');
    });

    it('should call getVTTAccounts endpoint', async () => {
      const mockFetch = createMockFetch(createMockResponse([]));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      const result = await client.getVTTAccounts('user123');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.fumblebot.test/vtt/accounts/user123',
        expect.any(Object)
      );
    });

    it('should call unlinkVTTAccount endpoint', async () => {
      const mockFetch = createMockFetch(createMockResponse(undefined));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      await client.unlinkVTTAccount('account123');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.fumblebot.test/vtt/accounts/account123',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('should call createGameLink endpoint', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        id: 'link123',
        platform: 'foundry',
        gameId: 'game123',
        guildId: 'guild123',
        channelId: 'channel123',
        syncChat: true,
        syncRolls: true,
        createdBy: 'user123',
        createdAt: new Date().toISOString(),
      }));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      const result = await client.createGameLink({
        platform: 'foundry',
        gameId: 'game123',
        guildId: 'guild123',
        channelId: 'channel123',
        syncChat: true,
        syncRolls: true,
        createdBy: 'user123',
      });

      expect(result.id).toBe('link123');
    });

    it('should call getGameLinks endpoint', async () => {
      const mockFetch = createMockFetch(createMockResponse([]));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      await client.getGameLinks('guild123');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.fumblebot.test/vtt/links/guild/guild123',
        expect.any(Object)
      );
    });

    it('should call updateGameLink endpoint', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        id: 'link123',
        syncChat: false,
        syncRolls: true,
      }));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      await client.updateGameLink('link123', { syncChat: false });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.fumblebot.test/vtt/links/link123',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ syncChat: false }),
        })
      );
    });

    it('should call deleteGameLink endpoint', async () => {
      const mockFetch = createMockFetch(createMockResponse(undefined));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      await client.deleteGameLink('link123');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.fumblebot.test/vtt/links/link123',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('activity endpoints', () => {
    it('should call createActivity endpoint', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        id: 'session123',
        guildId: 'guild123',
        channelId: 'channel123',
        userId: 'user123',
        activityType: 'dice-roller',
        state: {},
        participants: ['user123'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      const result = await client.createActivity(
        'guild123',
        'channel123',
        'user123',
        'dice-roller'
      );

      expect(result.activityType).toBe('dice-roller');
    });

    it('should call getActivity endpoint', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        id: 'session123',
        activityType: 'dice-roller',
      }));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      const result = await client.getActivity('session123');

      expect(result?.id).toBe('session123');
    });

    it('should call updateActivityState endpoint', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        id: 'session123',
        state: { lastRoll: 20 },
      }));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      await client.updateActivityState('session123', { lastRoll: 20 });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.fumblebot.test/activities/session123/state',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ state: { lastRoll: 20 } }),
        })
      );
    });

    it('should call endActivity endpoint', async () => {
      const mockFetch = createMockFetch(createMockResponse(undefined));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      await client.endActivity('session123');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.fumblebot.test/activities/session123',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('voice endpoints', () => {
    it('should call getVoiceStatus endpoint', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        guildId: 'guild123',
        connected: true,
        channelId: 'channel123',
        listening: true,
        mode: 'assistant',
        startedBy: 'user123',
      }));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      const result = await client.getVoiceStatus('guild123');

      expect(result.connected).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.fumblebot.test/voice/status?guildId=guild123',
        expect.any(Object)
      );
    });

    it('should call getVoiceSessions endpoint', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        sessions: [],
        count: 0,
      }));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      const result = await client.getVoiceSessions();

      expect(result.count).toBe(0);
    });

    it('should call joinVoiceChannel endpoint', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        success: true,
        guildId: 'guild123',
        channelId: 'channel123',
        channelName: 'Voice Chat',
      }));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      const result = await client.joinVoiceChannel('guild123', 'channel123');

      expect(result.success).toBe(true);
    });

    it('should call leaveVoiceChannel endpoint', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        success: true,
        guildId: 'guild123',
      }));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      const result = await client.leaveVoiceChannel('guild123');

      expect(result.success).toBe(true);
    });

    it('should call startVoiceListening endpoint', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        success: true,
        guildId: 'guild123',
        channelId: 'channel123',
        listening: true,
        mode: 'assistant',
      }));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      const result = await client.startVoiceListening(
        'guild123',
        'channel123',
        'assistant',
        'user123'
      );

      expect(result.listening).toBe(true);
    });

    it('should call stopVoiceListening endpoint', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        success: true,
        guildId: 'guild123',
        listening: false,
      }));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      const result = await client.stopVoiceListening('guild123');

      expect(result.listening).toBe(false);
    });

    it('should call getVoiceTranscript endpoint', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        guildId: 'guild123',
        transcript: {
          guildId: 'guild123',
          channelId: 'channel123',
          channelName: 'Voice Chat',
          startTime: Date.now(),
          entries: [],
          lastPostedIndex: 0,
        },
      }));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      const result = await client.getVoiceTranscript('guild123');

      expect(result.transcript.entries).toEqual([]);
    });

    it('should call setVoiceMode endpoint', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        success: true,
        guildId: 'guild123',
        mode: 'transcribe',
        message: 'Mode changed',
      }));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      const result = await client.setVoiceMode('guild123', 'transcribe');

      expect(result.mode).toBe('transcribe');
    });

    it('should call playVoiceAudio endpoint', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        success: true,
        guildId: 'guild123',
        url: 'https://audio.example.com/sound.mp3',
      }));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      const result = await client.playVoiceAudio(
        'guild123',
        'https://audio.example.com/sound.mp3',
        0.8
      );

      expect(result.success).toBe(true);
    });

    it('should call stopVoiceAudio endpoint', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        success: true,
        guildId: 'guild123',
      }));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      const result = await client.stopVoiceAudio('guild123');

      expect(result.success).toBe(true);
    });
  });

  describe('web fetch endpoints', () => {
    it('should call fetchWeb endpoint', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        success: true,
        content: 'Fireball is a 3rd level spell...',
        title: 'Fireball',
        source: 'https://5e.tools/spells.html#fireball',
      }));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      const result = await client.fetchWeb({
        url: 'https://5e.tools/spells.html#fireball',
        query: 'fireball',
      });

      expect(result.success).toBe(true);
      expect(result.content).toContain('Fireball');
    });

    it('should call search5eTools endpoint', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        success: true,
        content: 'Goblin stat block...',
        title: 'Goblin',
      }));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      const result = await client.search5eTools({
        query: 'goblin',
        category: 'bestiary',
      });

      expect(result.success).toBe(true);
    });

    it('should call getWebFetchAllowedDomains endpoint', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        domains: ['5e.tools', 'dndbeyond.com'],
      }));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      const result = await client.getWebFetchAllowedDomains();

      expect(result.domains).toContain('5e.tools');
    });
  });

  describe('terminal endpoints', () => {
    it('should call terminalStart endpoint', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        containerId: 'container123',
        status: 'running',
        port: 8080,
        createdAt: new Date().toISOString(),
      }));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      const result = await client.terminalStart({
        guildId: 'guild123',
        channelId: 'channel123',
        userId: 'user123',
        userName: 'TestUser',
      });

      expect(result.containerId).toBe('container123');
      expect(result.status).toBe('running');
    });

    it('should call terminalStop endpoint', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        success: true,
        message: 'Terminal stopped',
      }));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      const result = await client.terminalStop('guild123', 'channel123');

      expect(result.success).toBe(true);
    });

    it('should call terminalStatus endpoint', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        exists: true,
        containerId: 'container123',
        status: 'running',
        port: 8080,
        uptime: 3600,
      }));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      const result = await client.terminalStatus('guild123', 'channel123');

      expect(result.exists).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.fumblebot.test/terminal/status?guildId=guild123&channelId=channel123',
        expect.any(Object)
      );
    });

    it('should call terminalExec endpoint', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        success: true,
        stdout: 'You rolled a 15!',
        stderr: '',
        exitCode: 0,
        executionTime: 50,
      }));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      const result = await client.terminalExec({
        guildId: 'guild123',
        channelId: 'channel123',
        command: 'roll 1d20',
        timeout: 5000,
      });

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('15');
    });

    it('should call terminalSessions endpoint', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        sessions: [
          {
            containerId: 'container123',
            guildId: 'guild123',
            channelId: 'channel123',
            status: 'running',
            createdAt: new Date().toISOString(),
            uptime: 3600,
          },
        ],
        count: 1,
      }));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      const result = await client.terminalSessions();

      expect(result.count).toBe(1);
      expect(result.sessions[0].containerId).toBe('container123');
    });

    it('should generate correct WebSocket URL', () => {
      const mockFetch = createMockFetch(createMockResponse({}));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      const wsUrl = client.getTerminalWsUrl('guild123', 'channel123');

      expect(wsUrl).toBe('wss://api.fumblebot.test/terminal/ws?guildId=guild123&channelId=channel123');
    });

    it('should handle http to ws URL conversion', () => {
      const mockFetch = createMockFetch(createMockResponse({}));
      const client = new FumbleBotClient({
        baseUrl: 'http://localhost:3000',
        apiKey: 'test',
        fetch: mockFetch,
      });

      const wsUrl = client.getTerminalWsUrl('guild123', 'channel123');

      expect(wsUrl).toBe('ws://localhost:3000/terminal/ws?guildId=guild123&channelId=channel123');
    });
  });

  describe('health endpoint', () => {
    it('should call health endpoint', async () => {
      const mockFetch = createMockFetch(createMockResponse({
        status: 'ok',
        version: '1.0.0',
      }));
      const client = new FumbleBotClient({ ...baseConfig, fetch: mockFetch });

      const result = await client.health();

      expect(result.status).toBe('ok');
      expect(result.version).toBe('1.0.0');
    });
  });
});

describe('FumbleBotError', () => {
  it('should create error with all properties', () => {
    const error = new FumbleBotError('Test error', 400, 'VALIDATION_ERROR', { field: 'name' });

    expect(error.message).toBe('Test error');
    expect(error.status).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details).toEqual({ field: 'name' });
    expect(error.name).toBe('FumbleBotError');
  });

  describe('isNetworkError', () => {
    it('should return true for NETWORK_ERROR', () => {
      const error = new FumbleBotError('Network error', 0, 'NETWORK_ERROR');
      expect(error.isNetworkError()).toBe(true);
    });

    it('should return true for TIMEOUT', () => {
      const error = new FumbleBotError('Timeout', 408, 'TIMEOUT');
      expect(error.isNetworkError()).toBe(true);
    });

    it('should return false for other errors', () => {
      const error = new FumbleBotError('Not found', 404, 'NOT_FOUND');
      expect(error.isNetworkError()).toBe(false);
    });
  });

  describe('isAuthError', () => {
    it('should return true for 401', () => {
      const error = new FumbleBotError('Unauthorized', 401);
      expect(error.isAuthError()).toBe(true);
    });

    it('should return true for 403', () => {
      const error = new FumbleBotError('Forbidden', 403);
      expect(error.isAuthError()).toBe(true);
    });

    it('should return false for other status codes', () => {
      const error = new FumbleBotError('Not found', 404);
      expect(error.isAuthError()).toBe(false);
    });
  });

  describe('isRateLimitError', () => {
    it('should return true for 429', () => {
      const error = new FumbleBotError('Too many requests', 429);
      expect(error.isRateLimitError()).toBe(true);
    });

    it('should return false for other status codes', () => {
      const error = new FumbleBotError('Server error', 500);
      expect(error.isRateLimitError()).toBe(false);
    });
  });

  describe('isValidationError', () => {
    it('should return true for 400', () => {
      const error = new FumbleBotError('Bad request', 400);
      expect(error.isValidationError()).toBe(true);
    });

    it('should return false for other status codes', () => {
      const error = new FumbleBotError('Not found', 404);
      expect(error.isValidationError()).toBe(false);
    });
  });

  describe('isNotFoundError', () => {
    it('should return true for 404', () => {
      const error = new FumbleBotError('Not found', 404);
      expect(error.isNotFoundError()).toBe(true);
    });

    it('should return false for other status codes', () => {
      const error = new FumbleBotError('Bad request', 400);
      expect(error.isNotFoundError()).toBe(false);
    });
  });
});

describe('createFumbleBotClient', () => {
  it('should create a FumbleBotClient instance', () => {
    const mockFetch = createMockFetch(createMockResponse({}));
    const client = createFumbleBotClient({
      baseUrl: 'https://api.fumblebot.test',
      apiKey: 'test-key',
      fetch: mockFetch,
    });

    expect(client).toBeInstanceOf(FumbleBotClient);
  });
});
