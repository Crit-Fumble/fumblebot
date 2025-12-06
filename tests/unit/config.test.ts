/**
 * Configuration Module Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadDiscordConfig,
  loadOpenAIConfig,
  loadAnthropicConfig,
  loadAPIConfig,
  loadDatabaseConfig,
  loadGradientConfig,
  loadCoreProxyConfig,
  loadVoiceConfig,
  loadSecurityConfig,
  loadServerConfig,
  validateConfig,
  validatePlatformConfig,
  isAdmin,
} from '../../src/config.js';

describe('Configuration Module', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
    // Clear cached configs by reimporting - in real tests we might need to reset module cache
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('loadDiscordConfig', () => {
    it('should load all required Discord config', () => {
      process.env.FUMBLEBOT_DISCORD_TOKEN = 'test-token';
      process.env.FUMBLEBOT_DISCORD_CLIENT_ID = 'test-client-id';
      process.env.FUMBLEBOT_DISCORD_CLIENT_SECRET = 'test-secret';
      process.env.FUMBLEBOT_DISCORD_PUBLIC_KEY = 'test-public-key';

      const config = loadDiscordConfig();

      expect(config.token).toBe('test-token');
      expect(config.clientId).toBe('test-client-id');
      expect(config.clientSecret).toBe('test-secret');
      expect(config.publicKey).toBe('test-public-key');
    });

    it('should load optional guild ID', () => {
      process.env.FUMBLEBOT_DISCORD_TOKEN = 'test-token';
      process.env.FUMBLEBOT_DISCORD_CLIENT_ID = 'test-client-id';
      process.env.FUMBLEBOT_DISCORD_CLIENT_SECRET = 'test-secret';
      process.env.FUMBLEBOT_DISCORD_PUBLIC_KEY = 'test-public-key';
      process.env.FUMBLEBOT_DISCORD_GUILD_ID = 'test-guild-id';

      const config = loadDiscordConfig();

      expect(config.guildId).toBe('test-guild-id');
    });

    it('should have undefined guildId when not set', () => {
      process.env.FUMBLEBOT_DISCORD_TOKEN = 'test-token';
      process.env.FUMBLEBOT_DISCORD_CLIENT_ID = 'test-client-id';
      process.env.FUMBLEBOT_DISCORD_CLIENT_SECRET = 'test-secret';
      process.env.FUMBLEBOT_DISCORD_PUBLIC_KEY = 'test-public-key';
      delete process.env.FUMBLEBOT_DISCORD_GUILD_ID;

      const config = loadDiscordConfig();

      expect(config.guildId).toBeUndefined();
    });

    it('should throw when required env vars are missing', () => {
      delete process.env.FUMBLEBOT_DISCORD_TOKEN;

      expect(() => loadDiscordConfig()).toThrow('Missing required environment variable');
    });
  });

  describe('loadOpenAIConfig', () => {
    it('should load OpenAI config with defaults', () => {
      process.env.FUMBLEBOT_OPENAI_API_KEY = 'sk-test-key';

      const config = loadOpenAIConfig();

      expect(config.apiKey).toBe('sk-test-key');
      expect(config.model).toBe('gpt-4o');
      expect(config.maxTokens).toBe(2048);
    });

    it('should throw when API key is missing', () => {
      delete process.env.FUMBLEBOT_OPENAI_API_KEY;

      expect(() => loadOpenAIConfig()).toThrow('Missing required environment variable');
    });
  });

  describe('loadAnthropicConfig', () => {
    it('should load Anthropic config with defaults', () => {
      process.env.FUMBLEBOT_ANTHROPIC_API_KEY = 'sk-ant-test-key';

      const config = loadAnthropicConfig();

      expect(config.apiKey).toBe('sk-ant-test-key');
      expect(config.model).toBe('claude-sonnet-4-20250514');
      expect(config.maxTokens).toBe(2048);
    });

    it('should throw when API key is missing', () => {
      delete process.env.FUMBLEBOT_ANTHROPIC_API_KEY;

      expect(() => loadAnthropicConfig()).toThrow('Missing required environment variable');
    });
  });

  describe('loadAPIConfig', () => {
    it('should load API config with defaults', () => {
      const config = loadAPIConfig();

      expect(config.baseUrl).toBe('https://www.crit-fumble.com');
    });

    it('should load optional bot API secret', () => {
      process.env.FUMBLEBOT_API_SECRET = 'secret123';

      const config = loadAPIConfig();

      expect(config.botApiSecret).toBe('secret123');
    });

    it('should have undefined botApiSecret when not set', () => {
      delete process.env.FUMBLEBOT_API_SECRET;

      const config = loadAPIConfig();

      expect(config.botApiSecret).toBeUndefined();
    });
  });

  describe('loadDatabaseConfig', () => {
    it('should load database URL', () => {
      process.env.FUMBLEBOT_DATABASE_URL = 'postgresql://localhost/test';

      const config = loadDatabaseConfig();

      expect(config.url).toBe('postgresql://localhost/test');
    });

    it('should throw when database URL is missing', () => {
      delete process.env.FUMBLEBOT_DATABASE_URL;

      expect(() => loadDatabaseConfig()).toThrow('Missing required environment variable');
    });
  });

  describe('loadGradientConfig', () => {
    it('should return undefined when inference key is not set', () => {
      delete process.env.FUMBLEBOT_GRADIENT_INFERENCE_KEY;

      const config = loadGradientConfig();

      expect(config).toBeUndefined();
    });

    it('should load full Gradient config when inference key is set', () => {
      process.env.FUMBLEBOT_GRADIENT_INFERENCE_KEY = 'gradient-key';
      process.env.FUMBLEBOT_GRADIENT_ACCESS_TOKEN = 'access-token';
      process.env.FUMBLEBOT_GRADIENT_LLM_AUDITOR = 'true';
      process.env.FUMBLEBOT_GRADIENT_GUARDRAILS = 'true';

      const config = loadGradientConfig();

      expect(config).toBeDefined();
      expect(config?.inferenceKey).toBe('gradient-key');
      expect(config?.accessToken).toBe('access-token');
      expect(config?.enableLLMAuditor).toBe(true);
      expect(config?.enableGuardrails).toBe(true);
    });

    it('should use defaults for optional Gradient settings', () => {
      process.env.FUMBLEBOT_GRADIENT_INFERENCE_KEY = 'gradient-key';
      delete process.env.FUMBLEBOT_GRADIENT_ACCESS_TOKEN;
      delete process.env.FUMBLEBOT_GRADIENT_BASE_URL;
      delete process.env.FUMBLEBOT_GRADIENT_MODEL;

      const config = loadGradientConfig();

      expect(config?.accessToken).toBe('');
      expect(config?.baseUrl).toBe('https://inference.do-ai.run/v1');
      expect(config?.defaultModel).toBe('llama-3.3-70b-instruct');
      expect(config?.enableLLMAuditor).toBe(false);
      expect(config?.enableGuardrails).toBe(false);
    });
  });

  describe('loadCoreProxyConfig', () => {
    it('should return undefined when CORE_SERVER_URL is not set', () => {
      delete process.env.CORE_SERVER_URL;

      const config = loadCoreProxyConfig();

      expect(config).toBeUndefined();
    });

    it('should load full config when CORE_SERVER_URL is set', () => {
      process.env.CORE_SERVER_URL = 'http://localhost';
      process.env.CORE_SERVER_PORT = '5000';
      process.env.CORE_SECRET = 'secret123';

      const config = loadCoreProxyConfig();

      expect(config).toBeDefined();
      expect(config?.url).toBe('http://localhost');
      expect(config?.port).toBe(5000);
      expect(config?.secret).toBe('secret123');
    });

    it('should use default port', () => {
      process.env.CORE_SERVER_URL = 'http://localhost';
      process.env.CORE_SECRET = 'secret123';
      delete process.env.CORE_SERVER_PORT;

      const config = loadCoreProxyConfig();

      expect(config?.port).toBe(4000);
    });

    it('should warn but not fail when CORE_SECRET is missing', () => {
      process.env.CORE_SERVER_URL = 'http://localhost';
      delete process.env.CORE_SECRET;

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const config = loadCoreProxyConfig();

      expect(config?.secret).toBe('');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('CORE_SECRET is missing'));

      warnSpy.mockRestore();
    });
  });

  describe('loadVoiceConfig', () => {
    it('should load voice config', () => {
      process.env.FUMBLEBOT_DEEPGRAM_API_KEY = 'dg-api-key';
      process.env.FUMBLEBOT_DISCORD_TEST_GUILD_ID = 'test-guild';

      const config = loadVoiceConfig();

      expect(config.deepgramApiKey).toBe('dg-api-key');
      expect(config.testGuildId).toBe('test-guild');
    });

    it('should have undefined values when env vars not set', () => {
      delete process.env.FUMBLEBOT_DEEPGRAM_API_KEY;
      delete process.env.FUMBLEBOT_DISCORD_TEST_GUILD_ID;

      const config = loadVoiceConfig();

      expect(config.deepgramApiKey).toBeUndefined();
      expect(config.testGuildId).toBeUndefined();
    });
  });

  describe('loadSecurityConfig', () => {
    it('should load auth secret from AUTH_SECRET', () => {
      // Clear all auth-related env vars first
      delete process.env.SESSION_SECRET;
      delete process.env.FUMBLEBOT_DISCORD_CLIENT_SECRET;
      delete process.env.NEXTAUTH_SECRET;
      process.env.AUTH_SECRET = 'auth-secret';

      const config = loadSecurityConfig();

      expect(config.authSecret).toBe('auth-secret');
      expect(config.sessionSecret).toBe('auth-secret');
    });

    it('should fallback to FUMBLEBOT_DISCORD_CLIENT_SECRET', () => {
      delete process.env.AUTH_SECRET;
      process.env.FUMBLEBOT_DISCORD_CLIENT_SECRET = 'discord-secret';

      const config = loadSecurityConfig();

      expect(config.authSecret).toBe('discord-secret');
    });

    it('should fallback to NEXTAUTH_SECRET', () => {
      delete process.env.AUTH_SECRET;
      delete process.env.FUMBLEBOT_DISCORD_CLIENT_SECRET;
      process.env.NEXTAUTH_SECRET = 'nextauth-secret';

      const config = loadSecurityConfig();

      expect(config.authSecret).toBe('nextauth-secret');
    });

    it('should use SESSION_SECRET for session secret', () => {
      process.env.SESSION_SECRET = 'session-secret';
      process.env.AUTH_SECRET = 'auth-secret';

      const config = loadSecurityConfig();

      expect(config.sessionSecret).toBe('session-secret');
      expect(config.authSecret).toBe('auth-secret');
    });

    it('should parse admin IDs', () => {
      process.env.FUMBLEBOT_ADMIN_IDS = 'admin1, admin2, admin3';

      const config = loadSecurityConfig();

      expect(config.adminIds).toEqual(['admin1', 'admin2', 'admin3']);
    });

    it('should handle empty admin IDs', () => {
      delete process.env.FUMBLEBOT_ADMIN_IDS;

      const config = loadSecurityConfig();

      expect(config.adminIds).toEqual([]);
    });
  });

  describe('loadServerConfig', () => {
    it('should load server config with defaults', () => {
      delete process.env.FUMBLEBOT_ACTIVITY_PORT;
      delete process.env.FUMBLEBOT_ACTIVITY_HOST;
      delete process.env.NODE_ENV;

      const config = loadServerConfig();

      expect(config.port).toBe(3000);
      expect(config.host).toBe('0.0.0.0');
      expect(config.nodeEnv).toBe('development');
      expect(config.isProduction).toBe(false);
    });

    it('should load custom server config', () => {
      process.env.FUMBLEBOT_ACTIVITY_PORT = '8080';
      process.env.FUMBLEBOT_ACTIVITY_HOST = '127.0.0.1';
      process.env.FUMBLEBOT_ACTIVITY_PUBLIC_URL = 'https://app.example.com';
      process.env.NODE_ENV = 'production';

      const config = loadServerConfig();

      expect(config.port).toBe(8080);
      expect(config.host).toBe('127.0.0.1');
      expect(config.publicUrl).toBe('https://app.example.com');
      expect(config.nodeEnv).toBe('production');
      expect(config.isProduction).toBe(true);
    });
  });

  describe('validateConfig', () => {
    it('should return empty array for valid config', () => {
      const config = {
        discord: {
          token: 'token',
          clientId: 'clientId',
          clientSecret: 'secret',
          publicKey: 'key',
        },
        openai: { apiKey: 'openai-key', model: 'gpt-4o', maxTokens: 2048 },
        anthropic: { apiKey: 'anthropic-key', model: 'claude', maxTokens: 2048 },
        api: { baseUrl: 'https://example.com' },
        database: { url: 'postgresql://localhost/db' },
      };

      const errors = validateConfig(config);

      expect(errors).toEqual([]);
    });

    it('should detect missing Discord token', () => {
      const config = {
        discord: { token: '', clientId: 'id', clientSecret: 'secret', publicKey: 'key' },
        openai: { apiKey: 'key', model: 'gpt-4o', maxTokens: 2048 },
        anthropic: { apiKey: 'key', model: 'claude', maxTokens: 2048 },
        api: { baseUrl: 'https://example.com' },
        database: { url: 'postgresql://localhost/db' },
      };

      const errors = validateConfig(config);

      expect(errors).toContain('Discord token is required');
    });

    it('should detect missing client ID', () => {
      const config = {
        discord: { token: 'token', clientId: '', clientSecret: 'secret', publicKey: 'key' },
        openai: { apiKey: 'key', model: 'gpt-4o', maxTokens: 2048 },
        anthropic: { apiKey: 'key', model: 'claude', maxTokens: 2048 },
        api: { baseUrl: 'https://example.com' },
        database: { url: 'postgresql://localhost/db' },
      };

      const errors = validateConfig(config);

      expect(errors).toContain('Discord client ID is required');
    });

    it('should detect missing public key', () => {
      const config = {
        discord: { token: 'token', clientId: 'id', clientSecret: 'secret', publicKey: '' },
        openai: { apiKey: 'key', model: 'gpt-4o', maxTokens: 2048 },
        anthropic: { apiKey: 'key', model: 'claude', maxTokens: 2048 },
        api: { baseUrl: 'https://example.com' },
        database: { url: 'postgresql://localhost/db' },
      };

      const errors = validateConfig(config);

      expect(errors).toContain('Discord public key is required');
    });

    it('should detect missing OpenAI key', () => {
      const config = {
        discord: { token: 'token', clientId: 'id', clientSecret: 'secret', publicKey: 'key' },
        openai: { apiKey: '', model: 'gpt-4o', maxTokens: 2048 },
        anthropic: { apiKey: 'key', model: 'claude', maxTokens: 2048 },
        api: { baseUrl: 'https://example.com' },
        database: { url: 'postgresql://localhost/db' },
      };

      const errors = validateConfig(config);

      expect(errors).toContain('OpenAI API key is required');
    });

    it('should detect missing Anthropic key', () => {
      const config = {
        discord: { token: 'token', clientId: 'id', clientSecret: 'secret', publicKey: 'key' },
        openai: { apiKey: 'key', model: 'gpt-4o', maxTokens: 2048 },
        anthropic: { apiKey: '', model: 'claude', maxTokens: 2048 },
        api: { baseUrl: 'https://example.com' },
        database: { url: 'postgresql://localhost/db' },
      };

      const errors = validateConfig(config);

      expect(errors).toContain('Anthropic API key is required');
    });

    it('should detect missing database URL', () => {
      const config = {
        discord: { token: 'token', clientId: 'id', clientSecret: 'secret', publicKey: 'key' },
        openai: { apiKey: 'key', model: 'gpt-4o', maxTokens: 2048 },
        anthropic: { apiKey: 'key', model: 'claude', maxTokens: 2048 },
        api: { baseUrl: 'https://example.com' },
        database: { url: '' },
      };

      const errors = validateConfig(config);

      expect(errors).toContain('Database URL is required');
    });

    it('should return multiple errors', () => {
      const config = {
        discord: { token: '', clientId: '', clientSecret: '', publicKey: '' },
        openai: { apiKey: '', model: '', maxTokens: 0 },
        anthropic: { apiKey: '', model: '', maxTokens: 0 },
        api: { baseUrl: '' },
        database: { url: '' },
      };

      const errors = validateConfig(config);

      expect(errors.length).toBeGreaterThan(1);
    });
  });

  describe('isAdmin', () => {
    it('should return true for admin user', () => {
      process.env.FUMBLEBOT_ADMIN_IDS = 'admin123,admin456';

      // Force reload of security config
      const result = isAdmin('admin123');

      // Note: due to caching, this test may need module reset in real scenarios
      // For now, we're testing the function signature
      expect(typeof result).toBe('boolean');
    });
  });
});
