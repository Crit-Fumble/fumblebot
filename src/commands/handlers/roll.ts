/**
 * Roll Command Handler
 * Platform-agnostic dice rolling logic
 */

import type {
  CommandContext,
  CommandResult,
  CommandDefinition,
  DiceRollResult,
  EmbedData,
} from '../types.js';

/**
 * Parse and roll dice notation (e.g., "2d6+3", "1d20", "4d6")
 */
export function rollDice(notation: string): DiceRollResult {
  // Parse notation: NdS+M or NdS-M
  const match = notation.toLowerCase().match(/^(\d+)?d(\d+)([+-]\d+)?$/i);

  if (!match) {
    throw new Error(`Invalid dice notation: ${notation}`);
  }

  const count = parseInt(match[1] || '1', 10);
  const sides = parseInt(match[2], 10);
  const modifier = parseInt(match[3] || '0', 10);

  if (count < 1 || count > 100) {
    throw new Error('Dice count must be between 1 and 100');
  }

  if (sides < 2 || sides > 1000) {
    throw new Error('Dice sides must be between 2 and 1000');
  }

  // Roll the dice
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1);
  }

  const total = rolls.reduce((sum, roll) => sum + roll, 0) + modifier;

  // Check for crit/fumble on d20
  const isCrit = sides === 20 && count === 1 && rolls[0] === 20;
  const isFumble = sides === 20 && count === 1 && rolls[0] === 1;

  return {
    notation,
    rolls,
    modifier,
    total,
    isCrit,
    isFumble,
  };
}

/**
 * Create embed for dice roll result
 */
export function createRollEmbed(roll: DiceRollResult, username: string): EmbedData {
  let color = 0x7c3aed; // Purple default

  if (roll.isCrit) {
    color = 0x22c55e; // Green for crit
  } else if (roll.isFumble) {
    color = 0xef4444; // Red for fumble
  }

  let description = `**${username}** rolled **${roll.notation}**`;
  if (roll.label) {
    description += ` for *${roll.label}*`;
  }

  return {
    title: roll.isCrit ? '🎉 CRITICAL HIT!' : roll.isFumble ? '💀 FUMBLE!' : '🎲 Dice Roll',
    description,
    color,
    fields: [
      {
        name: 'Rolls',
        value: `[${roll.rolls.join(', ')}]`,
        inline: true,
      },
      {
        name: 'Modifier',
        value: roll.modifier >= 0 ? `+${roll.modifier}` : `${roll.modifier}`,
        inline: true,
      },
      {
        name: 'Total',
        value: `**${roll.total}**`,
        inline: true,
      },
    ],
    footer: { text: 'Powered by FumbleBot' },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Roll command handler
 */
export async function handleRoll(
  context: CommandContext,
  options: Record<string, unknown>
): Promise<CommandResult> {
  const notation = options.dice as string;
  const label = options.label as string | undefined;
  const isPrivate = options.private as boolean | undefined;

  if (!notation) {
    return {
      success: false,
      message: 'Dice notation is required (e.g., 2d6+3, 1d20)',
      ephemeral: true,
    };
  }

  try {
    const roll = rollDice(notation);
    roll.label = label;

    const embed = createRollEmbed(roll, context.username);

    return {
      success: true,
      embed,
      data: {
        roll,
      },
      ephemeral: isPrivate,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to roll dice';
    return {
      success: false,
      message: `❌ ${errorMessage}`,
      ephemeral: true,
    };
  }
}

/**
 * Roll command definition
 */
export const rollCommandDefinition: CommandDefinition = {
  name: 'roll',
  description: 'Roll dice using standard notation (e.g., 2d6+3, 1d20, 4d6)',
  options: [
    {
      name: 'dice',
      description: 'Dice notation (e.g., 2d6+3, 1d20, 4d6)',
      type: 'string',
      required: true,
    },
    {
      name: 'label',
      description: 'Optional label for the roll',
      type: 'string',
      required: false,
    },
    {
      name: 'private',
      description: 'Only show the result to you',
      type: 'boolean',
      required: false,
    },
  ],
  requiresAuth: false,
  requiresGuild: false,
};
