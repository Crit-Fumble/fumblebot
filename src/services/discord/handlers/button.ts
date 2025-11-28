/**
 * Button Handler
 * Handles button interactions
 */

import type { ButtonInteraction } from 'discord.js'
import type { FumbleBotClient } from '../client.js'

/**
 * Handle button interactions
 */
export async function handleButton(
  interaction: ButtonInteraction,
  _bot: FumbleBotClient
): Promise<void> {
  const customId = interaction.customId

  // Parse button custom ID
  // Format: action_param1_param2
  const parts = customId.split('_')
  const action = parts[0]

  try {
    switch (action) {
      case 'session':
        await handleSessionButton(interaction, parts.slice(1))
        break

      case 'invite':
        await handleInviteButton(interaction, parts.slice(1))
        break

      case 'cancel':
        await interaction.update({
          content: '❌ Cancelled.',
          embeds: [],
          components: [],
        })
        break

      case 'confirm':
        await handleConfirmButton(interaction, parts.slice(1))
        break

      case 'roll':
        await handleRollButton(interaction, parts.slice(1))
        break

      default:
        await interaction.reply({
          content: '❌ Unknown button action.',
          ephemeral: true,
        })
    }
  } catch (error) {
    console.error('[FumbleBot] Button handler error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Button action failed'

    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({ content: `❌ ${errorMessage}` })
    } else {
      await interaction.reply({ content: `❌ ${errorMessage}`, ephemeral: true })
    }
  }
}

async function handleSessionButton(
  interaction: ButtonInteraction,
  params: string[]
): Promise<void> {
  const [subAction, sessionCode] = params

  if (subAction === 'invite') {
    // Copy invite link to clipboard functionality would be client-side
    await interaction.reply({
      content: `📋 Session invite code: \`${sessionCode}\`\n\nShare this with your players or use \`/session join ${sessionCode}\``,
      ephemeral: true,
    })
  } else if (subAction === 'join') {
    await interaction.reply({
      content: `Joining session ${sessionCode}...`,
      ephemeral: true,
    })
    // TODO: Actually join session via API
  }
}

async function handleInviteButton(
  interaction: ButtonInteraction,
  params: string[]
): Promise<void> {
  const [subAction, targetUserId] = params

  if (subAction === 'to' && params[1] === 'session') {
    const userId = params[2]
    // TODO: Send session invite to user
    await interaction.update({
      content: `✅ Invite sent to <@${userId}>!`,
      embeds: [],
      components: [],
    })
  }
}

async function handleConfirmButton(
  interaction: ButtonInteraction,
  params: string[]
): Promise<void> {
  const [action, ...rest] = params

  // Handle various confirmation actions
  await interaction.reply({
    content: '✅ Action confirmed.',
    ephemeral: true,
  })
}

async function handleRollButton(
  interaction: ButtonInteraction,
  params: string[]
): Promise<void> {
  const [diceNotation] = params

  // Quick re-roll button
  const match = diceNotation.match(/^(\d+)?d(\d+)([+-]\d+)?$/i)

  if (!match) {
    await interaction.reply({
      content: '❌ Invalid dice notation.',
      ephemeral: true,
    })
    return
  }

  const count = parseInt(match[1] || '1', 10)
  const sides = parseInt(match[2], 10)
  const modifier = parseInt(match[3] || '0', 10)

  const rolls: number[] = []
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1)
  }

  const total = rolls.reduce((sum, roll) => sum + roll, 0) + modifier

  await interaction.reply({
    content: `🎲 **${diceNotation}**: [${rolls.join(', ')}] = **${total}**`,
  })
}
