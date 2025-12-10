/**
 * Error Aggregator Service
 * Deduplicates and aggregates errors before sending notifications
 */

import type { LogContext } from './logger.js';

// =============================================================================
// Types
// =============================================================================

export interface ErrorSample {
  timestamp: Date;
  context: LogContext;
  stack?: string;
}

export interface AggregatedError {
  fingerprint: string;
  message: string;
  service: string;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  samples: ErrorSample[];
}

export interface ErrorAggregatorConfig {
  /** Minimum errors before triggering notification (default: 3) */
  threshold: number;
  /** Flush interval in milliseconds (default: 60000) */
  flushIntervalMs: number;
  /** Maximum samples to keep per error (default: 5) */
  maxSamples: number;
}

export type ErrorNotificationHandler = (errors: AggregatedError[]) => Promise<void>;

// =============================================================================
// Configuration
// =============================================================================

function loadConfig(): ErrorAggregatorConfig {
  return {
    threshold: parseInt(process.env.OPS_ERROR_THRESHOLD || '3', 10),
    flushIntervalMs: parseInt(process.env.OPS_FLUSH_INTERVAL_MS || '60000', 10),
    maxSamples: 5,
  };
}

// =============================================================================
// Error Aggregator
// =============================================================================

export class ErrorAggregator {
  private errors = new Map<string, AggregatedError>();
  private config: ErrorAggregatorConfig;
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private notificationHandler: ErrorNotificationHandler | null = null;

  constructor(config?: Partial<ErrorAggregatorConfig>) {
    const defaultConfig = loadConfig();
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Start the aggregation flush interval
   */
  start(): void {
    if (this.flushInterval) return;

    this.flushInterval = setInterval(() => {
      this.flush();
    }, this.config.flushIntervalMs);

    // Don't keep process alive just for logging
    if (this.flushInterval.unref) {
      this.flushInterval.unref();
    }
  }

  /**
   * Stop the aggregation flush interval
   */
  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  /**
   * Set the notification handler for when errors exceed threshold
   */
  setNotificationHandler(handler: ErrorNotificationHandler): void {
    this.notificationHandler = handler;
  }

  /**
   * Add an error to the aggregator
   */
  addError(message: string, context: LogContext, error?: Error): void {
    const fingerprint = this.createFingerprint(message, error?.stack);
    const service = (context.service as string) || 'unknown';

    const existing = this.errors.get(fingerprint);
    const now = new Date();

    const sample: ErrorSample = {
      timestamp: now,
      context,
      stack: error?.stack,
    };

    if (existing) {
      existing.count++;
      existing.lastSeen = now;
      // Keep only the most recent samples
      existing.samples.push(sample);
      if (existing.samples.length > this.config.maxSamples) {
        existing.samples.shift();
      }
    } else {
      this.errors.set(fingerprint, {
        fingerprint,
        message,
        service,
        count: 1,
        firstSeen: now,
        lastSeen: now,
        samples: [sample],
      });
    }
  }

  /**
   * Flush errors that exceed threshold and notify handler
   */
  async flush(): Promise<void> {
    if (!this.notificationHandler) return;

    const errorsToNotify: AggregatedError[] = [];

    for (const [fingerprint, error] of this.errors.entries()) {
      if (error.count >= this.config.threshold) {
        errorsToNotify.push(error);
        this.errors.delete(fingerprint);
      }
    }

    if (errorsToNotify.length > 0) {
      try {
        await this.notificationHandler(errorsToNotify);
      } catch (err) {
        // Log to console as fallback - don't use logger to avoid infinite loop
        console.error('[ErrorAggregator] Failed to send notifications:', err);
      }
    }
  }

  /**
   * Get current error counts (for monitoring)
   */
  getStats(): { totalErrors: number; uniqueErrors: number } {
    let totalErrors = 0;
    for (const error of this.errors.values()) {
      totalErrors += error.count;
    }
    return {
      totalErrors,
      uniqueErrors: this.errors.size,
    };
  }

  /**
   * Clear all aggregated errors
   */
  clear(): void {
    this.errors.clear();
  }

  /**
   * Create a fingerprint for deduplication
   */
  private createFingerprint(message: string, stack?: string): string {
    // Use message + first line of stack trace for fingerprinting
    const stackLine = stack?.split('\n')[1]?.trim() || '';
    return `${message}::${stackLine}`;
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const errorAggregator = new ErrorAggregator();
