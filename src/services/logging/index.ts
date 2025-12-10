/**
 * Logging Services
 * Exports structured logger, error aggregator, and ops notifications
 */

export { logger } from './logger.js';
export type { Logger, LogContext, LogLevel, LoggerWrapper } from './logger.js';

export { errorAggregator, ErrorAggregator } from './error-aggregator.js';
export type {
  ErrorSample,
  AggregatedError,
  ErrorAggregatorConfig,
  ErrorNotificationHandler,
} from './error-aggregator.js';

export { sendOpsNotification, sendTestNotification } from './ops-webhook.js';

// =============================================================================
// Initialization
// =============================================================================

import { logger } from './logger.js';
import { errorAggregator } from './error-aggregator.js';
import { sendOpsNotification } from './ops-webhook.js';

/**
 * Initialize logging services
 * - Connects logger to error aggregator
 * - Connects error aggregator to Discord ops webhook
 * - Starts the error aggregation flush interval
 */
export function initializeLogging(): void {
  // Connect logger errors to aggregator
  logger.onError((message, context, error) => {
    errorAggregator.addError(message, context, error);
  });

  // Connect aggregator to Discord webhook
  errorAggregator.setNotificationHandler(sendOpsNotification);

  // Start the flush interval
  errorAggregator.start();

  logger.info('Logging services initialized', { service: 'Logging' });
}

/**
 * Shutdown logging services
 * - Flushes remaining errors
 * - Stops the flush interval
 */
export async function shutdownLogging(): Promise<void> {
  // Flush any remaining errors
  await errorAggregator.flush();

  // Stop the flush interval
  errorAggregator.stop();
}
