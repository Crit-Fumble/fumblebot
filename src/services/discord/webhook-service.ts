/**
 * Discord Webhook Service
 * Manages ephemeral webhooks for character roleplay
 */

import type { TextChannel, ThreadChannel, Webhook, Client } from 'discord.js';
import type { Character } from '@prisma/fumblebot';

export interface WebhookMessageOptions {
  content: string;
  username: string;
  avatarURL?: string;
}

export class WebhookService {
  private static instance: WebhookService;
  private client: Client | null = null;

  private constructor() {}

  static getInstance(): WebhookService {
    if (!WebhookService.instance) {
      WebhookService.instance = new WebhookService();
    }
    return WebhookService.instance;
  }

  /**
   * Initialize with Discord client
   */
  initialize(client: Client): void {
    this.client = client;
  }

  /**
   * Send a message as a character using an ephemeral webhook
   */
  async sendAsCharacter(
    channel: TextChannel | ThreadChannel,
    character: Character,
    content: string
  ): Promise<void> {
    if (!this.client) {
      throw new Error('WebhookService not initialized with Discord client');
    }

    // For threads, we need to use the parent channel's webhooks
    const webhookChannel = channel.isThread() ? channel.parent : channel;

    if (!webhookChannel || !webhookChannel.isTextBased()) {
      throw new Error('Channel does not support webhooks');
    }

    // Create ephemeral webhook
    const webhook = await this.createEphemeralWebhook(
      webhookChannel as TextChannel,
      character.name
    );

    try {
      // Send message as character
      await webhook.send({
        content,
        username: character.name,
        avatarURL: character.tokenUrl || undefined,
        threadId: channel.isThread() ? channel.id : undefined,
      });
    } finally {
      // Clean up webhook
      await this.deleteWebhook(webhook);
    }
  }

  /**
   * Create an ephemeral webhook
   */
  private async createEphemeralWebhook(
    channel: TextChannel,
    name: string
  ): Promise<Webhook> {
    return channel.createWebhook({
      name: `${name} (Temporary)`,
      reason: 'Ephemeral webhook for character roleplay',
    });
  }

  /**
   * Delete a webhook
   */
  private async deleteWebhook(webhook: Webhook): Promise<void> {
    try {
      await webhook.delete('Ephemeral webhook cleanup');
    } catch (error) {
      console.error('[WebhookService] Failed to delete webhook:', error);
      // Don't throw - webhook cleanup failure shouldn't break the command
    }
  }

  /**
   * Check if a channel supports webhooks
   */
  canUseWebhooks(channel: TextChannel | ThreadChannel): boolean {
    // Threads inherit webhook capability from their parent
    if (channel.isThread()) {
      return channel.parent ? this.canUseWebhooks(channel.parent as TextChannel) : false;
    }

    // Text channels support webhooks
    return channel.isTextBased() && 'createWebhook' in channel;
  }
}

export default WebhookService.getInstance();
