/**
 * In-Character Commands (Discord Integration)
 * Discord-specific wrapper for IC roleplay commands
 */

import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { FumbleBotClient } from '../../client.js';
import { ic } from '../../../../commands/ic.js';
import type { CommandContext } from '../../../../commands/types.js';

// Define slash commands (Discord-specific registration format)
export const icCommands = [
  ic.data as SlashCommandBuilder,
];

/**
 * Discord command handler - delegates to unified IC command
 */
export async function icHandler(
  interaction: ChatInputCommandInteraction,
  _bot: FumbleBotClient
): Promise<void> {
  // Build context from Discord interaction
  const context: CommandContext = {
    interaction,
    userId: interaction.user.id,
    username: interaction.user.displayName || interaction.user.username,
    guildId: interaction.guildId ?? undefined,
    channelId: interaction.channelId,
    platform: 'discord',
  };

  try {
    // Execute command
    const result = await ic.execute(context);

    // Send response
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(result);
    } else {
      await interaction.reply(result);
    }
  } catch (error: any) {
    console.error('[IC Handler] Error:', error);

    const errorMessage = {
      content: `Error: ${error.message || 'An unexpected error occurred'}`,
      ephemeral: true,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
}
