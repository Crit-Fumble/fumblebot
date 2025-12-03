/**
 * @crit-fumble/core-fumblebot
 * FumbleBot SDK for Core server integration
 *
 * This package provides types and a client for Core server to communicate
 * with FumbleBot's API. FumbleBot acts as an AI-powered assistant GM,
 * handling dice rolls, AI chat, VTT integrations, and Discord Activities.
 *
 * @example
 * ```typescript
 * import { createFumbleBotClient } from '@crit-fumble/core-fumblebot';
 * import type { DiceRollResult, AIChatRequest } from '@crit-fumble/core-fumblebot';
 *
 * const client = createFumbleBotClient({
 *   baseUrl: 'https://fumblebot.crit-fumble.com/api',
 *   apiKey: process.env.FUMBLEBOT_API_KEY,
 * });
 *
 * // Roll dice
 * const roll = await client.roll({ notation: '2d20kh1+5' });
 *
 * // Chat with AI assistant
 * const response = await client.chat({
 *   messages: [{ role: 'user', content: 'What is a tarrasque?' }],
 * });
 * ```
 *
 * @packageDocumentation
 */

// Re-export all types
export * from './types/index.js';

// Re-export client
export {
  FumbleBotClient,
  FumbleBotError,
  createFumbleBotClient,
  type FumbleBotClientConfig,
  type RequestOptions,
} from './client/index.js';

// Re-export dice roller
export {
  DiceRoller,
  createDiceRoller,
  rollDice,
  parseDice,
  formatRollResult,
  isValidDiceNotation,
  type GameSystem,
  type DiceRollOptions,
  type ParsedDice,
  type ExtendedRollResult,
} from './dice/index.js';

// Re-export adventure terminal CLI
export {
  TerminalCLI,
  createTerminalCLI,
  runTerminalREPL,
  type TerminalCLIConfig,
} from './cli/index.js';
