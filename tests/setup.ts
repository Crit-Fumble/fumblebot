/**
 * Vitest Test Setup
 * Global test configuration and mocks
 */

import { vi, afterEach } from 'vitest';
import nodeFetch, { Response as NodeFetchResponse, Request as NodeFetchRequest, Headers as NodeFetchHeaders } from 'node-fetch';

// ===========================================
// Polyfill Fetch for Windows Node.js
// ===========================================
// Node.js 22's native fetch has issues on Windows with "bad port" errors
// Use node-fetch as a workaround for integration tests
// Only polyfill if native fetch is broken
if (!globalThis.fetch || process.platform === 'win32') {
  globalThis.fetch = nodeFetch as unknown as typeof fetch;
  globalThis.Response = NodeFetchResponse as unknown as typeof Response;
  globalThis.Request = NodeFetchRequest as unknown as typeof Request;
  globalThis.Headers = NodeFetchHeaders as unknown as typeof Headers;
}

// ===========================================
// Environment Variables
// ===========================================

// Mock environment variables for testing
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.DISCORD_TOKEN = 'test-discord-token';
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.FOUNDRY_URL = 'http://localhost:30000';
process.env.FUMBLEBOT_DISCORD_CLIENT_ID = '1443525084256931880';
process.env.SESSION_SECRET = 'test-session-secret-for-testing-only';
process.env.FUMBLEBOT_ADMIN_IDS = '123456789';

// Integration test URLs - use port 6000 for local dev server
process.env.FUMBLEBOT_PLATFORM_URL = process.env.FUMBLEBOT_PLATFORM_URL || 'http://localhost:6000';
process.env.FUMBLEBOT_ADMIN_PORTAL_URL = process.env.FUMBLEBOT_ADMIN_PORTAL_URL || 'http://localhost:6000';

// Core API mock settings
process.env.CORE_SERVER_URL = process.env.CORE_SERVER_URL || 'http://localhost:4000';
process.env.CORE_SECRET = 'test-core-secret';

// ===========================================
// Prisma Client Mock
// ===========================================

// Mock Prisma client to avoid database connections in unit tests
vi.mock('@prisma/client', () => {
  const mockPrisma = {
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    guild: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'test-guild-id' }),
      update: vi.fn().mockResolvedValue({ id: 'test-guild-id' }),
      upsert: vi.fn().mockResolvedValue({ id: 'test-guild-id' }),
      delete: vi.fn().mockResolvedValue({ id: 'test-guild-id' }),
    },
    guildMember: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'test-member-id' }),
      update: vi.fn().mockResolvedValue({ id: 'test-member-id' }),
      upsert: vi.fn().mockResolvedValue({ id: 'test-member-id' }),
      delete: vi.fn().mockResolvedValue({ id: 'test-member-id' }),
    },
    session: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'test-session-id', code: 'ABC123' }),
      update: vi.fn().mockResolvedValue({ id: 'test-session-id' }),
      delete: vi.fn().mockResolvedValue({ id: 'test-session-id' }),
    },
    diceRoll: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'test-roll-id' }),
      aggregate: vi.fn().mockResolvedValue({ _count: 0 }),
    },
    botCommand: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'test-command-id' }),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    cachedRule: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'test-rule-id' }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    expressSession: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ sid: 'test-sid' }),
      update: vi.fn().mockResolvedValue({ sid: 'test-sid' }),
      delete: vi.fn().mockResolvedValue({ sid: 'test-sid' }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };

  return {
    PrismaClient: vi.fn(() => mockPrisma),
  };
});

// ===========================================
// Fetch Mock for External APIs (Unit Tests Only)
// ===========================================

// NOTE: Integration tests use real fetch to test against the running server.
// These mocks are only for unit tests that need to mock external API calls.

/**
 * Mock Discord API response generator for unit tests
 */
export function createMockDiscordResponse(endpoint: string): Response {
  // Token exchange
  if (endpoint.includes('/oauth2/token')) {
    return new Response(JSON.stringify({
      access_token: 'mock-access-token',
      token_type: 'Bearer',
      expires_in: 604800,
      refresh_token: 'mock-refresh-token',
      scope: 'identify guilds',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // Get current user
  if (endpoint.includes('/users/@me') && !endpoint.includes('/guilds')) {
    return new Response(JSON.stringify({
      id: '123456789',
      username: 'TestUser',
      discriminator: '0',
      avatar: 'test-avatar-hash',
      global_name: 'Test User',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // Get user guilds
  if (endpoint.includes('/users/@me/guilds')) {
    return new Response(JSON.stringify([
      { id: 'guild-1', name: 'Test Guild 1', icon: null, owner: true },
      { id: 'guild-2', name: 'Test Guild 2', icon: null, owner: false },
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // Default
  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
}

/**
 * Mock Core API response generator for unit tests
 */
export function createMockCoreApiResponse(endpoint: string): Response {
  // Auth activities endpoint
  if (endpoint.includes('/api/auth/activities')) {
    return new Response(JSON.stringify({
      activities: [
        {
          id: 'campaign-1',
          name: 'Test Campaign',
          guildId: 'guild-1',
          activeSessionId: 'session-1',
          playerCount: 4,
        },
      ],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // Auth guilds endpoint
  if (endpoint.includes('/api/auth/guilds')) {
    return new Response(JSON.stringify({
      guilds: [
        { discordGuildId: 'guild-1', name: 'Test Guild', installedAt: new Date().toISOString() },
      ],
      availableGuilds: [
        { id: 'guild-2', name: 'Available Guild', canInstall: true },
      ],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // Default
  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
}

// ===========================================
// AI Service Mocks
// ===========================================

vi.mock('../src/services/ai/service.js', () => ({
  AIService: {
    getInstance: vi.fn(() => ({
      chat: vi.fn().mockResolvedValue({ content: 'Mock AI response' }),
      generate: vi.fn().mockResolvedValue({ content: 'Mock generated content' }),
      lookup: vi.fn().mockResolvedValue({ content: '[]' }),
      lookupRule: vi.fn().mockResolvedValue('Mock rule explanation'),
    })),
  },
}));

// ===========================================
// Test Lifecycle Hooks
// ===========================================

// Note: Test lifecycle hooks (beforeAll, afterEach, etc.) should be defined
// in individual test files, not in setupFiles.
// Each test file that uses mocks should call vi.clearAllMocks() in afterEach().

// ===========================================
// Test Utilities
// ===========================================

/**
 * Helper to create a mock Express request
 */
export function createMockRequest(overrides: Record<string, any> = {}) {
  return {
    session: {
      user: null,
      accessToken: null,
      expiresAt: null,
    },
    headers: {},
    body: {},
    params: {},
    query: {},
    ...overrides,
  };
}

/**
 * Helper to create a mock Express response
 */
export function createMockResponse() {
  const res: Record<string, any> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  res.header = vi.fn().mockReturnValue(res);
  res.sendStatus = vi.fn().mockReturnValue(res);
  return res;
}

/**
 * Helper to wait for async operations
 */
export function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Suppress console errors in tests (optional - uncomment if needed)
// global.console = {
//   ...console,
//   error: vi.fn(),
//   warn: vi.fn(),
// };
