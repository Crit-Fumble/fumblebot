/**
 * Dice Commands (Discord Integration)
 * Discord-specific wrapper for cross-platform dice rolling
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js'
import type { FumbleBotClient } from '../../client.js'
import { commandExecutor, type CommandContext, type EmbedData } from '../../../../commands/index.js'

/**
 * Convert cross-platform EmbedData to Discord.js EmbedBuilder
 */
function embedDataToDiscord(embed: EmbedData): EmbedBuilder {
  const builder = new EmbedBuilder()

  if (embed.title) builder.setTitle(embed.title)
  if (embed.description) builder.setDescription(embed.description)
  if (embed.color) builder.setColor(embed.color)
  if (embed.fields) builder.addFields(embed.fields)
  if (embed.footer) builder.setFooter(embed.footer)
  if (embed.timestamp) builder.setTimestamp(new Date(embed.timestamp))
  if (embed.thumbnail) builder.setThumbnail(embed.thumbnail.url)
  if (embed.image) builder.setImage(embed.image.url)

  return builder
}

// Define slash commands (Discord-specific registration format)
export const diceCommands = [
  new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Roll dice using standard notation (e.g., 2d6+3, 1d20, 4d6)')
    .addStringOption((option) =>
      option
        .setName('dice')
        .setDescription('Dice notation (e.g., 2d6+3, 1d20, 4d6)')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('label')
        .setDescription('Optional label for the roll')
        .setRequired(false)
    )
    .addBooleanOption((option) =>
      option
        .setName('private')
        .setDescription('Only show the result to you')
        .setRequired(false)
    ),
]

/**
 * Discord command handler - delegates to cross-platform executor
 */
export async function diceHandler(
  interaction: ChatInputCommandInteraction,
  _bot: FumbleBotClient
): Promise<void> {
  // Build cross-platform context from Discord interaction
  const context: CommandContext = {
    userId: interaction.user.id,
    username: interaction.user.displayName || interaction.user.username,
    guildId: interaction.guildId ?? undefined,
    channelId: interaction.channelId,
    platform: 'discord',
  }

  // Extract options from interaction
  const options = {
    dice: interaction.options.getString('dice', true),
    label: interaction.options.getString('label') ?? undefined,
    private: interaction.options.getBoolean('private') ?? false,
  }

  // Execute through cross-platform command system
  const result = await commandExecutor.execute('roll', context, options)

  // Convert result to Discord response
  if (result.success && result.embed) {
    const discordEmbed = embedDataToDiscord(result.embed)
    await interaction.reply({
      embeds: [discordEmbed],
      ephemeral: result.ephemeral ?? false,
    })
  } else {
    await interaction.reply({
      content: result.message || 'Command executed',
      ephemeral: result.ephemeral ?? true,
    })
  }
}
