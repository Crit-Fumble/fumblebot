/**
 * Prompt Partials Controller
 * CRUD API endpoints for managing channel/category/role-specific AI prompts
 */

import type { Request, Response } from 'express';
import { z } from 'zod';
import { getPrisma } from '../services/db.js';

/**
 * Valid target types for prompt partials
 */
const PromptTargetType = z.enum(['channel', 'category', 'thread', 'role']);
type PromptTargetType = z.infer<typeof PromptTargetType>;

/**
 * Input validation schemas
 */
const CreatePromptPartialSchema = z.object({
  targetType: PromptTargetType,
  targetId: z.string().min(1, 'Target ID is required'),
  targetName: z.string().optional(),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  content: z.string().min(1, 'Content is required').max(10000, 'Content too long'),
  priority: z.number().int().min(0).max(100).optional().default(0),
  isEnabled: z.boolean().optional().default(true),
});

const UpdatePromptPartialSchema = z.object({
  targetName: z.string().optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  content: z.string().min(1).max(10000).optional(),
  priority: z.number().int().min(0).max(100).optional(),
  isEnabled: z.boolean().optional(),
});

/**
 * GET /api/admin/guilds/:guildId/prompts
 * List all prompt partials for a guild
 */
export async function handleListPromptPartials(req: Request, res: Response): Promise<void> {
  try {
    const { guildId } = req.params;
    const { targetType, enabled } = req.query;

    const prisma = getPrisma();

    // Build filter
    const where: {
      guildId: string;
      targetType?: PromptTargetType;
      isEnabled?: boolean;
    } = { guildId };

    if (targetType && PromptTargetType.safeParse(targetType).success) {
      where.targetType = targetType as PromptTargetType;
    }

    if (enabled !== undefined) {
      where.isEnabled = enabled === 'true';
    }

    const prompts = await prisma.promptPartial.findMany({
      where,
      orderBy: [
        { targetType: 'asc' },
        { priority: 'desc' },
        { name: 'asc' },
      ],
    });

    res.json({
      prompts,
      count: prompts.length,
    });
  } catch (error) {
    console.error('[Prompts] Error listing prompt partials:', error);
    res.status(500).json({ error: 'Failed to list prompt partials' });
  }
}

/**
 * GET /api/admin/guilds/:guildId/prompts/:id
 * Get a specific prompt partial
 */
export async function handleGetPromptPartial(req: Request, res: Response): Promise<void> {
  try {
    const { guildId, id } = req.params;

    const prisma = getPrisma();
    const prompt = await prisma.promptPartial.findFirst({
      where: { id, guildId },
    });

    if (!prompt) {
      res.status(404).json({ error: 'Prompt partial not found' });
      return;
    }

    res.json(prompt);
  } catch (error) {
    console.error('[Prompts] Error getting prompt partial:', error);
    res.status(500).json({ error: 'Failed to get prompt partial' });
  }
}

/**
 * POST /api/admin/guilds/:guildId/prompts
 * Create a new prompt partial
 */
