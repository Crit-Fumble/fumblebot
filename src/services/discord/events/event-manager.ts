/**
 * Discord Event Manager
 * Monitors and manages Discord scheduled events
 * Automatically triggers actions when events start (e.g., start Foundry instances)
 */

import type { Client, GuildScheduledEvent } from 'discord.js';
import { GuildScheduledEventStatus } from 'discord.js';

interface EventAction {
  eventId: string;
  guildId: string;
  action: 'start-foundry' | 'start-voice' | 'send-notification' | 'custom';
  metadata?: {
    worldId?: string;
    channelId?: string;
    message?: string;
    [key: string]: any;
  };
}

export class EventManager {
  private client: Client;
  private eventActions: Map<string, EventAction> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Start monitoring Discord events
   */
  start() {
    console.log('[Events] Starting event manager...');

    // Listen for event updates
    this.client.on('guildScheduledEventUpdate', async (oldEvent, newEvent) => {
      if (oldEvent && newEvent && oldEvent.name && newEvent.name) {
        await this.handleEventUpdate(oldEvent as any, newEvent as any);
      }
    });

    // Listen for event deletions
    this.client.on('guildScheduledEventDelete', async (event) => {
      if (event && event.name) {
        await this.handleEventDelete(event as any);
      }
    });

    // Check for events starting soon every minute
    this.checkInterval = setInterval(() => {
      this.checkUpcomingEvents();
    }, 60_000); // Every 60 seconds

    // Do initial check
    this.checkUpcomingEvents();
  }

