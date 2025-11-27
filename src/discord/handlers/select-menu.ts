/**
 * Select Menu Handler
 * Handles select menu interactions
 */

import type { StringSelectMenuInteraction } from 'discord.js'
import type { FumbleBotClient } from '../client.js'

/**
 * Handle select menu interactions
 */
export async function handleSelectMenu(
  interaction: StringSelectMenuInteraction,
  _bot: FumbleBotClient
): Promise<void> {
  const customId = interaction.customId
  const selectedValues = interaction.values

  try {
    // Parse select menu custom ID
    const parts = customId.split('_')
    const action = parts[0]

    switch (action) {
      case 'campaign':
        await handleCampaignSelect(interaction, selectedValues)
        break

      case 'category':
        await handleCategorySelect(interaction, selectedValues)
        break

      case 'system':
        await handleSystemSelect(interaction, selectedValues)
        break

      default:
        await interaction.reply({
          content: '❌ Unknown selection.',
          ephemeral: true,
        })
    }
  } catch (error) {
    console.error('[FumbleBot] Select menu handler error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Selection failed'

    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({ content: `❌ ${errorMessage}` })
    } else {
      await interaction.reply({ content: `❌ ${errorMessage}`, ephemeral: true })
    }
  }
}

async function handleCampaignSelect(
  interaction: StringSelectMenuInteraction,
  values: string[]
): Promise<void> {
  const campaignId = values[0]
  await interaction.reply({
    content: `📖 Selected campaign: ${campaignId}`,
    ephemeral: true,
  })
}

async function handleCategorySelect(
  interaction: StringSelectMenuInteraction,
  values: string[]
): Promise<void> {
  const category = values[0]
  await interaction.reply({
    content: `📁 Selected category: ${category}`,
    ephemeral: true,
  })
}

async function handleSystemSelect(
  interaction: StringSelectMenuInteraction,
  values: string[]
): Promise<void> {
  const system = values[0]
  await interaction.reply({
    content: `🎮 Selected system: ${system}`,
    ephemeral: true,
  })
}
