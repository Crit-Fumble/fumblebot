/**
 * Select Menu Handler
 * Handles select menu interactions
 */

import type { StringSelectMenuInteraction } from 'discord.js'
import type { FumbleBotClient } from '../client.js'
import { saveUserSettings } from '../settings/index.js'

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
      case 'settings':
        await handleSettingsSelect(interaction, parts.slice(1), selectedValues)
        break

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

/**
 * Handle settings select menu interactions
 */
async function handleSettingsSelect(
  interaction: StringSelectMenuInteraction,
  parts: string[],
  values: string[]
): Promise<void> {
  const settingType = parts[0]
  const selectedValue = values[0]
  const userId = interaction.user.id

  await interaction.deferUpdate()

  try {
    switch (settingType) {
      case 'voice': {
        // Save voice preference
        await saveUserSettings(userId, {
          defaultVoice: selectedValue,
        })
        await interaction.editReply({
          content: `✅ Voice changed to **${selectedValue}**`,
          embeds: [],
          components: [],
        })
        break
      }

      case 'system': {
        // Save game system preference
        await saveUserSettings(userId, {
          defaultGameSystem: selectedValue,
        })
        const systemNames: Record<string, string> = {
          '5e': '5e (2024)',
          '5e-2014': '5e (2014)',
          'pf2e': 'Pathfinder 2e',
          'cypher': 'Cypher System',
          'custom': 'Custom/Other',
        }
        await interaction.editReply({
          content: `✅ Game system changed to **${systemNames[selectedValue] || selectedValue}**`,
          embeds: [],
          components: [],
        })
        break
      }

      case 'worldanvil': {
        // Handle World Anvil world selection
        if (parts[1] === 'world') {
          await saveUserSettings(userId, {
            worldAnvil: {
              connected: true,
              defaultWorldId: selectedValue,
            },
          })
          await interaction.editReply({
            content: `✅ Default World Anvil world updated`,
            embeds: [],
            components: [],
          })
        }
        break
      }

      default:
        await interaction.editReply({
          content: '❌ Unknown settings option',
        })
    }
  } catch (error) {
    console.error('[Settings] Select menu error:', error)
    await interaction.editReply({
      content: '❌ Failed to save setting. Please try again.',
    })
  }
}
