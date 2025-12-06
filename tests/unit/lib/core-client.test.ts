/**
 * Core Client Unit Tests
 * Tests for Core API client singleton
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getCoreClient, resetCoreClient } from '../../../src/lib/core-client.js';

describe('Core Client', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
    resetCoreClient();
  });

  afterEach(() => {
    // Restore environment after each test
    process.env = originalEnv;
    resetCoreClient();
  });

  describe('getCoreClient', () => {
    it('should create client with environment variables', () => {
      process.env.CORE_API_URL = 'https://test.crit-fumble.com';
      process.env.CORE_API_KEY = 'test-api-key';

      const client = getCoreClient();

      expect(client).toBeDefined();
      expect(client.dice).toBeDefined();
      expect(client.games).toBeDefined();
      expect(client.accounts).toBeDefined();
    });

    it('should use default URL when CORE_API_URL not set', () => {
      process.env.CORE_API_KEY = 'test-key';
      delete process.env.CORE_API_URL;

      const client = getCoreClient();

      expect(client).toBeDefined();
    });

    it('should warn when API key is missing but still create client', () => {
      delete process.env.CORE_API_KEY;
      delete process.env.CORE_SECRET;
      process.env.CORE_SERVER_URL = 'https://test.crit-fumble.com';

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const client = getCoreClient();

      expect(client).toBeDefined();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('CORE_SECRET not set')
      );

      warnSpy.mockRestore();
    });

    it('should return same instance on multiple calls (singleton)', () => {
      process.env.CORE_API_URL = 'https://test.crit-fumble.com';
      process.env.CORE_API_KEY = 'test-key';

      const client1 = getCoreClient();
      const client2 = getCoreClient();

      expect(client1).toBe(client2);
    });

    it('should create new instance after reset', () => {
      process.env.CORE_API_URL = 'https://test.crit-fumble.com';
      process.env.CORE_API_KEY = 'test-key';

      const client1 = getCoreClient();
      resetCoreClient();
      const client2 = getCoreClient();

      expect(client1).not.toBe(client2);
    });
  });

  describe('Client APIs', () => {
    beforeEach(() => {
      process.env.CORE_API_URL = 'https://test.crit-fumble.com';
      process.env.CORE_API_KEY = 'test-key';
    });

    it('should have dice API', () => {
      const client = getCoreClient();

      expect(client.dice).toBeDefined();
      expect(client.dice.log).toBeTypeOf('function');
      expect(client.dice.stats).toBeTypeOf('function');
      expect(client.dice.recent).toBeTypeOf('function');
    });

    it('should have games API', () => {
      const client = getCoreClient();

      expect(client.games).toBeDefined();
      expect(client.games.listSystems).toBeTypeOf('function');
      expect(client.games.getSystem).toBeTypeOf('function');
      expect(client.games.listIntegrations).toBeTypeOf('function');
    });

    it('should have accounts API', () => {
      const client = getCoreClient();

      expect(client.accounts).toBeDefined();
      expect(client.accounts.list).toBeTypeOf('function');
      expect(client.accounts.link).toBeTypeOf('function');
      expect(client.accounts.unlink).toBeTypeOf('function');
    });

    it('should have campaigns API', () => {
      const client = getCoreClient();

      expect(client.campaigns).toBeDefined();
      expect(client.campaigns.list).toBeTypeOf('function');
      expect(client.campaigns.get).toBeTypeOf('function');
      expect(client.campaigns.create).toBeTypeOf('function');
    });

    it('should have characters API', () => {
      const client = getCoreClient();

      expect(client.characters).toBeDefined();
      expect(client.characters.list).toBeTypeOf('function');
      expect(client.characters.get).toBeTypeOf('function');
      expect(client.characters.create).toBeTypeOf('function');
    });

    it('should have sessions API', () => {
      const client = getCoreClient();

      expect(client.sessions).toBeDefined();
      expect(client.sessions.get).toBeTypeOf('function');
      expect(client.sessions.start).toBeTypeOf('function');
      expect(client.sessions.end).toBeTypeOf('function');
    });

    it('should have voice API', () => {
      const client = getCoreClient();

      expect(client.voice).toBeDefined();
      expect(client.voice.status).toBeTypeOf('function');
      expect(client.voice.join).toBeTypeOf('function');
      expect(client.voice.leave).toBeTypeOf('function');
    });

    it('should have health check method', () => {
      const client = getCoreClient();

      expect(client.health).toBeTypeOf('function');
    });
  });

  describe('resetCoreClient', () => {
    it('should allow creating new client after reset', () => {
      process.env.CORE_API_URL = 'https://test1.crit-fumble.com';
      process.env.CORE_API_KEY = 'key1';

      getCoreClient();

      resetCoreClient();

      process.env.CORE_API_URL = 'https://test2.crit-fumble.com';
      process.env.CORE_API_KEY = 'key2';

      const newClient = getCoreClient();

      expect(newClient).toBeDefined();
    });

    it('should not throw when called multiple times', () => {
      resetCoreClient();
      resetCoreClient();
      resetCoreClient();

      expect(() => resetCoreClient()).not.toThrow();
    });
  });
});
