import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Discord SDK
vi.mock('@discord/embedded-app-sdk', () => ({
  DiscordSDK: vi.fn().mockImplementation(() => ({
    ready: vi.fn().mockResolvedValue(undefined),
    commands: {
      authorize: vi.fn().mockResolvedValue({ code: 'mock-code' }),
      authenticate: vi.fn().mockResolvedValue({
        user: {
          id: '123456789',
          username: 'TestUser',
          discriminator: '0000',
          avatar: null,
          global_name: 'Test User',
        },
      }),
      getChannelPermissions: vi.fn().mockResolvedValue({ permissions: '8' }),
    },
    guildId: 'mock-guild-id',
    channelId: 'mock-channel-id',
    instanceId: 'mock-instance-id',
  })),
}));

// Mock fetch for API calls
global.fetch = vi.fn().mockImplementation((url: string) => {
  if (url.includes('/api/token')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ access_token: 'mock-token' }),
    });
  }
  if (url.includes('/api/systems')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ systems: [] }),
    });
  }
  if (url.includes('/api/campaigns')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ campaigns: [] }),
    });
  }
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  });
});
