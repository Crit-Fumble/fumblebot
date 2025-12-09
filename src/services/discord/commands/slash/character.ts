/**
 * Character Commands (Discord Integration)
 * Discord-specific wrapper for character management
 */

import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type AutocompleteInteraction,
} from 'discord.js';
import type { FumbleBotClient } from '../../client.js';
import { character } from '../../../../commands/character.js';
import type { CommandContext } from '../../../../commands/types.js';

// Define slash commands (Discord-specific registration format)
export const characterCommands = [
  character.data as SlashCommandBuilder,
];

/**
 * Discord command handler - delegates to unified character command
 */
export async function characterHandler(
  interaction: ChatInputCommandInteraction | AutocompleteInteraction,
  _bot: FumbleBotClient
): Promise<void> {
  // Handle autocomplete
  if (interaction.isAutocomplete()) {
    if (character.autocomplete) {
      await character.autocomplete(interaction);
    }
    return;
  }

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
    const result = await character.execute(context);

    // Send response
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(result);
    } else {
      await interaction.reply(result);
    }
  } catch (error: any) {
    console.error('[Character Handler] Error:', error);

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
