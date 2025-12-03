/**
 * Channel KB Sync Service
 * Background service for syncing Discord channel content to the knowledge base
 */

import { getPrisma } from '../db/client.js';
import { getFumbleBotClient } from './index.js';
import { DiscordChannelReader, type KBDocument } from './channel-reader.js';

export interface SyncResult {
  sourceId: string;
  channelId: string;
  channelName: string;
  success: boolean;
  documentCount: number;
  messageCount: number;
  threadCount: number;
  error?: string;
  syncedAt: Date;
}

export interface SyncStats {
  totalSources: number;
  successCount: number;
  errorCount: number;
  totalDocuments: number;
  results: SyncResult[];
  startedAt: Date;
  completedAt: Date;
}

/**
 * Channel KB Sync Service
 * Handles background synchronization of Discord channel content
 */
export class ChannelKBSyncService {
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private isSyncing = false;

  /**
   * Start the background sync scheduler
   * @param intervalHours How often to sync (default: 6 hours)
   */
  startScheduler(intervalHours: number = 6): void {
    if (this.syncInterval) {
      console.warn('[ChannelKBSync] Scheduler already running');
      return;
    }

    const intervalMs = intervalHours * 60 * 60 * 1000;
    console.log(`[ChannelKBSync] Starting scheduler (every ${intervalHours} hours)`);

    // Run initial sync after 1 minute (give bot time to connect)
    setTimeout(() => {
      this.syncAllGuilds().catch(err => {
        console.error('[ChannelKBSync] Initial sync failed:', err);
      });
    }, 60 * 1000);

    // Schedule recurring syncs
    this.syncInterval = setInterval(() => {
      this.syncAllGuilds().catch(err => {
        console.error('[ChannelKBSync] Scheduled sync failed:', err);
      });
    }, intervalMs);
  }

