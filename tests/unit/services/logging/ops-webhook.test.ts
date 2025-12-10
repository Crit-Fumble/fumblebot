/**
 * Ops Webhook Tests
 * Tests for Discord ops notifications
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AggregatedError } from '../../../../src/services/logging/error-aggregator.js';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mocks
import { sendOpsNotification, sendTestNotification } from '../../../../src/services/logging/ops-webhook.js';

describe('OpsWebhook', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    mockFetch.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('sendOpsNotification', () => {
    it('should skip if webhook URL is not configured', async () => {
      delete process.env.OPS_WEBHOOK_URL;

      await sendOpsNotification([createMockError()]);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should send notification when webhook URL is configured', async () => {
      process.env.OPS_WEBHOOK_URL = 'https://discord.com/webhook/test';

      await sendOpsNotification([createMockError()]);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://discord.com/webhook/test',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should include error details in embed', async () => {
      process.env.OPS_WEBHOOK_URL = 'https://discord.com/webhook/test';

      const error = createMockError({
        message: 'Database connection failed',
        service: 'DatabaseService',
        count: 5,
      });

      await sendOpsNotification([error]);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.embeds).toHaveLength(1);
      expect(body.embeds[0].title).toContain('Database connection failed');
      expect(body.embeds[0].fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Service', value: 'DatabaseService' }),
          expect.objectContaining({ name: 'Occurrences', value: '5' }),
        ])
      );
    });

    it('should include stack trace if available', async () => {
      process.env.OPS_WEBHOOK_URL = 'https://discord.com/webhook/test';

      const error = createMockError({
        samples: [
          {
            timestamp: new Date(),
            context: {},
            stack: 'Error: Test\n    at Function.test (file.ts:10)',
          },
        ],
      });

      await sendOpsNotification([error]);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      const stackField = body.embeds[0].fields.find(
        (f: { name: string }) => f.name === 'Stack trace'
      );
      expect(stackField).toBeDefined();
      expect(stackField.value).toContain('Function.test');
    });

    it('should limit to 10 embeds per notification', async () => {
      process.env.OPS_WEBHOOK_URL = 'https://discord.com/webhook/test';

      const errors = Array.from({ length: 15 }, (_, i) =>
        createMockError({ message: `Error ${i}` })
      );

      await sendOpsNotification(errors);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.embeds).toHaveLength(10);
    });

    it('should use purple color for critical errors (10+ occurrences)', async () => {
      process.env.OPS_WEBHOOK_URL = 'https://discord.com/webhook/test';

      const error = createMockError({ count: 10 });

      await sendOpsNotification([error]);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.embeds[0].color).toBe(0x9B59B6); // Purple
    });

    it('should use red color for regular errors', async () => {
      process.env.OPS_WEBHOOK_URL = 'https://discord.com/webhook/test';

      const error = createMockError({ count: 3 });

      await sendOpsNotification([error]);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.embeds[0].color).toBe(0xED4245); // Red
    });

    it('should handle fetch errors gracefully', async () => {
      process.env.OPS_WEBHOOK_URL = 'https://discord.com/webhook/test';
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(sendOpsNotification([createMockError()])).resolves.not.toThrow();
    });

    it('should handle non-ok responses gracefully', async () => {
      process.env.OPS_WEBHOOK_URL = 'https://discord.com/webhook/test';
      mockFetch.mockResolvedValue({ ok: false, status: 429, statusText: 'Too Many Requests' });

      await expect(sendOpsNotification([createMockError()])).resolves.not.toThrow();
    });

    it('should include environment in footer', async () => {
      process.env.OPS_WEBHOOK_URL = 'https://discord.com/webhook/test';
      process.env.NODE_ENV = 'production';

      await sendOpsNotification([createMockError()]);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.embeds[0].footer.text).toContain('production');
    });
  });

  describe('sendTestNotification', () => {
    it('should return false if webhook URL is not configured', async () => {
      delete process.env.OPS_WEBHOOK_URL;

      const result = await sendTestNotification();

      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should send test embed when configured', async () => {
      process.env.OPS_WEBHOOK_URL = 'https://discord.com/webhook/test';

      const result = await sendTestNotification();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.embeds[0].title).toContain('Test');
      expect(body.embeds[0].color).toBe(0x57F287); // Green
    });

    it('should return false on network error', async () => {
      process.env.OPS_WEBHOOK_URL = 'https://discord.com/webhook/test';
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await sendTestNotification();

      expect(result).toBe(false);
    });

    it('should return false on non-ok response', async () => {
      process.env.OPS_WEBHOOK_URL = 'https://discord.com/webhook/test';
      mockFetch.mockResolvedValue({ ok: false });

      const result = await sendTestNotification();

      expect(result).toBe(false);
    });
  });
});

function createMockError(overrides: Partial<AggregatedError> = {}): AggregatedError {
  const now = new Date();
  return {
    fingerprint: 'test-fingerprint',
    message: 'Test error',
    service: 'TestService',
    count: 3,
    firstSeen: new Date(now.getTime() - 60000),
    lastSeen: now,
    samples: [
      {
        timestamp: now,
        context: { service: 'TestService' },
      },
    ],
    ...overrides,
  };
}
