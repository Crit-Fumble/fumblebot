/**
 * Command Controllers
 * HTTP handlers for cross-platform command execution
 */

import type { Request, Response } from 'express';
import {
  commandExecutor,
  getAllCommandDefinitions,
  type CommandContext,
} from '../commands/index.js';

/**
 * Session data type (from Express session)
 */
interface SessionUser {
  id: string;
  discordId: string;
  username: string;
  avatar: string | null;
  globalName: string | null;
}

/**
 * Extended Request with session
 */
interface AuthenticatedRequest extends Request {
  session: Request['session'] & {
    user?: SessionUser;
  };
}

/**
 * Execute a command via HTTP API
 * POST /api/commands/:command
 */
export async function handleExecuteCommand(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const { command } = req.params;
  const user = authReq.session?.user;

  // Check authentication
  if (!user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
    return;
  }

  // Build command context from session
  const context: CommandContext = {
    userId: user.discordId,
    username: user.globalName || user.username,
    guildId: req.body.guildId,
    channelId: req.body.channelId,
    platform: 'web',
  };

  // Extract command options from request body
  const options = req.body.options || req.body;
  // Remove metadata fields from options
  delete options.guildId;
  delete options.channelId;
  delete options.options;

  // Execute command
  const result = await commandExecutor.execute(command, context, options);

  // Return result
  res.json({
    success: result.success,
    message: result.message,
    embed: result.embed,
    data: result.data,
  });
}

/**
 * List all available commands
 * GET /api/commands
 */
export async function handleListCommands(_req: Request, res: Response): Promise<void> {
  const commands = getAllCommandDefinitions();

  res.json({
    commands: commands.map((cmd) => ({
      name: cmd.name,
      description: cmd.description,
      options: cmd.options,
      subcommands: cmd.subcommands?.map((sub) => ({
        name: sub.name,
        description: sub.description,
        options: sub.options,
      })),
      requiresGuild: cmd.requiresGuild,
      requiresAuth: cmd.requiresAuth,
    })),
  });
}

/**
 * Execute command from string input
 * POST /api/commands
 */
export async function handleExecuteCommandString(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.session?.user;
  const { input, guildId, channelId } = req.body;

  // Check authentication
  if (!user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
    return;
  }

  if (!input || typeof input !== 'string') {
    res.status(400).json({
      success: false,
      error: 'Command input is required',
    });
    return;
  }

  // Build command context
  const context: CommandContext = {
    userId: user.discordId,
    username: user.globalName || user.username,
    guildId,
    channelId,
    platform: 'web',
  };

  // Execute from string (e.g., "/roll 2d6+3")
  const result = await commandExecutor.executeString(input, context);

  res.json({
    success: result.success,
    message: result.message,
    embed: result.embed,
    data: result.data,
  });
}