  /**
   * Stop the background sync scheduler
   */
  stopScheduler(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('[ChannelKBSync] Scheduler stopped');
    }
  }

  /**
   * Sync all enabled sources across all guilds
   */
  async syncAllGuilds(): Promise<SyncStats> {
    if (this.isSyncing) {
      console.warn('[ChannelKBSync] Sync already in progress, skipping');
      return {
        totalSources: 0,
        successCount: 0,
        errorCount: 0,
        totalDocuments: 0,
        results: [],
        startedAt: new Date(),
        completedAt: new Date(),
      };
    }

    this.isSyncing = true;
    const startedAt = new Date();
    const results: SyncResult[] = [];

    try {
      const prisma = getPrisma();
      const botClient = getFumbleBotClient();

      if (!botClient) {
        console.warn('[ChannelKBSync] Discord bot not connected');
        return {
          totalSources: 0,
          successCount: 0,
          errorCount: 0,
          totalDocuments: 0,
          results: [],
          startedAt,
          completedAt: new Date(),
        };
      }

      // Get all enabled sources
      const sources = await prisma.channelKBSource.findMany({
        where: { syncEnabled: true },
      });

      console.log(`[ChannelKBSync] Starting sync of ${sources.length} sources`);

      const reader = new DiscordChannelReader(botClient.client);

      // Process each source
      for (const source of sources) {
        const result = await this.syncSource(source, reader);
        results.push(result);

        // Small delay between sources to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const completedAt = new Date();
      const stats: SyncStats = {
        totalSources: sources.length,
        successCount: results.filter(r => r.success).length,
        errorCount: results.filter(r => !r.success).length,
        totalDocuments: results.reduce((sum, r) => sum + r.documentCount, 0),
        results,
        startedAt,
        completedAt,
      };

      console.log(
        `[ChannelKBSync] Sync completed: ${stats.successCount}/${stats.totalSources} successful, ` +
        `${stats.totalDocuments} documents, ${completedAt.getTime() - startedAt.getTime()}ms`
      );

      return stats;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync a single source by ID
   */
  async syncSourceById(sourceId: string): Promise<SyncResult> {
    const prisma = getPrisma();
    const source = await prisma.channelKBSource.findUnique({
      where: { id: sourceId },
    });

    if (!source) {
      return {
        sourceId,
        channelId: '',
        channelName: 'Unknown',
        success: false,
        documentCount: 0,
        messageCount: 0,
        threadCount: 0,
        error: 'Source not found',
        syncedAt: new Date(),
      };
    }

    const botClient = getFumbleBotClient();
    if (!botClient) {
      return {
        sourceId,
        channelId: source.channelId,
        channelName: source.channelName || 'Unknown',
        success: false,
        documentCount: 0,
        messageCount: 0,
        threadCount: 0,
        error: 'Discord bot not connected',
        syncedAt: new Date(),
      };
    }

    const reader = new DiscordChannelReader(botClient.client);
    return this.syncSource(source, reader);
  }

  /**
   * Sync a single source
   */
  private async syncSource(
    source: {
      id: string;
      guildId: string;
      channelId: string;
      channelName: string | null;
      channelType: string;
      name: string;
      category: string;
      syncThreads: boolean;
      syncPinned: boolean;
      maxMessages: number;
      lastSyncAt: Date | null;
    },
    reader: DiscordChannelReader
  ): Promise<SyncResult> {
    const prisma = getPrisma();
    const syncedAt = new Date();

    try {
      // Read channel content
      let content;
      const readOptions = {
        maxMessages: source.maxMessages,
        includePinned: source.syncPinned,
        includeThreads: source.syncThreads,
        // For incremental sync, only fetch messages after last sync
        after: source.lastSyncAt || undefined,
      };

      switch (source.channelType) {
        case 'forum':
          content = await reader.readForumChannel(source.channelId, readOptions);
          break;
        case 'thread':
          content = await reader.readThread(source.channelId, readOptions);
          break;
        default:
          content = await reader.readTextChannel(source.channelId, readOptions);
      }

      // Format for KB
      const documents = reader.formatForKB(content, source.name, source.category);

      // TODO: Send to Core KB for indexing
      // For now, log what would be sent
      if (documents.length > 0) {
        console.log(
          `[ChannelKBSync] ${source.name}: ${documents.length} documents, ` +
          `${content.messages.length} messages, ${content.threads.length} threads`
        );
      }

      // Update source with sync status
      await prisma.channelKBSource.update({
        where: { id: source.id },
        data: {
          channelName: content.channelName,
          lastSyncAt: syncedAt,
          lastSyncStatus: 'success',
          lastSyncError: null,
        },
      });

      return {
        sourceId: source.id,
        channelId: source.channelId,
        channelName: content.channelName,
        success: true,
        documentCount: documents.length,
        messageCount: content.messages.length,
        threadCount: content.threads.length,
        syncedAt,
      };
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      console.error(`[ChannelKBSync] Error syncing ${source.name}:`, errorMessage);

      // Update source with error status
      await prisma.channelKBSource.update({
        where: { id: source.id },
        data: {
          lastSyncAt: syncedAt,
          lastSyncStatus: 'error',
          lastSyncError: errorMessage,
        },
      });

      return {
        sourceId: source.id,
        channelId: source.channelId,
        channelName: source.channelName || 'Unknown',
        success: false,
        documentCount: 0,
        messageCount: 0,
        threadCount: 0,
        error: errorMessage,
        syncedAt,
      };
    }
  }

  /**
   * Sync all sources for a specific guild
   */
  async syncGuild(guildId: string): Promise<SyncResult[]> {
    const prisma = getPrisma();
    const sources = await prisma.channelKBSource.findMany({
      where: { guildId, syncEnabled: true },
    });

    const botClient = getFumbleBotClient();
    if (!botClient) {
      return sources.map(s => ({
        sourceId: s.id,
        channelId: s.channelId,
        channelName: s.channelName || 'Unknown',
        success: false,
        documentCount: 0,
        messageCount: 0,
        threadCount: 0,
        error: 'Discord bot not connected',
        syncedAt: new Date(),
      }));
    }

    const reader = new DiscordChannelReader(botClient.client);
    const results: SyncResult[] = [];

    for (const source of sources) {
      const result = await this.syncSource(source, reader);
      results.push(result);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return results;
  }
}

// Singleton instance
export const channelKBSync = new ChannelKBSyncService();
