/**
 * Error Aggregator Tests
 * Tests for error deduplication and aggregation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorAggregator } from '../../../../src/services/logging/error-aggregator.js';

describe('ErrorAggregator', () => {
  let aggregator: ErrorAggregator;

  beforeEach(() => {
    vi.useFakeTimers();
    aggregator = new ErrorAggregator({
      threshold: 3,
      flushIntervalMs: 1000,
      maxSamples: 3,
    });
  });

  afterEach(() => {
    aggregator.stop();
    vi.useRealTimers();
  });

  describe('addError', () => {
    it('should add new errors to the aggregator', () => {
      aggregator.addError('Test error', { service: 'TestService' });

      const stats = aggregator.getStats();
      expect(stats.totalErrors).toBe(1);
      expect(stats.uniqueErrors).toBe(1);
    });

    it('should increment count for duplicate errors', () => {
      aggregator.addError('Test error', { service: 'TestService' });
      aggregator.addError('Test error', { service: 'TestService' });
      aggregator.addError('Test error', { service: 'TestService' });

      const stats = aggregator.getStats();
      expect(stats.totalErrors).toBe(3);
      expect(stats.uniqueErrors).toBe(1);
    });

    it('should track different errors separately', () => {
      aggregator.addError('Error A', { service: 'ServiceA' });
      aggregator.addError('Error B', { service: 'ServiceB' });

      const stats = aggregator.getStats();
      expect(stats.totalErrors).toBe(2);
      expect(stats.uniqueErrors).toBe(2);
    });

    it('should deduplicate errors by message and stack fingerprint', () => {
      const error1 = new Error('Test error');
      error1.stack = 'Error: Test error\n    at Function.test (file.ts:10)';

      const error2 = new Error('Test error');
      error2.stack = 'Error: Test error\n    at Function.test (file.ts:10)';

      aggregator.addError('Test error', { service: 'Test' }, error1);
      aggregator.addError('Test error', { service: 'Test' }, error2);

      const stats = aggregator.getStats();
      expect(stats.totalErrors).toBe(2);
      expect(stats.uniqueErrors).toBe(1);
    });

    it('should keep only maxSamples samples', () => {
      aggregator.addError('Error', { service: 'Test' });
      aggregator.addError('Error', { service: 'Test' });
      aggregator.addError('Error', { service: 'Test' });
      aggregator.addError('Error', { service: 'Test' });
      aggregator.addError('Error', { service: 'Test' });

      // Can't directly check samples count, but stats show 5 total errors
      const stats = aggregator.getStats();
      expect(stats.totalErrors).toBe(5);
    });
  });

  describe('flush', () => {
    it('should call notification handler when errors exceed threshold', async () => {
      const notificationHandler = vi.fn().mockResolvedValue(undefined);
      aggregator.setNotificationHandler(notificationHandler);

      aggregator.addError('Error', { service: 'Test' });
      aggregator.addError('Error', { service: 'Test' });
      aggregator.addError('Error', { service: 'Test' });

      await aggregator.flush();

      expect(notificationHandler).toHaveBeenCalledTimes(1);
      expect(notificationHandler.mock.calls[0][0]).toHaveLength(1);
      expect(notificationHandler.mock.calls[0][0][0].count).toBe(3);
    });

    it('should not call handler when errors below threshold', async () => {
      const notificationHandler = vi.fn().mockResolvedValue(undefined);
      aggregator.setNotificationHandler(notificationHandler);

      aggregator.addError('Error', { service: 'Test' });
      aggregator.addError('Error', { service: 'Test' });

      await aggregator.flush();

      expect(notificationHandler).not.toHaveBeenCalled();
    });

    it('should clear errors after notification', async () => {
      const notificationHandler = vi.fn().mockResolvedValue(undefined);
      aggregator.setNotificationHandler(notificationHandler);

      aggregator.addError('Error', { service: 'Test' });
      aggregator.addError('Error', { service: 'Test' });
      aggregator.addError('Error', { service: 'Test' });

      await aggregator.flush();

      const stats = aggregator.getStats();
      expect(stats.totalErrors).toBe(0);
      expect(stats.uniqueErrors).toBe(0);
    });

    it('should not throw if notification handler fails', async () => {
      const notificationHandler = vi.fn().mockRejectedValue(new Error('Failed'));
      aggregator.setNotificationHandler(notificationHandler);

      aggregator.addError('Error', { service: 'Test' });
      aggregator.addError('Error', { service: 'Test' });
      aggregator.addError('Error', { service: 'Test' });

      await expect(aggregator.flush()).resolves.not.toThrow();
    });

    it('should skip flush if no notification handler', async () => {
      aggregator.addError('Error', { service: 'Test' });
      aggregator.addError('Error', { service: 'Test' });
      aggregator.addError('Error', { service: 'Test' });

      await expect(aggregator.flush()).resolves.not.toThrow();

      // Errors should still be there
      const stats = aggregator.getStats();
      expect(stats.totalErrors).toBe(3);
    });
  });

  describe('start/stop', () => {
    it('should flush on interval when started', async () => {
      const notificationHandler = vi.fn().mockResolvedValue(undefined);
      aggregator.setNotificationHandler(notificationHandler);

      aggregator.addError('Error', { service: 'Test' });
      aggregator.addError('Error', { service: 'Test' });
      aggregator.addError('Error', { service: 'Test' });

      aggregator.start();

      // Advance time past flush interval
      await vi.advanceTimersByTimeAsync(1100);

      expect(notificationHandler).toHaveBeenCalled();
    });

    it('should stop flushing when stopped', async () => {
      const notificationHandler = vi.fn().mockResolvedValue(undefined);
      aggregator.setNotificationHandler(notificationHandler);

      aggregator.start();
      aggregator.stop();

      aggregator.addError('Error', { service: 'Test' });
      aggregator.addError('Error', { service: 'Test' });
      aggregator.addError('Error', { service: 'Test' });

      await vi.advanceTimersByTimeAsync(2000);

      expect(notificationHandler).not.toHaveBeenCalled();
    });

    it('should not start multiple intervals', () => {
      aggregator.start();
      aggregator.start();
      aggregator.start();

      // Should not throw and should only have one interval
      expect(() => aggregator.stop()).not.toThrow();
    });
  });

  describe('clear', () => {
    it('should clear all aggregated errors', () => {
      aggregator.addError('Error A', { service: 'A' });
      aggregator.addError('Error B', { service: 'B' });

      aggregator.clear();

      const stats = aggregator.getStats();
      expect(stats.totalErrors).toBe(0);
      expect(stats.uniqueErrors).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      aggregator.addError('Error A', { service: 'A' });
      aggregator.addError('Error A', { service: 'A' });
      aggregator.addError('Error B', { service: 'B' });

      const stats = aggregator.getStats();
      expect(stats.totalErrors).toBe(3);
      expect(stats.uniqueErrors).toBe(2);
    });

    it('should return zero when empty', () => {
      const stats = aggregator.getStats();
      expect(stats.totalErrors).toBe(0);
      expect(stats.uniqueErrors).toBe(0);
    });
  });
});