  /**
   * Stop monitoring events
   */
  stop() {
    console.log('[Events] Stopping event manager...');
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Register an action for a Discord event
   */
  registerEventAction(action: EventAction) {
    console.log(`[Events] Registering action for event ${action.eventId}`);
    this.eventActions.set(action.eventId, action);

    // TODO: Persist to database
    // await prisma.fumblebotEventAction.create({
    //   data: {
    //     eventId: action.eventId,
    //     guildId: action.guildId,
    //     action: action.action,
    //     metadata: action.metadata
    //   }
    // });
  }

  /**
   * Unregister an action for a Discord event
   */
  unregisterEventAction(eventId: string) {
    console.log(`[Events] Unregistering action for event ${eventId}`);
    this.eventActions.delete(eventId);

    // TODO: Remove from database
    // await prisma.fumblebotEventAction.delete({
    //   where: { eventId }
    // });
  }

  /**
   * Get action for an event
   */
  getEventAction(eventId: string): EventAction | undefined {
    return this.eventActions.get(eventId);
  }

  /**
   * Handle event update (status change)
   */
  private async handleEventUpdate(oldEvent: GuildScheduledEvent, newEvent: GuildScheduledEvent) {
    // Check if event just started
    if (
      oldEvent.status !== GuildScheduledEventStatus.Active &&
      newEvent.status === GuildScheduledEventStatus.Active
    ) {
      console.log(`[Events] Event started: ${newEvent.name} (${newEvent.id})`);
      await this.triggerEventStart(newEvent);
    }

    // Check if event completed
    if (newEvent.status === GuildScheduledEventStatus.Completed) {
      console.log(`[Events] Event completed: ${newEvent.name} (${newEvent.id})`);
      await this.triggerEventEnd(newEvent);
    }

    // Check if event was cancelled
    if (newEvent.status === GuildScheduledEventStatus.Canceled) {
      console.log(`[Events] Event cancelled: ${newEvent.name} (${newEvent.id})`);
      await this.triggerEventCancel(newEvent);
    }
  }

  /**
   * Handle event deletion
   */
  private async handleEventDelete(event: GuildScheduledEvent) {
    console.log(`[Events] Event deleted: ${event.name} (${event.id})`);
    this.unregisterEventAction(event.id);
  }

  /**
   * Check for upcoming events that need preparation
   */
  private async checkUpcomingEvents() {
    const now = Date.now();
    const upcomingWindow = 5 * 60 * 1000; // 5 minutes

    for (const guild of this.client.guilds.cache.values()) {
      try {
        const events = await guild.scheduledEvents.fetch();

        for (const event of events.values()) {
          // Only process scheduled events created by the bot
          if (event.creatorId !== this.client.user?.id) {
            continue;
          }

          if (!event.scheduledStartAt) {
            continue;
          }

          const timeUntilStart = event.scheduledStartAt.getTime() - now;

          // Event starting in the next 5 minutes
          if (timeUntilStart > 0 && timeUntilStart <= upcomingWindow) {
            const action = this.getEventAction(event.id);
            if (action) {
              console.log(`[Events] Event ${event.name} starting in ${Math.round(timeUntilStart / 1000)}s`);
              await this.prepareEvent(event, action);
            }
          }
        }
      } catch (error) {
        console.error(`[Events] Error checking events for guild ${guild.id}:`, error);
      }
    }
  }

  /**
   * Prepare for an event (5 minutes before start)
   */
  private async prepareEvent(event: GuildScheduledEvent, action: EventAction) {
    console.log(`[Events] Preparing event: ${event.name}`);

    // TODO: Send reminder notifications
    // TODO: Pre-start Foundry instances
    // TODO: Join voice channels

    // Example: Send notification
    if (action.metadata?.channelId) {
      try {
        const channel = await this.client.channels.fetch(action.metadata.channelId);
        if (channel?.isTextBased() && 'send' in channel) {
          await channel.send({
            content: `⏰ **Event Starting Soon**\n\n` +
              `**${event.name}** starts in 5 minutes!\n\n` +
              `${event.description || ''}\n\n` +
              `Get ready! 🎲`,
          });
        }
      } catch (error) {
        console.error('[Events] Failed to send preparation notification:', error);
      }
    }
  }

  /**
   * Trigger actions when event starts
   */
  private async triggerEventStart(event: GuildScheduledEvent) {
    const action = this.getEventAction(event.id);
    if (!action) {
      console.log(`[Events] No action registered for event ${event.id}`);
      return;
    }

    console.log(`[Events] Triggering action: ${action.action}`);

    try {
      switch (action.action) {
        case 'start-foundry':
          await this.startFoundryInstance(action);
          break;

        case 'start-voice':
          await this.startVoiceSession(action);
          break;

        case 'send-notification':
          await this.sendNotification(event, action);
          break;

        case 'custom':
          // Custom action handler
          console.log('[Events] Custom action triggered');
          break;

        default:
          console.warn(`[Events] Unknown action type: ${action.action}`);
      }
    } catch (error) {
      console.error(`[Events] Failed to trigger action for event ${event.id}:`, error);

      // Notify channel of failure
      if (action.metadata?.channelId) {
        try {
          const channel = await this.client.channels.fetch(action.metadata.channelId);
          if (channel?.isTextBased() && 'send' in channel) {
            await channel.send({
              content: `❌ Failed to start **${event.name}**: ${error instanceof Error ? error.message : 'Unknown error'}`,
            });
          }
        } catch (notifyError) {
          console.error('[Events] Failed to send error notification:', notifyError);
        }
      }
    }
  }

  /**
   * Trigger actions when event ends
   */
  private async triggerEventEnd(event: GuildScheduledEvent) {
    const action = this.getEventAction(event.id);
    if (!action) {
      return;
    }

    console.log(`[Events] Event ended: ${event.name}`);

    // TODO: Stop Foundry instances
    // TODO: Leave voice channels
    // TODO: Send completion notifications
  }

  /**
   * Handle event cancellation
   */
  private async triggerEventCancel(event: GuildScheduledEvent) {
    const action = this.getEventAction(event.id);
    if (!action) {
      return;
    }

    console.log(`[Events] Event cancelled: ${event.name}`);

    // TODO: Cancel any preparations
    // TODO: Send cancellation notifications

    // Clean up action
    this.unregisterEventAction(event.id);
  }

  /**
   * Start a Foundry VTT instance
   *
   * TODO: Integrate with foundryvtt-server package
   */
  private async startFoundryInstance(action: EventAction) {
    const worldId = action.metadata?.worldId;
    if (!worldId) {
      throw new Error('No worldId specified in event action metadata');
    }

    console.log(`[Events] Starting Foundry instance for world: ${worldId}`);

    // STUB: This will call the foundryvtt-server API
    // const response = await fetch('http://DROPLET_IP:3000/api/start', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     worldId,
    //     ownerId: action.metadata?.ownerId,
    //     environment: action.metadata?.environment || 'production',
    //     slot: action.metadata?.slot || 0
    //   })
    // });
    //
    // if (!response.ok) {
    //   throw new Error('Failed to start Foundry instance');
    // }
    //
    // const data = await response.json();
    // console.log('[Events] Foundry instance started:', data);

    // Send notification
    if (action.metadata?.channelId) {
      const channel = await this.client.channels.fetch(action.metadata.channelId);
      if (channel?.isTextBased() && 'send' in channel) {
        await channel.send({
          content: `✅ **Foundry VTT Started**\n\n` +
            `Your game session is ready!\n` +
            `🎲 Join at: [Coming Soon]\n\n` +
            `Have fun!`,
        });
      }
    }
  }

  /**
   * Start a voice session
   */
  private async startVoiceSession(action: EventAction) {
    // TODO: Join voice channel
    // TODO: Play intro music/sound
    console.log('[Events] Starting voice session (stub)');
  }

  /**
   * Send event notification
   */
  private async sendNotification(event: GuildScheduledEvent, action: EventAction) {
    const channelId = action.metadata?.channelId;
    const message = action.metadata?.message || `**${event.name}** has started!`;

    if (!channelId) {
      return;
    }

    const channel = await this.client.channels.fetch(channelId);
    if (channel?.isTextBased() && 'send' in channel) {
      await channel.send(message);
    }
  }

  /**
   * Load event actions from database
   *
   * TODO: Implement database persistence
   */
  async loadEventActions() {
    console.log('[Events] Loading event actions from database...');

    // STUB: Load from database
    // const actions = await prisma.fumblebotEventAction.findMany({
    //   where: {
    //     deletedAt: null
    //   }
    // });
    //
    // for (const action of actions) {
    //   this.eventActions.set(action.eventId, {
    //     eventId: action.eventId,
    //     guildId: action.guildId,
    //     action: action.action,
    //     metadata: action.metadata
    //   });
    // }

    console.log(`[Events] Loaded ${this.eventActions.size} event actions`);
  }
}

// Singleton instance (initialized when Discord client is ready)
let eventManager: EventManager | null = null;

export function initializeEventManager(client: Client): EventManager {
  if (!eventManager) {
    eventManager = new EventManager(client);
  }
  return eventManager;
}

export function getEventManager(): EventManager {
  if (!eventManager) {
    throw new Error('EventManager not initialized. Call initializeEventManager first.');
  }
  return eventManager;
}
