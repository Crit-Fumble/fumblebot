/**
 * Discord Ops Webhook Service
 * Sends error notifications to Discord ops channel
 */

import type { AggregatedError } from './error-aggregator.js';

// =============================================================================
// Types
// =============================================================================

interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields: { name: string; value: string; inline?: boolean }[];
  footer: { text: string };
  timestamp: string;
}

interface DiscordWebhookPayload {
  embeds: DiscordEmbed[];
}

// =============================================================================
// Configuration
// =============================================================================

function getWebhookUrl(): string | undefined {
  return process.env.OPS_WEBHOOK_URL;
}

function getEnvironment(): string {
  return process.env.NODE_ENV || 'development';
}

// =============================================================================
// Color Constants
// =============================================================================

const COLORS = {
  error: 0xED4245,    // Red
  warn: 0xFEE75C,     // Yellow
  critical: 0x9B59B6, // Purple
};

// =============================================================================
// Formatting Helpers
// =============================================================================

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

function formatTimestamp(date: Date): string {
  return date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
}

function formatStack(stack?: string): string {
  if (!stack) return 'No stack trace';
  // Get first 5 lines of stack
  const lines = stack.split('\n').slice(0, 5);
  return truncate(lines.join('\n'), 1000);
}

// =============================================================================
// Embed Builder
// =============================================================================

function buildErrorEmbed(error: AggregatedError): DiscordEmbed {
  const isCritical = error.count >= 10;
  const color = isCritical ? COLORS.critical : COLORS.error;
  const emoji = isCritical ? '🟣' : '🔴';

  const fields: { name: string; value: string; inline?: boolean }[] = [
    { name: 'Service', value: error.service || 'unknown', inline: true },
    { name: 'Occurrences', value: `${error.count}`, inline: true },
    { name: 'First seen', value: formatTimestamp(error.firstSeen), inline: true },
    { name: 'Last seen', value: formatTimestamp(error.lastSeen), inline: true },
  ];

  // Add stack trace from most recent sample
  const latestSample = error.samples[error.samples.length - 1];
  if (latestSample?.stack) {
    fields.push({
      name: 'Stack trace',
      value: `\`\`\`\n${formatStack(latestSample.stack)}\n\`\`\``,
      inline: false,
    });
  }

  return {
    title: `${emoji} ${truncate(error.message, 200)}`,
    description: `Error aggregated over ${Math.round((error.lastSeen.getTime() - error.firstSeen.getTime()) / 1000)}s`,
    color,
    fields,
    footer: { text: `${getEnvironment()} environment` },
    timestamp: new Date().toISOString(),
  };
}

// =============================================================================
// Webhook Sender
// =============================================================================

export async function sendOpsNotification(errors: AggregatedError[]): Promise<void> {
  const webhookUrl = getWebhookUrl();
  if (!webhookUrl) {
    // Silently skip if webhook not configured
    return;
  }

  // Build embeds (max 10 per webhook call)
  const embeds = errors.slice(0, 10).map(buildErrorEmbed);

  const payload: DiscordWebhookPayload = { embeds };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`[OpsWebhook] Failed to send notification: ${response.status} ${response.statusText}`);
    }
  } catch (err) {
    console.error('[OpsWebhook] Failed to send notification:', err);
  }
}

// =============================================================================
// Test Notification
// =============================================================================

/**
 * Send a test notification to verify webhook configuration
 */
export async function sendTestNotification(): Promise<boolean> {
  const webhookUrl = getWebhookUrl();
  if (!webhookUrl) {
    console.warn('[OpsWebhook] No OPS_WEBHOOK_URL configured');
    return false;
  }

  const testEmbed: DiscordEmbed = {
    title: '✅ Ops Webhook Test',
    description: 'This is a test notification from FumbleBot ops monitoring.',
    color: 0x57F287, // Green
    fields: [
      { name: 'Environment', value: getEnvironment(), inline: true },
      { name: 'Timestamp', value: formatTimestamp(new Date()), inline: true },
    ],
    footer: { text: 'Ops monitoring active' },
    timestamp: new Date().toISOString(),
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ embeds: [testEmbed] }),
    });

    return response.ok;
  } catch (err) {
    console.error('[OpsWebhook] Test notification failed:', err);
    return false;
  }
}
