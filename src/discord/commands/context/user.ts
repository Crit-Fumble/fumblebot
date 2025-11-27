/**
 * User Context Menu Commands
 * Right-click menu options for users
 */

import {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type UserContextMenuCommandInteraction,
  type MessageContextMenuCommandInteraction,
} from 'discord.js'
import type { FumbleBotClient } from '../../client.js'
import { APIClient } from '../../../api/client.js'

// Define context menu commands
export const userContextMenus = [
  new ContextMenuCommandBuilder()
    .setName('View Profile')
    .setType(ApplicationCommandType.User),

  new ContextMenuCommandBuilder()
    .setName('Gaming Stats')
    .setType(ApplicationCommandType.User),

  new ContextMenuCommandBuilder()
    .setName('Invite to Session')
    .setType(ApplicationCommandType.User),
]

// Context menu handler
export async function userContextHandler(
  interaction: UserContextMenuCommandInteraction | MessageContextMenuCommandInteraction,
  _bot: FumbleBotClient
): Promise<void> {
  // This handler only processes user context menus
  if (!interaction.isUserContextMenuCommand()) return

  const commandName = interaction.commandName
  const targetUser = interaction.targetUser

  try {
    const apiClient = APIClient.getInstance()

    if (commandName === 'View Profile') {
      await interaction.deferReply({ ephemeral: true })

      const userStatus = await apiClient.getUserStatus(targetUser.id)

      if (!userStatus.isLinked || !userStatus.user) {
        const embed = new EmbedBuilder()
          .setColor(0x6b7280)
          .setTitle('Profile Not Found')
          .setDescription(`${targetUser.username} hasn't linked their Discord account to Crit-Fumble.`)
          .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))

        await interaction.editReply({ embeds: [embed] })
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
    } else if (commandName === 'Gaming Stats') {
      await interaction.deferReply({ ephemeral: true })

      const userStatus = await apiClient.getUserStatus(targetUser.id)

      if (!userStatus.isLinked) {
        await interaction.editReply({
          content: `❌ ${targetUser.username} hasn't linked their account to Crit-Fumble.`,
        })
        return
      }

      // TODO: Fetch actual stats from API
      const embed = new EmbedBuilder()
        .setColor(0x7c3aed)
        .setTitle(`📊 ${targetUser.displayName}'s Stats`)
        .setThumbnail(targetUser.displayAvatarURL({ size: 128 }))
        .addFields(
          { name: '🎲 Total Rolls', value: '0', inline: true },
          { name: '✨ Critical Hits', value: '0', inline: true },
          { name: '💀 Fumbles', value: '0', inline: true },
          { name: '🎮 Games Played', value: '0', inline: true },
          { name: '⏱️ Time Played', value: '0h', inline: true },
          { name: '🏆 Achievements', value: '0', inline: true }
        )
        .setTimestamp()

      await interaction.editReply({ embeds: [embed] })
    } else if (commandName === 'Invite to Session') {
      // TODO: Get current active session
      const embed = new EmbedBuilder()
        .setColor(0x7c3aed)
        .setTitle('Invite to Session')
        .setDescription(
          `Invite **${targetUser.displayName}** to your current session?\n\n` +
            'They will receive a DM with the session invite link.'
        )

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`invite_to_session_${targetUser.id}`)
          .setLabel('Send Invite')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📨'),
        new ButtonBuilder()
          .setCustomId('cancel_invite')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      )

      await interaction.reply({ embeds: [embed], components: [row], ephemeral: true })
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
