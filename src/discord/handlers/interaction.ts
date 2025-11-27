/**
 * Interaction Handler
 * Routes Discord interactions to appropriate handlers
 */

import type {
  Interaction,
  ChatInputCommandInteraction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  AutocompleteInteraction,
} from 'discord.js'
import type { FumbleBotClient } from '../client.js'
import { handleButton } from './button.js'
import { handleSelectMenu } from './select-menu.js'
import { handleModal } from './modal.js'
import { handleAutocomplete } from './autocomplete.js'

/**
 * Main interaction handler - routes to specific handlers based on interaction type
 */
export async function handleInteraction(
  interaction: Interaction,
  bot: FumbleBotClient
): Promise<void> {
  // Slash command interactions
  if (interaction.isChatInputCommand()) {
    await handleSlashCommand(interaction, bot)
    return
  }

  // Context menu interactions (user and message)
  if (interaction.isUserContextMenuCommand() || interaction.isMessageContextMenuCommand()) {
    await handleContextMenu(interaction, bot)
    return
  }

  // Button interactions
  if (interaction.isButton()) {
    await handleButton(interaction, bot)
    return
  }

  // Select menu interactions
  if (interaction.isStringSelectMenu()) {
    await handleSelectMenu(interaction, bot)
    return
  }

  // Modal submissions
  if (interaction.isModalSubmit()) {
    await handleModal(interaction, bot)
    return
  }

  // Autocomplete interactions
  if (interaction.isAutocomplete()) {
    await handleAutocomplete(interaction, bot)
    return
  }
}

/**
 * Handle slash command interactions
 */
async function handleSlashCommand(
  interaction: ChatInputCommandInteraction,
  bot: FumbleBotClient
): Promise<void> {
  const commandName = interaction.commandName
  const handler = bot.commandRegistry.getSlashHandler(commandName)

  if (!handler) {
    console.warn(`[FumbleBot] No handler for command: ${commandName}`)
    await interaction.reply({
      content: '❌ This command is not implemented yet.',
      ephemeral: true,
    })
    return
  }

  try {
    await handler(interaction, bot)
  } catch (error) {
    console.error(`[FumbleBot] Error executing command ${commandName}:`, error)

    const errorMessage = error instanceof Error ? error.message : 'An error occurred'
    const content = `❌ Error: ${errorMessage}`

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content })
    } else {
      await interaction.reply({ content, ephemeral: true })
    }
  }
}

/**
 * Handle context menu interactions
 */
async function handleContextMenu(
  interaction: Interaction,
  bot: FumbleBotClient
): Promise<void> {
  if (!interaction.isContextMenuCommand()) return

  const commandName = interaction.commandName
  const handler = bot.commandRegistry.getContextHandler(commandName)

  if (!handler) {
    console.warn(`[FumbleBot] No handler for context menu: ${commandName}`)
    await interaction.reply({
      content: '❌ This action is not implemented yet.',
      ephemeral: true,
    })
    return
  }

  try {
    await handler(interaction as any, bot)
  } catch (error) {
    console.error(`[FumbleBot] Error executing context menu ${commandName}:`, error)

    const errorMessage = error instanceof Error ? error.message : 'An error occurred'
    const content = `❌ Error: ${errorMessage}`

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content })
    } else {
      await interaction.reply({ content, ephemeral: true })
    }
  }
}
