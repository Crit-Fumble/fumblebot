/**
 * Modal Handler
 * Handles modal form submissions
 */

import type { ModalSubmitInteraction } from 'discord.js'
import type { FumbleBotClient } from '../client.js'

/**
 * Handle modal submissions
 */
export async function handleModal(
  interaction: ModalSubmitInteraction,
  _bot: FumbleBotClient
): Promise<void> {
  const customId = interaction.customId

  try {
    // Parse modal custom ID
    const parts = customId.split('_')
    const action = parts[0]

    switch (action) {
      case 'npc':
        await handleNPCModal(interaction)
        break

      case 'session':
        await handleSessionModal(interaction, parts.slice(1))
        break

      case 'note':
        await handleNoteModal(interaction)
        break

      case 'feedback':
        await handleFeedbackModal(interaction)
        break

      default:
        await interaction.reply({
          content: '❌ Unknown form submission.',
          ephemeral: true,
        })
    }
  } catch (error) {
    console.error('[FumbleBot] Modal handler error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Form submission failed'

    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({ content: `❌ ${errorMessage}` })
    } else {
      await interaction.reply({ content: `❌ ${errorMessage}`, ephemeral: true })
    }
  }
}

async function handleNPCModal(interaction: ModalSubmitInteraction): Promise<void> {
  const name = interaction.fields.getTextInputValue('npc_name')
  const description = interaction.fields.getTextInputValue('npc_description')
  const backstory = interaction.fields.getTextInputValue('npc_backstory')

  // TODO: Save NPC via API
  await interaction.reply({
    content: `✅ NPC **${name}** created!\n\n**Description:** ${description}\n\n**Backstory:** ${backstory}`,
    ephemeral: true,
  })
}

async function handleSessionModal(
  interaction: ModalSubmitInteraction,
  params: string[]
): Promise<void> {
  const [subAction] = params

  if (subAction === 'create') {
    const name = interaction.fields.getTextInputValue('session_name')
    const description = interaction.fields.getTextInputValue('session_description')

    // TODO: Create session via API
    const sessionCode = Math.random().toString(36).substring(2, 8).toUpperCase()

    await interaction.reply({
      content: `✅ Session **${name}** created!\n\nCode: \`${sessionCode}\`\n${description}`,
    })
  } else if (subAction === 'notes') {
    const notes = interaction.fields.getTextInputValue('session_notes')

    // TODO: Save notes via API
    await interaction.reply({
      content: '✅ Session notes saved!',
      ephemeral: true,
    })
  }
}

async function handleNoteModal(interaction: ModalSubmitInteraction): Promise<void> {
  const title = interaction.fields.getTextInputValue('note_title')
  const content = interaction.fields.getTextInputValue('note_content')

  // TODO: Save note via API
  await interaction.reply({
    content: `📝 Note saved: **${title}**`,
    ephemeral: true,
  })
}

async function handleFeedbackModal(interaction: ModalSubmitInteraction): Promise<void> {
  const feedback = interaction.fields.getTextInputValue('feedback_content')
  const category = interaction.fields.getTextInputValue('feedback_category')

  // TODO: Save feedback via API
  console.log(`[FumbleBot] Feedback from ${interaction.user.tag}:`, { category, feedback })

  await interaction.reply({
    content: '✅ Thank you for your feedback! We appreciate it.',
    ephemeral: true,
  })
}
