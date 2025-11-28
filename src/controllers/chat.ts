/**
 * Chat Controller
 * Handles chat messages from the website (cross-platform chat with FumbleBot)
 */

import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { commandExecutor, type CommandContext } from '../commands/index.js';

/**
 * Input validation schemas
 */
const ChatRequestSchema = z.object({
  message: z.string()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message cannot exceed 2000 characters'),
  sessionId: z.string().max(100).optional(),
  user: z.object({
    discordId: z.string().max(50),
    name: z.string().max(100),
  }).optional(),
});

type ChatRequest = z.infer<typeof ChatRequestSchema>;

/**
 * Extended request with Discord user ID from header
 */
interface AuthenticatedChatRequest extends Request {
  discordUserId?: string;
}

/**
 * Middleware to validate bot secret authentication
 * Checks X-Bot-Secret header matches FUMBLEBOT_API_SECRET
 */
export function validateBotSecret(req: Request, res: Response, next: NextFunction): void {
  const botSecret = req.headers['x-bot-secret'];
  const expectedSecret = process.env.FUMBLEBOT_API_SECRET;

  if (!expectedSecret) {
    console.warn('[Chat] FUMBLEBOT_API_SECRET not configured');
    res.status(500).json({ error: 'Server not configured for cross-site requests' });
    return;
  }

  if (botSecret !== expectedSecret) {
    console.warn('[Chat] Invalid bot secret from', req.ip);
    res.status(401).json({ error: 'Invalid bot secret' });
    return;
  }

  // Extract Discord user ID from header
  const discordUserId = req.headers['x-discord-user-id'];
  if (!discordUserId || typeof discordUserId !== 'string') {
    res.status(401).json({ error: 'Missing Discord user ID' });
    return;
  }

  (req as AuthenticatedChatRequest).discordUserId = discordUserId;
  next();
}

/**
 * Handle chat message from website
 * POST /api/chat
 */
export async function handleChat(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedChatRequest;
  const discordUserId = authReq.discordUserId;

  if (!discordUserId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  // Validate request body
  const parseResult = ChatRequestSchema.safeParse(req.body);
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

  const { message, sessionId, user } = parseResult.data;

  try {
    // Check if this is a command (starts with /)
    if (message.startsWith('/')) {
      const context: CommandContext = {
        userId: discordUserId,
        username: user?.name || 'Web User',
        platform: 'web',
        sessionId,
      };

      const result = await commandExecutor.executeString(message, context);

      res.json({
        response: result.message || formatEmbedAsText(result.embed),
        sessionId: sessionId || generateSessionId(),
        type: 'command',
        data: result.data,
      });
      return;
    }

    // For non-command messages, this would integrate with AI chat
    // For now, return a helpful message
    res.json({
      response: `I received your message: "${message}". Chat functionality is coming soon! Try using commands like \`/roll 1d20\` for now.`,
      sessionId: sessionId || generateSessionId(),
      type: 'chat',
    });
  } catch (error) {
    console.error('[Chat] Error processing message:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
}

/**
 * Get chat history for a user
 * GET /api/chat/history
 */
export async function handleChatHistory(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedChatRequest;
  const discordUserId = authReq.discordUserId;
  const sessionId = req.query.sessionId as string | undefined;

  if (!discordUserId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  // TODO: Implement chat history storage
  // For now, return empty array
  res.json({
    messages: [],
    sessionId,
  });
}

/**
 * Format embed data as plain text (for non-Discord responses)
 */
function formatEmbedAsText(embed?: { title?: string; description?: string; fields?: Array<{ name: string; value: string }> }): string {
  if (!embed) return '';

  const parts: string[] = [];

  if (embed.title) {
    parts.push(`**${embed.title}**`);
  }

  if (embed.description) {
    parts.push(embed.description);
  }

  if (embed.fields && embed.fields.length > 0) {
    const fieldText = embed.fields.map(f => `${f.name}: ${f.value}`).join(' | ');
    parts.push(fieldText);
  }

  return parts.join('\n');
}

/**
 * Generate a simple session ID
 */
function generateSessionId(): string {
  return `web_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
