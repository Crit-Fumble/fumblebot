/**
 * User Commands
 * Commands for user profile, linking accounts, etc.
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
} from 'discord.js'
import type { FumbleBotClient } from '../../client.js'
import { APIClient } from '../../../api/client.js'

// Define slash commands
export const userCommands = [
  new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View your Crit-Fumble profile')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('User to view profile of')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your Discord account to Crit-Fumble'),

  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View your gaming statistics'),

  new SlashCommandBuilder()
    .setName('whoami')
    .setDescription('Check your linked Crit-Fumble account status'),
]

// Command handler
export async function userHandler(
  interaction: ChatInputCommandInteraction,
  _bot: FumbleBotClient
): Promise<void> {
  const commandName = interaction.commandName

  try {
    const apiClient = APIClient.getInstance()

    if (commandName === 'profile') {
      const targetUser = interaction.options.getUser('user') || interaction.user

      await interaction.deferReply()

      const userStatus = await apiClient.getUserStatus(targetUser.id)

      if (!userStatus.isLinked || !userStatus.user) {
        const embed = new EmbedBuilder()
          .setColor(0x6b7280)
          .setTitle('Profile Not Found')
          .setDescription(
            targetUser.id === interaction.user.id
              ? 'You haven\'t linked your Discord account to Crit-Fumble yet.'
              : `${targetUser.username} hasn't linked their Discord account.`
          )
          .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel('Link Account')
            .setStyle(ButtonStyle.Link)
            .setURL('https://www.crit-fumble.com/account/link')
        )

        await interaction.editReply({
          embeds: [embed],
          components: targetUser.id === interaction.user.id ? [row] : [],
        })
        return
      }

      const user = userStatus.user

      const embed = new EmbedBuilder()
        .setColor(0x7c3aed)
        .setTitle(user.displayName)
        .setThumbnail(user.avatarUrl || targetUser.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: 'Username', value: `@${user.username}`, inline: true },
          { name: 'Tier', value: user.tier, inline: true },
          { name: 'Roles', value: user.roles.length > 0 ? user.roles.join(', ') : 'None', inline: true }
        )
        .setFooter({ text: `ID: ${user.id}` })
        .setTimestamp()

      if (user.isOwner) {
        embed.setAuthor({ name: '⭐ Server Owner' })
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel('View Full Profile')
          .setStyle(ButtonStyle.Link)
          .setURL(`https://www.crit-fumble.com/users/${user.username}`)
      )

      await interaction.editReply({ embeds: [embed], components: [row] })
    } else if (commandName === 'link') {
      const embed = new EmbedBuilder()
        .setColor(0x7c3aed)
        .setTitle('Link Your Account')
        .setDescription(
          'Connect your Discord account to Crit-Fumble to:\n\n' +
            '• Sync your profile and achievements\n' +
            '• Access premium features\n' +
            '• Join games and campaigns\n' +
            '• Track your dice statistics'
        )
        .setThumbnail(interaction.user.displayAvatarURL({ size: 128 }))

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel('Link Account')
          .setStyle(ButtonStyle.Link)
          .setURL('https://www.crit-fumble.com/account/link?source=discord'),
        new ButtonBuilder()
          .setLabel('Create Account')
          .setStyle(ButtonStyle.Link)
          .setURL('https://www.crit-fumble.com/signup?source=discord')
      )

      await interaction.reply({ embeds: [embed], components: [row], ephemeral: true })
    } else if (commandName === 'stats') {
      await interaction.deferReply()

      const userStatus = await apiClient.getUserStatus(interaction.user.id)

      if (!userStatus.isLinked) {
        await interaction.editReply({
          content: '❌ You need to link your Discord account first. Use `/link` to get started.',
        })
        return
      }

      // TODO: Fetch actual stats from API
      const embed = new EmbedBuilder()
        .setColor(0x7c3aed)
        .setTitle('📊 Your Gaming Statistics')
        .setThumbnail(interaction.user.displayAvatarURL({ size: 128 }))
        .addFields(
          { name: '🎲 Total Rolls', value: '0', inline: true },
          { name: '✨ Critical Hits', value: '0', inline: true },
          { name: '💀 Fumbles', value: '0', inline: true },
          { name: '🎮 Games Played', value: '0', inline: true },
          { name: '⏱️ Time Played', value: '0h', inline: true },
          { name: '🏆 Achievements', value: '0', inline: true }
        )
        .setFooter({ text: 'Statistics are tracked across all linked platforms' })
        .setTimestamp()

      await interaction.editReply({ embeds: [embed] })
    } else if (commandName === 'whoami') {
      await interaction.deferReply({ ephemeral: true })

      const userStatus = await apiClient.getUserStatus(interaction.user.id)

      if (!userStatus.isLinked || !userStatus.user) {
        const embed = new EmbedBuilder()
          .setColor(0xef4444)
          .setTitle('Not Linked')
          .setDescription('Your Discord account is not linked to a Crit-Fumble account.')
          .addFields(
            { name: 'Discord ID', value: interaction.user.id, inline: true },
            { name: 'Username', value: interaction.user.username, inline: true }
          )

        await interaction.editReply({ embeds: [embed] })
        return
      }

      const user = userStatus.user

      const embed = new EmbedBuilder()
        .setColor(0x22c55e)
        .setTitle('✅ Account Linked')
        .setDescription(`Your Discord is linked to **${user.displayName}**`)
        .setThumbnail(user.avatarUrl || interaction.user.displayAvatarURL({ size: 128 }))
        .addFields(
          { name: 'Crit-Fumble ID', value: user.id, inline: true },
          { name: 'Username', value: `@${user.username}`, inline: true },
          { name: 'Tier', value: user.tier, inline: true },
          { name: 'Discord ID', value: interaction.user.id, inline: true },
          { name: 'Owner', value: user.isOwner ? 'Yes ⭐' : 'No', inline: true }
        )

      await interaction.editReply({ embeds: [embed] })
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Command failed'
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: `❌ ${errorMessage}` })
    } else {
      await interaction.reply({ content: `❌ ${errorMessage}`, ephemeral: true })
    }
  }
}
