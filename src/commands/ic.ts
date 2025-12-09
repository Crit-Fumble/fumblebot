/**
 * In-Character (IC) Commands
 * /ic say, /ic do, /ic move
 * Allows users to speak and act as their active character
 */

import type { ChatInputCommandInteraction, TextChannel, ThreadChannel } from 'discord.js';
import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import characterService from '../services/character/character-service.js';
import webhookService from '../services/discord/webhook-service.js';
import { rollDice } from '../../packages/core-fumblebot/src/dice/index.js';
import type { Command, CommandContext, CommandResult } from './types.js';

export const ic: Command = {
  name: 'ic',
  description: 'In-character roleplay commands',

  data: new SlashCommandBuilder()
    .setName('ic')
    .setDescription('In-character roleplay commands')
    .addSubcommand(sub =>
      sub
        .setName('say')
        .setDescription('Speak as your character')
        .addStringOption(opt =>
          opt
            .setName('message')
            .setDescription('What your character says')
            .setRequired(true)
            .setMaxLength(2000)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('do')
        .setDescription('Perform an action as your character')
        .addStringOption(opt =>
          opt
            .setName('action')
            .setDescription('What your character does')
            .setRequired(true)
            .setMaxLength(1500)
        )
        .addStringOption(opt =>
          opt
            .setName('roll')
            .setDescription('Optional dice roll (e.g., 1d20+5)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('move')
        .setDescription('Show movement controls for your character')
    ),

  async execute(context: CommandContext): Promise<CommandResult> {
    const interaction = context.interaction as ChatInputCommandInteraction;
    const subcommand = interaction.options.getSubcommand();

    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const channelId = interaction.channelId;
    const channel = interaction.channel;
    const threadId = channel?.isThread() ? channel.id : undefined;

    if (!guildId || !channel) {
      return {
        content: 'This command can only be used in a server channel.',
        ephemeral: true,
      };
    }

    // Get active character
    const character = await characterService.getActive(userId, guildId, channelId, threadId);

    if (!character) {
      return {
        content:
          'You do not have an active character in this channel. Use `/character select` first.',
        ephemeral: true,
      };
    }

    // Check if webhooks are supported
    if (!webhookService.canUseWebhooks(channel as TextChannel | ThreadChannel)) {
      return {
        content: 'In-character commands are not supported in this type of channel.',
        ephemeral: true,
      };
    }

    try {
      switch (subcommand) {
        case 'say':
          return await handleSay(interaction, channel as TextChannel | ThreadChannel, character);

        case 'do':
          return await handleDo(interaction, channel as TextChannel | ThreadChannel, character);

        case 'move':
          return await handleMove(interaction, character);

        default:
          return {
            content: 'Unknown subcommand.',
            ephemeral: true,
          };
      }
    } catch (error: any) {
      console.error('[IC Command] Error:', error);
      return {
        content: `Error: ${error.message || 'An unexpected error occurred'}`,
        ephemeral: true,
      };
    }
  },
};

/**
 * Handle /ic say
 */
async function handleSay(
  interaction: ChatInputCommandInteraction,
  channel: TextChannel | ThreadChannel,
  character: any
): Promise<CommandResult> {
  const message = interaction.options.getString('message', true);

  // Send message as character via webhook
  await webhookService.sendAsCharacter(channel, character, message);

  // Acknowledge with ephemeral message
  return {
    content: `✅ Speaking as **${character.name}**`,
    ephemeral: true,
  };
}

/**
 * Handle /ic do
 */
async function handleDo(
  interaction: ChatInputCommandInteraction,
  channel: TextChannel | ThreadChannel,
  character: any
): Promise<CommandResult> {
  const action = interaction.options.getString('action', true);
  const diceNotation = interaction.options.getString('roll');

  let message = `*${action}*`;

  // Add dice roll if specified
  if (diceNotation) {
    try {
      const rollResult = rollDice(diceNotation);
      const rollText = rollResult.rolls.length > 1
        ? `[${rollResult.rolls.join(', ')}]`
        : rollResult.rolls[0];

      message += `\n🎲 Rolls **${diceNotation}**: ${rollText} = **${rollResult.total}**`;

      if (rollResult.isCrit) {
        message += ' 🎉 *Critical!*';
      } else if (rollResult.isFumble) {
        message += ' 💀 *Fumble!*';
      }
    } catch (rollError: any) {
      return {
        content: `Invalid dice notation: ${rollError.message}`,
        ephemeral: true,
      };
    }
  }

  // Send action as character via webhook
  await webhookService.sendAsCharacter(channel, character, message);

  // Acknowledge with ephemeral message
  return {
    content: `✅ ${character.name} performs the action`,
    ephemeral: true,
  };
}

/**
 * Handle /ic move
 */
async function handleMove(
  interaction: ChatInputCommandInteraction,
  character: any
): Promise<CommandResult> {
  // Create directional movement buttons
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ic_move:${character.id}:nw`)
      .setLabel('↖️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`ic_move:${character.id}:n`)
      .setLabel('⬆️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`ic_move:${character.id}:ne`)
      .setLabel('↗️')
      .setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ic_move:${character.id}:w`)
      .setLabel('⬅️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`ic_move:${character.id}:stop`)
      .setLabel('🛑')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`ic_move:${character.id}:e`)
      .setLabel('➡️')
      .setStyle(ButtonStyle.Secondary)
  );

  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ic_move:${character.id}:sw`)
      .setLabel('↙️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`ic_move:${character.id}:s`)
      .setLabel('⬇️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`ic_move:${character.id}:se`)
      .setLabel('↘️')
      .setStyle(ButtonStyle.Secondary)
  );

  return {
    content: `🎭 **${character.name}** Movement Controls`,
    components: [row1, row2, row3],
    ephemeral: false, // Show publicly so others can see character movement
  };
}
