/**
 * Channel KB Sources Controller
 * CRUD API endpoints for managing Discord channels as knowledge base sources
 */

import type { Request, Response } from 'express';
import { z } from 'zod';
import { getPrisma } from '../services/db/client.js';
import { getFumbleBotClient } from '../services/discord/index.js';
import { DiscordChannelReader } from '../services/discord/channel-reader.js';
import { getKnowledgeBaseClient, isKnowledgeBaseConfigured } from '../lib/knowledge-base-client.js';

/**
 * Valid channel types for KB sources
 */
const ChannelKBType = z.enum(['text', 'forum', 'thread']);
type ChannelKBType = z.infer<typeof ChannelKBType>;

/**
 * Input validation schemas
 */
const CreateChannelKBSourceSchema = z.object({
  channelId: z.string().min(1, 'Channel ID is required'),
  channelName: z.string().optional(),
  channelType: ChannelKBType.optional().default('text'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  category: z.string().max(50, 'Category too long').optional().default('general'),
  syncEnabled: z.boolean().optional().default(true),
  syncThreads: z.boolean().optional().default(true),
  syncPinned: z.boolean().optional().default(true),
  maxMessages: z.number().int().min(10).max(1000).optional().default(100),
});

const UpdateChannelKBSourceSchema = z.object({
  channelName: z.string().optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  category: z.string().max(50).optional(),
  syncEnabled: z.boolean().optional(),
  syncThreads: z.boolean().optional(),
  syncPinned: z.boolean().optional(),
  maxMessages: z.number().int().min(10).max(1000).optional(),
});

/**
 * GET /api/admin/guilds/:guildId/channel-kb
 * List all channel KB sources for a guild
 */
export async function handleListChannelKBSources(req: Request, res: Response): Promise<void> {
  try {
    const { guildId } = req.params;
    const { enabled } = req.query;

    const prisma = getPrisma();

    const where: {
      guildId: string;
      syncEnabled?: boolean;
    } = { guildId };

    if (enabled !== undefined) {
      where.syncEnabled = enabled === 'true';
    }

    const sources = await prisma.channelKBSource.findMany({
      where,
      orderBy: [
        { channelType: 'asc' },
        { name: 'asc' },
      ],
    });

    res.json({
      sources,
      count: sources.length,
    });
  } catch (error) {
    console.error('[ChannelKB] Error listing sources:', error);
    res.status(500).json({ error: 'Failed to list channel KB sources' });
  }
}

/**
 * GET /api/admin/guilds/:guildId/channel-kb/:id
 * Get a specific channel KB source
 */
export async function handleGetChannelKBSource(req: Request, res: Response): Promise<void> {
  try {
    const { guildId, id } = req.params;

    const prisma = getPrisma();
    const source = await prisma.channelKBSource.findFirst({
      where: { id, guildId },
    });

    if (!source) {
      res.status(404).json({ error: 'Channel KB source not found' });
      return;
    }

    res.json(source);
  } catch (error) {
    console.error('[ChannelKB] Error getting source:', error);
    res.status(500).json({ error: 'Failed to get channel KB source' });
  }
}

/**
 * POST /api/admin/guilds/:guildId/channel-kb
 * Create a new channel KB source
 */
export async function handleCreateChannelKBSource(req: Request, res: Response): Promise<void> {
  try {
    const { guildId } = req.params;

    // Get user from session
    const user = req.session?.user;
    if (!user?.discordId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Validate request body
    const parseResult = CreateChannelKBSourceSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Invalid request',
        details: parseResult.error.issues.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
      return;
    }

    const data = parseResult.data;
    const prisma = getPrisma();

    // Check for duplicate channel
    const existing = await prisma.channelKBSource.findFirst({
      where: {
        guildId,
        channelId: data.channelId,
      },
    });

    if (existing) {
      res.status(409).json({
        error: 'This channel is already configured as a KB source',
      });
      return;
    }

    const source = await prisma.channelKBSource.create({
      data: {
        guildId,
        channelId: data.channelId,
        channelName: data.channelName,
        channelType: data.channelType,
        name: data.name,
        description: data.description,
        category: data.category,
        syncEnabled: data.syncEnabled,
        syncThreads: data.syncThreads,
        syncPinned: data.syncPinned,
        maxMessages: data.maxMessages,
        createdBy: user.discordId,
      },
    });

    res.status(201).json(source);
  } catch (error) {
    console.error('[ChannelKB] Error creating source:', error);
    res.status(500).json({ error: 'Failed to create channel KB source' });
  }
}

/**
 * POST /api/admin/guilds/:guildId/channel-kb/:id
 * Update a channel KB source
 */
export async function handleUpdateChannelKBSource(req: Request, res: Response): Promise<void> {
  try {
    const { guildId, id } = req.params;

    // Validate request body
    const parseResult = UpdateChannelKBSourceSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Invalid request',
        details: parseResult.error.issues.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
      return;
    }

    const data = parseResult.data;
    const prisma = getPrisma();

    // Check if exists
    const existing = await prisma.channelKBSource.findFirst({
      where: { id, guildId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Channel KB source not found' });
      return;
    }

    const source = await prisma.channelKBSource.update({
      where: { id },
      data: {
        ...(data.channelName !== undefined && { channelName: data.channelName }),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.syncEnabled !== undefined && { syncEnabled: data.syncEnabled }),
        ...(data.syncThreads !== undefined && { syncThreads: data.syncThreads }),
        ...(data.syncPinned !== undefined && { syncPinned: data.syncPinned }),
        ...(data.maxMessages !== undefined && { maxMessages: data.maxMessages }),
      },
    });

    res.json(source);
  } catch (error) {
    console.error('[ChannelKB] Error updating source:', error);
    res.status(500).json({ error: 'Failed to update channel KB source' });
  }
}

/**
 * DELETE /api/admin/guilds/:guildId/channel-kb/:id
 * Delete a channel KB source
 */
export async function handleDeleteChannelKBSource(req: Request, res: Response): Promise<void> {
  try {
    const { guildId, id } = req.params;

    const prisma = getPrisma();

    // Check if exists
    const existing = await prisma.channelKBSource.findFirst({
      where: { id, guildId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Channel KB source not found' });
      return;
    }

    await prisma.channelKBSource.delete({
      where: { id },
    });

    // Delete from Core KB if configured
    if (isKnowledgeBaseConfigured()) {
      try {
        const kbClient = getKnowledgeBaseClient();
        await kbClient.deleteSource(id);
        console.log(`[ChannelKB] Deleted source ${id} from Core KB`);
      } catch (kbError) {
        console.error('[ChannelKB] Failed to delete from Core KB:', kbError);
        // Don't fail the request if KB deletion fails
      }
    }

    res.json({ deleted: true, id });
  } catch (error) {
    console.error('[ChannelKB] Error deleting source:', error);
    res.status(500).json({ error: 'Failed to delete channel KB source' });
  }
}

/**
 * POST /api/admin/guilds/:guildId/channel-kb/:id/sync
 * Trigger sync for a channel KB source
 */
export async function handleSyncChannelKBSource(req: Request, res: Response): Promise<void> {
  try {
    const { guildId, id } = req.params;

    const prisma = getPrisma();

    // Get the source
    const source = await prisma.channelKBSource.findFirst({
      where: { id, guildId },
    });

    if (!source) {
      res.status(404).json({ error: 'Channel KB source not found' });
      return;
    }

    // Get Discord client
    const botClient = getFumbleBotClient();
    if (!botClient) {
      res.status(503).json({ error: 'Discord bot is not connected' });
      return;
    }

    // Create reader and fetch content
    const reader = new DiscordChannelReader(botClient.client);

    let content;
    try {
      switch (source.channelType) {
        case 'forum':
          content = await reader.readForumChannel(source.channelId, {
            maxMessages: source.maxMessages,
            includePinned: source.syncPinned,
            includeThreads: source.syncThreads,
          });
          break;
        case 'thread':
          content = await reader.readThread(source.channelId, {
            maxMessages: source.maxMessages,
            includePinned: source.syncPinned,
          });
          break;
        default:
          content = await reader.readTextChannel(source.channelId, {
            maxMessages: source.maxMessages,
            includePinned: source.syncPinned,
          });
      }
    } catch (readError: any) {
      // Update sync status with error
      await prisma.channelKBSource.update({
        where: { id },
        data: {
          lastSyncAt: new Date(),
          lastSyncStatus: 'error',
          lastSyncError: readError.message || 'Failed to read channel',
        },
      });

      res.status(500).json({
        error: 'Failed to read channel',
        details: readError.message,
      });
      return;
    }

    // Format for KB
    const documents = reader.formatForKB(content, source.name, source.category);

    // Send to Core KB for indexing if configured
    let kbStatus: 'success' | 'partial' | 'error' = 'success';
    let kbError: string | null = null;

    if (isKnowledgeBaseConfigured() && documents.length > 0) {
      try {
        const kbClient = getKnowledgeBaseClient();
        const ingestResult = await kbClient.ingestDocuments({
          sourceType: 'discord',
          sourceId: id,
          sourceName: source.name,
          guildId,
          documents: documents.map(d => ({
            id: d.id,
            title: d.title,
            content: d.content,
            system: d.system || undefined,
            category: d.category,
            metadata: d.metadata,
          })),
        });

        if (!ingestResult.success || ingestResult.errors?.length) {
          kbStatus = 'partial';
          kbError = ingestResult.errors?.join('; ') || 'Some documents failed to index';
        }

        console.log(
          `[ChannelKB] Indexed ${ingestResult.documentsIndexed}/${documents.length} documents to Core KB`
        );
      } catch (kbIngestionError: any) {
        console.error('[ChannelKB] Failed to ingest to Core KB:', kbIngestionError);
        kbStatus = 'error';
        kbError = kbIngestionError.message || 'Failed to ingest documents';
      }
    }

    // Update sync status
    await prisma.channelKBSource.update({
      where: { id },
      data: {
        channelName: content.channelName, // Update cached name
        lastSyncAt: new Date(),
        lastSyncStatus: kbStatus,
        lastSyncError: kbError,
      },
    });

    res.json({
      success: true,
      channelName: content.channelName,
      messageCount: content.messages.length,
      threadCount: content.threads.length,
      documentCount: documents.length,
      kbIndexed: kbStatus === 'success',
      kbStatus,
      kbError,
      documents: documents.map(d => ({
        id: d.id,
        title: d.title,
        messageCount: d.metadata.messageCount,
      })),
    });
  } catch (error: any) {
    console.error('[ChannelKB] Error syncing source:', error);
    res.status(500).json({ error: 'Failed to sync channel KB source' });
  }
}

/**
 * GET /api/admin/guilds/:guildId/channels
 * List available Discord channels for KB configuration
 */
export async function handleListGuildChannels(req: Request, res: Response): Promise<void> {
  try {
    const { guildId } = req.params;

    // Get Discord client
    const botClient = getFumbleBotClient();
    if (!botClient) {
      res.status(503).json({ error: 'Discord bot is not connected' });
      return;
    }

    const reader = new DiscordChannelReader(botClient.client);

    try {
      const channels = await reader.listGuildChannels(guildId);

      // Get already configured channels
      const prisma = getPrisma();
      const configured = await prisma.channelKBSource.findMany({
        where: { guildId },
        select: { channelId: true },
      });
      const configuredIds = new Set(configured.map(c => c.channelId));

      // Mark which channels are already configured
      const channelsWithStatus = channels.map(c => ({
        ...c,
        isConfigured: configuredIds.has(c.id),
      }));

      res.json({
        channels: channelsWithStatus,
        count: channels.length,
      });
    } catch (fetchError: any) {
      if (fetchError.code === 10004) {
        res.status(404).json({ error: 'Guild not found or bot not in guild' });
        return;
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('[ChannelKB] Error listing guild channels:', error);
    res.status(500).json({ error: 'Failed to list guild channels' });
  }
}