export async function handleCreatePromptPartial(req: Request, res: Response): Promise<void> {
  try {
    const { guildId } = req.params;

    // Get user from session
    const user = req.session?.user;
    if (!user?.discordId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Validate request body
    const parseResult = CreatePromptPartialSchema.safeParse(req.body);
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

    // Check for duplicate name on same target
    const existing = await prisma.promptPartial.findFirst({
      where: {
        guildId,
        targetType: data.targetType,
        targetId: data.targetId,
        name: data.name,
      },
    });

    if (existing) {
      res.status(409).json({
        error: 'A prompt with this name already exists for this target',
      });
      return;
    }

    const prompt = await prisma.promptPartial.create({
      data: {
        guildId,
        targetType: data.targetType,
        targetId: data.targetId,
        targetName: data.targetName,
        name: data.name,
        description: data.description,
        content: data.content,
        priority: data.priority,
        isEnabled: data.isEnabled,
        createdBy: user.discordId,
      },
    });

    res.status(201).json(prompt);
  } catch (error) {
    console.error('[Prompts] Error creating prompt partial:', error);
    res.status(500).json({ error: 'Failed to create prompt partial' });
  }
}

/**
 * PATCH /api/admin/guilds/:guildId/prompts/:id
 * Update a prompt partial
 */
export async function handleUpdatePromptPartial(req: Request, res: Response): Promise<void> {
  try {
    const { guildId, id } = req.params;

    // Validate request body
    const parseResult = UpdatePromptPartialSchema.safeParse(req.body);
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
    const existing = await prisma.promptPartial.findFirst({
      where: { id, guildId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Prompt partial not found' });
      return;
    }

    // If renaming, check for conflict
    if (data.name && data.name !== existing.name) {
      const conflict = await prisma.promptPartial.findFirst({
        where: {
          guildId,
          targetType: existing.targetType,
          targetId: existing.targetId,
          name: data.name,
          NOT: { id },
        },
      });

      if (conflict) {
        res.status(409).json({
          error: 'A prompt with this name already exists for this target',
        });
        return;
      }
    }

    const prompt = await prisma.promptPartial.update({
      where: { id },
      data: {
        ...(data.targetName !== undefined && { targetName: data.targetName }),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.isEnabled !== undefined && { isEnabled: data.isEnabled }),
      },
    });

    res.json(prompt);
  } catch (error) {
    console.error('[Prompts] Error updating prompt partial:', error);
    res.status(500).json({ error: 'Failed to update prompt partial' });
  }
}

/**
 * DELETE /api/admin/guilds/:guildId/prompts/:id
 * Delete a prompt partial
 */
export async function handleDeletePromptPartial(req: Request, res: Response): Promise<void> {
  try {
    const { guildId, id } = req.params;

    const prisma = getPrisma();

    // Check if exists
    const existing = await prisma.promptPartial.findFirst({
      where: { id, guildId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Prompt partial not found' });
      return;
    }

    await prisma.promptPartial.delete({
      where: { id },
    });

    res.json({ deleted: true, id });
  } catch (error) {
    console.error('[Prompts] Error deleting prompt partial:', error);
    res.status(500).json({ error: 'Failed to delete prompt partial' });
  }
}

/**
 * GET /api/admin/guilds/:guildId/prompts/for-context
 * Get all applicable prompt partials for a specific context
 * Used internally to build the AI prompt for a given channel/user
 */
export async function handleGetPromptsForContext(req: Request, res: Response): Promise<void> {
  try {
    const { guildId } = req.params;
    const { channelId, categoryId, threadId, roleIds } = req.query;

    const prisma = getPrisma();

    // Build OR conditions for all applicable targets
    const targetConditions: Array<{ targetType: PromptTargetType; targetId: string }> = [];

    if (channelId) {
      targetConditions.push({ targetType: 'channel', targetId: channelId as string });
    }
    if (categoryId) {
      targetConditions.push({ targetType: 'category', targetId: categoryId as string });
    }
    if (threadId) {
      targetConditions.push({ targetType: 'thread', targetId: threadId as string });
    }
    if (roleIds) {
      const roles = (roleIds as string).split(',');
      for (const roleId of roles) {
        targetConditions.push({ targetType: 'role', targetId: roleId.trim() });
      }
    }

    if (targetConditions.length === 0) {
      res.json({ prompts: [], combinedContent: '' });
      return;
    }

    const prompts = await prisma.promptPartial.findMany({
      where: {
        guildId,
        isEnabled: true,
        OR: targetConditions,
      },
      orderBy: { priority: 'desc' },
    });

    // Combine prompts by priority (higher priority first)
    const combinedContent = prompts
      .map(p => `[${p.targetType}:${p.name}]\n${p.content}`)
      .join('\n\n');

    res.json({
      prompts,
      combinedContent,
    });
  } catch (error) {
    console.error('[Prompts] Error getting prompts for context:', error);
    res.status(500).json({ error: 'Failed to get prompts for context' });
  }
}
