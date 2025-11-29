/**
 * Admin Dashboard Controller
 * API endpoints for the FumbleBot admin dashboard
 * - Guild metrics and statistics
 * - Discord server structure (channels, roles)
 */

import type { Request, Response } from 'express';
import { getPrisma } from '../services/db.js';

/**
 * GET /api/admin/guilds/:guildId/metrics
 * Get server metrics and statistics
 */
export async function handleGetGuildMetrics(req: Request, res: Response): Promise<void> {
  try {
    const { guildId } = req.params;
    const { period = '7d' } = req.query;

    const prisma = getPrisma();

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Get command usage stats
    const commandStats = await prisma.botCommand.groupBy({
      by: ['command'],
      where: {
        guildId,
        executedAt: { gte: startDate },
      },
      _count: { command: true },
      orderBy: { _count: { command: 'desc' } },
      take: 10,
    });

    // Get total commands in period
    const totalCommands = await prisma.botCommand.count({
      where: {
        guildId,
        executedAt: { gte: startDate },
      },
    });

    // Get dice roll stats
    const diceStats = await prisma.diceRoll.aggregate({
      where: {
        guildId,
        rolledAt: { gte: startDate },
      },
      _count: { id: true },
      _sum: { total: true },
      _avg: { total: true },
    });

    const critCount = await prisma.diceRoll.count({
      where: {
        guildId,
        rolledAt: { gte: startDate },
        isCrit: true,
      },
    });

    const fumbleCount = await prisma.diceRoll.count({
      where: {
        guildId,
        rolledAt: { gte: startDate },
        isFumble: true,
      },
    });

    // Get active sessions
    const activeSessions = await prisma.fumbleSession.count({
      where: {
        campaign: { guildId },
        status: 'active',
      },
    });

    // Get total campaigns
    const totalCampaigns = await prisma.fumbleCampaign.count({
      where: { guildId },
    });

    // Get unique users in period
    const uniqueUsers = await prisma.botCommand.groupBy({
      by: ['discordId'],
      where: {
        guildId,
        executedAt: { gte: startDate },
      },
    });

    // Get prompt partials count
    const promptPartials = await prisma.promptPartial.count({
      where: { guildId },
    });

    const enabledPromptPartials = await prisma.promptPartial.count({
      where: { guildId, isEnabled: true },
    });

    res.json({
      period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      metrics: {
        commands: {
          total: totalCommands,
          topCommands: commandStats.map(c => ({
            command: c.command,
            count: c._count.command,
          })),
        },
        dice: {
          totalRolls: diceStats._count.id || 0,
          totalSum: diceStats._sum.total || 0,
          averageRoll: Math.round((diceStats._avg.total || 0) * 100) / 100,
          crits: critCount,
          fumbles: fumbleCount,
        },
        sessions: {
          active: activeSessions,
        },
        campaigns: {
          total: totalCampaigns,
        },
        users: {
          activeInPeriod: uniqueUsers.length,
        },
        prompts: {
          total: promptPartials,
          enabled: enabledPromptPartials,
        },
      },
    });
  } catch (error) {
    console.error('[Admin] Error getting guild metrics:', error);
    res.status(500).json({ error: 'Failed to get guild metrics' });
  }
}

/**
 * GET /api/admin/guilds/:guildId/settings
 * Get guild settings
 */
export async function handleGetGuildSettings(req: Request, res: Response): Promise<void> {
  try {
    const { guildId } = req.params;

    const prisma = getPrisma();
    const guild = await prisma.guild.findUnique({
      where: { guildId },
      select: {
        id: true,
        guildId: true,
        name: true,
        settings: true,
        isHome: true,
        installedAt: true,
        updatedAt: true,
      },
    });

    if (!guild) {
      res.status(404).json({ error: 'Guild not found' });
      return;
    }

    res.json(guild);
  } catch (error) {
    console.error('[Admin] Error getting guild settings:', error);
    res.status(500).json({ error: 'Failed to get guild settings' });
  }
}

/**
 * PATCH /api/admin/guilds/:guildId/settings
 * Update guild settings
 */
export async function handleUpdateGuildSettings(req: Request, res: Response): Promise<void> {
  try {
    const { guildId } = req.params;
    const { settings } = req.body;

    if (typeof settings !== 'object') {
      res.status(400).json({ error: 'Settings must be an object' });
      return;
    }

    const prisma = getPrisma();

    // Get current settings
    const guild = await prisma.guild.findUnique({
      where: { guildId },
      select: { settings: true },
    });

    if (!guild) {
      res.status(404).json({ error: 'Guild not found' });
      return;
    }

    // Merge settings (shallow merge)
    const currentSettings = (guild.settings as Record<string, unknown>) || {};
    const newSettings = { ...currentSettings, ...settings };

    const updated = await prisma.guild.update({
      where: { guildId },
      data: { settings: newSettings },
      select: {
        id: true,
        guildId: true,
        name: true,
        settings: true,
        updatedAt: true,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('[Admin] Error updating guild settings:', error);
    res.status(500).json({ error: 'Failed to update guild settings' });
  }
}

/**
 * GET /api/admin/guilds/:guildId/activity
 * Get recent activity timeline
 */
export async function handleGetGuildActivity(req: Request, res: Response): Promise<void> {
  try {
    const { guildId } = req.params;
    const { limit = '50' } = req.query;

    const prisma = getPrisma();
    const take = Math.min(parseInt(limit as string) || 50, 100);

    // Get recent commands
    const recentCommands = await prisma.botCommand.findMany({
      where: { guildId },
      orderBy: { executedAt: 'desc' },
      take,
      select: {
        id: true,
        discordId: true,
        command: true,
        subcommand: true,
        executedAt: true,
      },
    });

    // Get recent dice rolls
    const recentRolls = await prisma.diceRoll.findMany({
      where: { guildId },
      orderBy: { rolledAt: 'desc' },
      take,
      select: {
        id: true,
        discordId: true,
        notation: true,
        total: true,
        isCrit: true,
        isFumble: true,
        rolledAt: true,
      },
    });

    // Combine and sort by timestamp
    type ActivityItem = {
      type: 'command' | 'roll';
      timestamp: Date;
      discordId: string;
      data: Record<string, unknown>;
    };

    const activities: ActivityItem[] = [
      ...recentCommands.map(c => ({
        type: 'command' as const,
        timestamp: c.executedAt,
        discordId: c.discordId,
        data: { command: c.command, subcommand: c.subcommand },
      })),
      ...recentRolls.map(r => ({
        type: 'roll' as const,
        timestamp: r.rolledAt,
        discordId: r.discordId,
        data: { notation: r.notation, total: r.total, isCrit: r.isCrit, isFumble: r.isFumble },
      })),
    ];

    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    res.json({
      activities: activities.slice(0, take),
      count: activities.length,
    });
  } catch (error) {
    console.error('[Admin] Error getting guild activity:', error);
    res.status(500).json({ error: 'Failed to get guild activity' });
  }
}
