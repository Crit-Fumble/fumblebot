/**
 * Logger Service
 * Structured JSON logging using Pino with Discord ops integration
 */

import pino from 'pino';

// =============================================================================
// Types
// =============================================================================

export interface LogContext {
  service?: string;
  guildId?: string;
  userId?: string;
  requestId?: string;
  [key: string]: unknown;
}

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface Logger {
  error(message: string, context?: LogContext, error?: Error): void;
  warn(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
  child(context: LogContext): Logger;
}

// =============================================================================
// Configuration
// =============================================================================

function getLogLevel(): string {
  return process.env.LOG_LEVEL || 'info';
}

function getLogFormat(): 'json' | 'pretty' {
  const format = process.env.LOG_FORMAT || (process.env.NODE_ENV === 'production' ? 'json' : 'pretty');
  return format === 'pretty' ? 'pretty' : 'json';
}

// =============================================================================
// Pino Configuration
// =============================================================================

function createPinoLogger(): pino.Logger {
  const format = getLogFormat();
  const level = getLogLevel();

  const options: pino.LoggerOptions = {
    level,
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
  };

  // Use pretty printing in development
  if (format === 'pretty') {
    return pino({
      ...options,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    });
  }

  return pino(options);
}

// =============================================================================
// Logger Wrapper
// =============================================================================

class LoggerWrapper implements Logger {
  private pino: pino.Logger;
  private errorHandlers: ((message: string, context: LogContext, error?: Error) => void)[] = [];

  constructor(pinoInstance: pino.Logger) {
    this.pino = pinoInstance;
  }

  /**
   * Register an error handler (used by error aggregator)
   */
  onError(handler: (message: string, context: LogContext, error?: Error) => void): void {
    this.errorHandlers.push(handler);
  }

  error(message: string, context?: LogContext, error?: Error): void {
    const ctx = context || {};

    if (error) {
      this.pino.error({
        ...ctx,
        err: {
          message: error.message,
          name: error.name,
          stack: error.stack,
        },
      }, message);
    } else {
      this.pino.error(ctx, message);
    }

    // Notify error handlers
    for (const handler of this.errorHandlers) {
      try {
        handler(message, ctx, error);
      } catch {
        // Don't let error handler failures break logging
      }
    }
  }

  warn(message: string, context?: LogContext): void {
    this.pino.warn(context || {}, message);
  }

  info(message: string, context?: LogContext): void {
    this.pino.info(context || {}, message);
  }

  debug(message: string, context?: LogContext): void {
    this.pino.debug(context || {}, message);
  }

  child(context: LogContext): Logger {
    const childPino = this.pino.child(context);
    const childWrapper = new LoggerWrapper(childPino);
    // Share error handlers with child
    childWrapper.errorHandlers = this.errorHandlers;
    return childWrapper;
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

const pinoInstance = createPinoLogger();
export const logger = new LoggerWrapper(pinoInstance);

// Export type for use in other modules
export type { LoggerWrapper };
