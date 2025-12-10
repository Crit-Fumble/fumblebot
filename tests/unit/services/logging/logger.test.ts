/**
 * Logger Service Tests
 * Tests for structured logging using Pino
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create hoisted mocks - must include everything used in vi.mock
const {
  mockPinoInfo,
  mockPinoWarn,
  mockPinoError,
  mockPinoDebug,
  mockPinoChild,
  mockPinoConstructor,
} = vi.hoisted(() => {
  const mockPinoInfo = vi.fn();
  const mockPinoWarn = vi.fn();
  const mockPinoError = vi.fn();
  const mockPinoDebug = vi.fn();
  const mockPinoChild = vi.fn();

  const mockChildLogger = {
    info: mockPinoInfo,
    warn: mockPinoWarn,
    error: mockPinoError,
    debug: mockPinoDebug,
    child: mockPinoChild,
  };

  mockPinoChild.mockReturnValue(mockChildLogger);

  const mockPinoConstructor = vi.fn(() => ({
    info: mockPinoInfo,
    warn: mockPinoWarn,
    error: mockPinoError,
    debug: mockPinoDebug,
    child: mockPinoChild,
  }));

  return {
    mockPinoInfo,
    mockPinoWarn,
    mockPinoError,
    mockPinoDebug,
    mockPinoChild,
    mockPinoConstructor,
  };
});

// Mock pino module
vi.mock('pino', () => {
  const pinoMock = mockPinoConstructor;
  pinoMock.stdTimeFunctions = {
    isoTime: () => ',"time":"2024-01-01T00:00:00.000Z"',
  };
  return {
    default: pinoMock,
  };
});

// Import after mocks
import { logger } from '../../../../src/services/logging/logger.js';

describe('Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('basic logging methods', () => {
    it('should log info messages', () => {
      logger.info('Test info message');

      expect(mockPinoInfo).toHaveBeenCalledWith({}, 'Test info message');
    });

    it('should log info messages with context', () => {
      logger.info('Test message', { service: 'TestService', userId: 'user-123' });

      expect(mockPinoInfo).toHaveBeenCalledWith(
        { service: 'TestService', userId: 'user-123' },
        'Test message'
      );
    });

    it('should log warn messages', () => {
      logger.warn('Test warning', { guildId: 'guild-1' });

      expect(mockPinoWarn).toHaveBeenCalledWith(
        { guildId: 'guild-1' },
        'Test warning'
      );
    });

    it('should log debug messages', () => {
      logger.debug('Debug info', { requestId: 'req-123' });

      expect(mockPinoDebug).toHaveBeenCalledWith(
        { requestId: 'req-123' },
        'Debug info'
      );
    });
  });

  describe('error logging', () => {
    it('should log error messages without Error object', () => {
      logger.error('Error occurred', { service: 'TestService' });

      expect(mockPinoError).toHaveBeenCalledWith(
        { service: 'TestService' },
        'Error occurred'
      );
    });

    it('should log error messages with Error object', () => {
      const error = new Error('Test error message');
      error.stack = 'Error: Test error message\n    at TestFunction';

      logger.error('Operation failed', { service: 'TestService' }, error);

      expect(mockPinoError).toHaveBeenCalledWith(
        {
          service: 'TestService',
          err: {
            message: 'Test error message',
            name: 'Error',
            stack: error.stack,
          },
        },
        'Operation failed'
      );
    });

    it('should handle undefined context in error logging', () => {
      const error = new Error('Test error');
      logger.error('Error message', undefined, error);

      expect(mockPinoError).toHaveBeenCalledWith(
        {
          err: {
            message: 'Test error',
            name: 'Error',
            stack: error.stack,
          },
        },
        'Error message'
      );
    });
  });

  describe('child loggers', () => {
    it('should create child loggers with inherited context', () => {
      const childLogger = logger.child({ service: 'ChildService' });

      expect(mockPinoChild).toHaveBeenCalledWith({ service: 'ChildService' });
      expect(childLogger).toBeDefined();
    });

    it('should use child logger methods', () => {
      const childLogger = logger.child({ service: 'ChildService' });
      childLogger.info('Child message');

      expect(mockPinoInfo).toHaveBeenCalled();
    });
  });

  describe('error handlers', () => {
    it('should call registered error handlers on error', () => {
      const errorHandler = vi.fn();
      logger.onError(errorHandler);

      logger.error('Test error', { service: 'TestService' });

      expect(errorHandler).toHaveBeenCalledWith(
        'Test error',
        { service: 'TestService' },
        undefined
      );
    });

    it('should call error handlers with Error object', () => {
      const errorHandler = vi.fn();
      logger.onError(errorHandler);

      const error = new Error('Test error');
      logger.error('Operation failed', { service: 'TestService' }, error);

      expect(errorHandler).toHaveBeenCalledWith(
        'Operation failed',
        { service: 'TestService' },
        error
      );
    });

    it('should not crash if error handler throws', () => {
      const throwingHandler = vi.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });
      logger.onError(throwingHandler);

      expect(() => {
        logger.error('Test error');
      }).not.toThrow();

      expect(throwingHandler).toHaveBeenCalled();
    });
  });
});
