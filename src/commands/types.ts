/**
 * Cross-Platform Command Types
 * Shared interfaces for commands that work on both Discord and Web
 */

/**
 * Platform the command is being executed from
 */
export type Platform = 'discord' | 'web';

/**
 * Context for command execution
 * Contains user info and optional guild/channel context
 */
export interface CommandContext {
  /** Discord user ID */
  userId: string;

  /** Display name or username */
  username: string;

  /** Discord guild ID (optional for web) */
  guildId?: string;

  /** Discord channel ID (optional for web) */
  channelId?: string;

  /** Platform the command originated from */
  platform: Platform;

  /** Activity session ID for tracking */
  sessionId?: string;
}

/**
 * Embed field for rich responses
 */
export interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

/**
 * Discord-style embed data
 * Can be rendered as Discord embed or styled HTML on web
 */
export interface EmbedData {
  title?: string;
  description?: string;
  color?: number;
  fields?: EmbedField[];
  footer?: { text: string };
  timestamp?: string;
  thumbnail?: { url: string };
  image?: { url: string };
}

/**
 * Result from command execution
 */
export interface CommandResult {
  /** Whether the command succeeded */
  success: boolean;

  /** Simple text message (for errors or simple responses) */
  message?: string;

  /** Rich embed for display */
  embed?: EmbedData;

  /** Raw data for programmatic use */
  data?: Record<string, unknown>;

  /** Whether response should be ephemeral (private) */
  ephemeral?: boolean;
}

/**
 * Command option definition
 */
export interface CommandOption {
  name: string;
  description: string;
  type: 'string' | 'integer' | 'boolean' | 'number';
  required?: boolean;
  choices?: Array<{ name: string; value: string | number }>;
}

/**
 * Command definition
 */
export interface CommandDefinition {
  /** Command name (e.g., 'roll') */
  name: string;

  /** Description for help text */
  description: string;

  /** Command options/arguments */
  options?: CommandOption[];

  /** Subcommands (for grouped commands) */
  subcommands?: CommandDefinition[];

  /** Whether command requires guild context */
  requiresGuild?: boolean;

  /** Whether command requires authentication */
  requiresAuth?: boolean;
}

/**
 * Command handler function type
 */
export type CommandHandler = (
  context: CommandContext,
  options: Record<string, unknown>
) => Promise<CommandResult>;

/**
 * Dice roll result
 */
export interface DiceRollResult {
  /** Original notation (e.g., "2d6+3") */
  notation: string;

  /** Individual die results */
  rolls: number[];

  /** Modifier applied */
  modifier: number;

  /** Final total */
  total: number;

  /** Natural 20 on d20 */
  isCrit: boolean;

  /** Natural 1 on d20 */
  isFumble: boolean;

  /** Optional label */
  label?: string;
}
