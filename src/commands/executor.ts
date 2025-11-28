/**
 * Command Executor
 * Platform-agnostic command execution engine
 */

import type {
  CommandContext,
  CommandResult,
  CommandHandler,
  CommandDefinition,
} from './types.js';
import { handleRoll, rollCommandDefinition } from './handlers/index.js';

/**
 * Command registry - maps command names to handlers and definitions
 */
const commandHandlers: Map<string, CommandHandler> = new Map();
const commandDefinitions: Map<string, CommandDefinition> = new Map();

/**
 * Register a command handler
 */
export function registerCommand(
  definition: CommandDefinition,
  handler: CommandHandler
): void {
  commandHandlers.set(definition.name, handler);
  commandDefinitions.set(definition.name, definition);
}

/**
 * Initialize built-in commands
 */
function initializeCommands(): void {
  // Roll command
  registerCommand(rollCommandDefinition, handleRoll);

  // Future commands will be registered here:
  // registerCommand(characterCommandDefinition, handleCharacter);
  // registerCommand(sessionCommandDefinition, handleSession);
}

// Initialize on module load
initializeCommands();

/**
 * Execute a command by name
 */
export async function executeCommand(
  commandName: string,
  context: CommandContext,
  options: Record<string, unknown> = {}
): Promise<CommandResult> {
  const handler = commandHandlers.get(commandName);
  const definition = commandDefinitions.get(commandName);

  if (!handler || !definition) {
    return {
      success: false,
      message: `Unknown command: ${commandName}`,
      ephemeral: true,
    };
  }

  // Check if command requires guild context
  if (definition.requiresGuild && !context.guildId) {
    return {
      success: false,
      message: 'This command requires a server context. Please select a server first.',
      ephemeral: true,
    };
  }

  // Execute the handler
  try {
    return await handler(context, options);
  } catch (error) {
    console.error(`[CommandExecutor] Error executing ${commandName}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Command execution failed';
    return {
      success: false,
      message: `❌ ${errorMessage}`,
      ephemeral: true,
    };
  }
}

/**
 * Get a command definition by name
 */
export function getCommandDefinition(name: string): CommandDefinition | undefined {
  return commandDefinitions.get(name);
}

/**
 * Get all registered command definitions
 */
export function getAllCommandDefinitions(): CommandDefinition[] {
  return Array.from(commandDefinitions.values());
}

/**
 * Check if a command exists
 */
export function hasCommand(name: string): boolean {
  return commandHandlers.has(name);
}

/**
 * Parse a command string (e.g., "/roll 2d6+3 label:Attack")
 * Returns command name and options
 */
export function parseCommandString(input: string): {
  command: string;
  options: Record<string, unknown>;
} | null {
  // Remove leading slash if present
  const trimmed = input.trim();
  if (!trimmed) return null;

  const text = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
  const parts = text.split(/\s+/);

  if (parts.length === 0) return null;

  const command = parts[0].toLowerCase();
  const options: Record<string, unknown> = {};

  // Get command definition to understand options
  const definition = commandDefinitions.get(command);
  if (!definition) {
    return { command, options };
  }

  // Parse remaining parts
  const args = parts.slice(1);

  // Handle key:value pairs and positional arguments
  let positionalIndex = 0;
  const requiredOptions = definition.options?.filter((o) => o.required) || [];

  for (const arg of args) {
    if (arg.includes(':')) {
      // Named argument (e.g., label:Attack)
      const [key, ...valueParts] = arg.split(':');
      options[key] = valueParts.join(':');
    } else {
      // Positional argument - assign to first required option
      if (requiredOptions[positionalIndex]) {
        const opt = requiredOptions[positionalIndex];
        options[opt.name] = arg;
        positionalIndex++;
      }
    }
  }

  return { command, options };
}

/**
 * CommandExecutor class for object-oriented usage
 */
export class CommandExecutor {
  /**
   * Execute a command
   */
  async execute(
    commandName: string,
    context: CommandContext,
    options: Record<string, unknown> = {}
  ): Promise<CommandResult> {
    return executeCommand(commandName, context, options);
  }

  /**
   * Execute a command from a parsed string
   */
  async executeString(
    input: string,
    context: CommandContext
  ): Promise<CommandResult> {
    const parsed = parseCommandString(input);

    if (!parsed) {
      return {
        success: false,
        message: 'Invalid command format',
        ephemeral: true,
      };
    }

    return this.execute(parsed.command, context, parsed.options);
  }

  /**
   * Get all available commands
   */
  getCommands(): CommandDefinition[] {
    return getAllCommandDefinitions();
  }

  /**
   * Check if a command exists
   */
  hasCommand(name: string): boolean {
    return hasCommand(name);
  }
}

// Export singleton instance
export const commandExecutor = new CommandExecutor();
