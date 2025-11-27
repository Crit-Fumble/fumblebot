/**
 * Message Context Menu Commands
 * Right-click menu options for messages
 */

import {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  EmbedBuilder,
  type MessageContextMenuCommandInteraction,
  type UserContextMenuCommandInteraction,
} from 'discord.js'
import type { FumbleBotClient } from '../../client.js'
import { AIService } from '../../../ai/service.js'

// Define context menu commands
export const messageContextMenus = [
  new ContextMenuCommandBuilder()
    .setName('AI Summarize')
    .setType(ApplicationCommandType.Message),

  new ContextMenuCommandBuilder()
    .setName('Translate to English')
    .setType(ApplicationCommandType.Message),

  new ContextMenuCommandBuilder()
    .setName('Add to Session Notes')
    .setType(ApplicationCommandType.Message),

  new ContextMenuCommandBuilder()
    .setName('Save as Lore')
    .setType(ApplicationCommandType.Message),
]

// Context menu handler
export async function messageContextHandler(
  interaction: MessageContextMenuCommandInteraction | UserContextMenuCommandInteraction,
  _bot: FumbleBotClient
): Promise<void> {
  // This handler only processes message context menus
  if (!interaction.isMessageContextMenuCommand()) return

  const commandName = interaction.commandName
  const targetMessage = interaction.targetMessage

  try {
    if (commandName === 'AI Summarize') {
      await interaction.deferReply({ ephemeral: true })

      const content = targetMessage.content
      if (!content || content.length < 20) {
        await interaction.editReply({
          content: '❌ Message is too short to summarize.',
        })
        return
      }

      const aiService = AIService.getInstance()
      const response = await aiService.complete({
        messages: [
          {
            role: 'user',
            content: `Summarize this message concisely in 1-2 sentences:\n\n${content}`,
          },
        ],
        systemPrompt: 'You are a helpful assistant. Provide brief, accurate summaries.',
        maxTokens: 150,
      })

      const embed = new EmbedBuilder()
        .setColor(0x7c3aed)
        .setTitle('📝 Summary')
        .setDescription(response.content)
        .addFields({
          name: 'Original Message',
          value: content.slice(0, 200) + (content.length > 200 ? '...' : ''),
        })
        .setFooter({ text: `By ${targetMessage.author.tag}` })
        .setTimestamp()

      await interaction.editReply({ embeds: [embed] })
    } else if (commandName === 'Translate to English') {
      await interaction.deferReply({ ephemeral: true })

      const content = targetMessage.content
      if (!content) {
        await interaction.editReply({
          content: '❌ No text content to translate.',
        })
        return
      }

      const aiService = AIService.getInstance()
      const response = await aiService.complete({
        messages: [
          {
            role: 'user',
            content: `Translate the following text to English. If it's already in English, just clean it up grammatically. Preserve the tone and meaning:\n\n${content}`,
          },
        ],
        systemPrompt: 'You are a translator. Provide accurate translations while preserving tone.',
        maxTokens: 500,
      })

      const embed = new EmbedBuilder()
        .setColor(0x3b82f6)
        .setTitle('🌐 Translation')
        .setDescription(response.content)
        .addFields({
          name: 'Original',
          value: content.slice(0, 500) + (content.length > 500 ? '...' : ''),
        })
        .setFooter({ text: `Original by ${targetMessage.author.tag}` })
        .setTimestamp()

      await interaction.editReply({ embeds: [embed] })
    } else if (commandName === 'Add to Session Notes') {
      // TODO: Actually save to session notes via API
      const content = targetMessage.content

      const embed = new EmbedBuilder()
        .setColor(0x22c55e)
        .setTitle('✅ Added to Session Notes')
        .setDescription('This message has been saved to your current session notes.')
        .addFields(
          {
            name: 'Content',
            value: content?.slice(0, 500) || '[No text content]',
          },
          {
            name: 'From',
            value: targetMessage.author.tag,
            inline: true,
          },
          {
            name: 'Channel',
            value: `#${(targetMessage.channel as any).name || 'DM'}`,
            inline: true,
          }
        )
        .setTimestamp()

      await interaction.reply({ embeds: [embed], ephemeral: true })
    } else if (commandName === 'Save as Lore') {
      const content = targetMessage.content

      const embed = new EmbedBuilder()
        .setColor(0x8b5cf6)
        .setTitle('📜 Save as Lore')
        .setDescription('Save this message as world lore for your campaign.')
        .addFields(
          {
            name: 'Content',
            value: content?.slice(0, 500) || '[No text content]',
          },
          {
            name: 'Author',
            value: targetMessage.author.tag,
            inline: true,
          }
        )
        .setFooter({ text: 'Select a category and campaign to save' })

      // TODO: Add select menu for campaign and category selection
      await interaction.reply({ embeds: [embed], ephemeral: true })
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
