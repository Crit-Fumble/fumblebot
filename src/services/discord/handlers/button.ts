/**
 * Button Handler
 * Handles button interactions
 */

import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type ButtonInteraction,
  type MessageActionRowComponentBuilder,
} from 'discord.js'
import type { FumbleBotClient } from '../client.js'
import { getUserSettings, disconnectWorldAnvil as disconnectWA } from '../settings/index.js'
import { getWorldAnvilService } from '../../worldanvil/index.js'
import characterService from '../../character/character-service.js'
import webhookService from '../webhook-service.js'
import type { TextChannel, ThreadChannel } from 'discord.js'

// Voice options for settings
const VOICES = [
  { id: 'orion', name: 'Orion', description: 'Male narrator (default)' },
  { id: 'luna', name: 'Luna', description: 'Female, warm' },
  { id: 'zeus', name: 'Zeus', description: 'Male, deep' },
  { id: 'athena', name: 'Athena', description: 'Female, authoritative' },
  { id: 'perseus', name: 'Perseus', description: 'Male, heroic' },
  { id: 'angus', name: 'Angus', description: 'Male, Scottish' },
  { id: 'stella', name: 'Stella', description: 'Female, bright' },
]

const GAME_SYSTEMS = [
  { id: '5e', name: '5e (2024)', description: 'D&D 5th Edition' },
  { id: '5e-2014', name: '5e (2014)', description: 'D&D 5e Legacy' },
  { id: 'pf2e', name: 'Pathfinder 2e', description: 'Pathfinder Second Edition' },
  { id: 'cypher', name: 'Cypher System', description: 'Monte Cook Games' },
  { id: 'custom', name: 'Custom/Other', description: 'Other game system' },
]

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
      case 'settings':
        await handleSettingsButton(interaction, parts.slice(1))
        break

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

      case 'ic':
        await handleICButton(interaction, parts.slice(1))
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

/**
 * Handle settings button interactions
 */
async function handleSettingsButton(
  interaction: ButtonInteraction,
  params: string[]
): Promise<void> {
  const [subAction, ...rest] = params
  const userId = interaction.user.id

  switch (subAction) {
    case 'voice':
      await showVoiceSettings(interaction, userId)
      break

    case 'system':
      await showSystemSettings(interaction, userId)
      break

    case 'worldanvil':
      await showWorldAnvilSettings(interaction, userId)
      break

    case 'notifications':
      await showNotificationSettings(interaction, userId)
      break

    case 'back':
      await showMainSettings(interaction, userId)
      break

    case 'worldanvil_disconnect':
      await handleDisconnectWorldAnvil(interaction, userId)
      break

    case 'voice_preview':
      await interaction.reply({
        content: '🔊 Voice preview coming soon! Join a voice channel and use `/voice assistant` to hear FumbleBot speak.',
        ephemeral: true,
      })
      break

    default:
      await interaction.reply({
        content: '❌ Unknown settings action.',
        ephemeral: true,
      })
  }
}

/**
 * Show main settings embed
 */
async function showMainSettings(
  interaction: ButtonInteraction,
  userId: string
): Promise<void> {
  const settings = await getUserSettings(userId) as any

  const embed = new EmbedBuilder()
    .setTitle('Your FumbleBot Settings')
    .setColor(0x7c3aed)
    .setDescription('Configure your preferences for FumbleBot across all servers.')
    .addFields(
      {
        name: 'Default Voice',
        value: `\`${settings.defaultVoice || 'orion'}\` - ${VOICES.find((v) => v.id === settings.defaultVoice)?.description || 'Male narrator'}`,
        inline: true,
      },
      {
        name: 'Game System',
        value: `\`${settings.defaultGameSystem || '5e'}\` - ${GAME_SYSTEMS.find((s) => s.id === settings.defaultGameSystem)?.name || '5e (2024)'}`,
        inline: true,
      },
      {
        name: '\u200B',
        value: '\u200B',
        inline: true,
      },
      {
        name: 'World Anvil',
        value: settings.worldAnvil?.connected
          ? `Connected as **${settings.worldAnvil.username}**\nDefault World: ${settings.worldAnvil.defaultWorldName || 'Not set'}`
          : 'Not connected',
        inline: true,
      },
      {
        name: 'Notifications',
        value:
          `Session Reminders: ${settings.notifications?.sessionReminders !== false ? '✅' : '❌'}\n` +
          `Transcript Ready: ${settings.notifications?.transcriptReady !== false ? '✅' : '❌'}`,
        inline: true,
      }
    )
    .setFooter({ text: 'Use the buttons below to change settings' })

  const row1 = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('settings_voice')
      .setLabel('Change Voice')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🎙️'),
    new ButtonBuilder()
      .setCustomId('settings_system')
      .setLabel('Game System')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🎮'),
    new ButtonBuilder()
      .setCustomId('settings_worldanvil')
      .setLabel('World Anvil')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🌍')
  )

  const row2 = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('settings_notifications')
      .setLabel('Notifications')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔔'),
    new ButtonBuilder()
      .setLabel('Link to Core Account')
      .setStyle(ButtonStyle.Link)
      .setURL('https://core.crit-fumble.com/link/discord')
  )

  await interaction.update({
    embeds: [embed],
    components: [row1, row2],
  })
}

/**
 * Show voice settings
 */
async function showVoiceSettings(
  interaction: ButtonInteraction,
  userId: string
): Promise<void> {
  const settings = await getUserSettings(userId) as any

  const embed = new EmbedBuilder()
    .setTitle('Voice Settings')
    .setColor(0x7c3aed)
    .setDescription('Select your preferred TTS voice for FumbleBot responses.')
    .addFields({
      name: 'Current Voice',
      value: `**${settings.defaultVoice || 'orion'}** - ${VOICES.find((v) => v.id === (settings.defaultVoice || 'orion'))?.description || 'Male narrator'}`,
    })

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('settings_voice_select')
    .setPlaceholder('Choose a voice')
    .addOptions(
      VOICES.map((voice) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(voice.name)
          .setDescription(voice.description)
          .setValue(voice.id)
          .setDefault(voice.id === (settings.defaultVoice || 'orion'))
      )
    )

  const row1 = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(selectMenu)

  const row2 = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('settings_voice_preview')
      .setLabel('Preview Voice')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🔊'),
    new ButtonBuilder()
      .setCustomId('settings_back')
      .setLabel('Back to Settings')
      .setStyle(ButtonStyle.Secondary)
  )

  await interaction.update({
    embeds: [embed],
    components: [row1, row2],
  })
}

/**
 * Show game system settings
 */
async function showSystemSettings(
  interaction: ButtonInteraction,
  userId: string
): Promise<void> {
  const settings = await getUserSettings(userId) as any

  const embed = new EmbedBuilder()
    .setTitle('Game System Settings')
    .setColor(0x22c55e)
    .setDescription(
      'Select your default game system. This affects rule lookups, character generation, and dice roll formatting.'
    )
    .addFields({
      name: 'Current System',
      value: `**${GAME_SYSTEMS.find((s) => s.id === (settings.defaultGameSystem || '5e'))?.name || '5e (2024)'}**`,
    })

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('settings_system_select')
    .setPlaceholder('Choose a game system')
    .addOptions(
      GAME_SYSTEMS.map((system) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(system.name)
          .setDescription(system.description)
          .setValue(system.id)
          .setDefault(system.id === (settings.defaultGameSystem || '5e'))
      )
    )

  const row1 = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(selectMenu)

  const row2 = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('settings_back')
      .setLabel('Back to Settings')
      .setStyle(ButtonStyle.Secondary)
  )

  await interaction.update({
    embeds: [embed],
    components: [row1, row2],
  })
}

/**
 * Show World Anvil settings
 */
async function showWorldAnvilSettings(
  interaction: ButtonInteraction,
  userId: string
): Promise<void> {
  const settings = await getUserSettings(userId) as any

  if (!settings.worldAnvil?.connected) {
    const embed = new EmbedBuilder()
      .setTitle('Connect World Anvil')
      .setColor(0x4a90d9)
      .setDescription(
        'Connect your World Anvil account to access your campaign worlds directly from Discord.\n\n' +
          '**How to connect:**\n' +
          '1. Go to [World Anvil Developer](https://www.worldanvil.com/developer)\n' +
          '2. Create an application or get your API key\n' +
          '3. Run `/settings worldanvil api_key:YOUR_KEY`'
      )
      .addFields({
        name: 'What you can do',
        value:
          '• Search your campaign articles\n' +
          '• Look up custom NPCs, locations, items\n' +
          '• Browse world categories\n' +
          '• Access world-specific lore via voice commands',
      })
      .setFooter({ text: 'Your API key is stored securely and never shared' })

    const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Get API Key')
        .setStyle(ButtonStyle.Link)
        .setURL('https://www.worldanvil.com/developer'),
      new ButtonBuilder()
        .setCustomId('settings_back')
        .setLabel('Back to Settings')
        .setStyle(ButtonStyle.Secondary)
    )

    await interaction.update({
      embeds: [embed],
      components: [row],
    })
  } else {
    // Connected - show world selection
    const waService = getWorldAnvilService()
    let worlds: Array<{ id: string; title: string }> = []

    if (waService) {
      try {
        const { entities } = await waService.listWorlds()
        worlds = entities.map((w: any) => ({ id: w.id, title: w.title }))
      } catch (e) {
        console.error('[Settings] Failed to fetch World Anvil worlds:', e)
      }
    }

    const embed = new EmbedBuilder()
      .setTitle('World Anvil Settings')
      .setColor(0x4a90d9)
      .setDescription(`Connected as **${settings.worldAnvil.username || 'Unknown'}**`)
      .addFields(
        {
          name: 'Default World',
          value: settings.worldAnvil.defaultWorldName || 'Not selected',
          inline: true,
        },
        {
          name: 'Available Worlds',
          value: worlds.length > 0 ? `${worlds.length} worlds found` : 'No worlds found',
          inline: true,
        }
      )

    const components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = []

    if (worlds.length > 0) {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('settings_worldanvil_world')
        .setPlaceholder('Select default world')
        .addOptions(
          worlds.slice(0, 25).map((w) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(w.title.slice(0, 100))
              .setValue(w.id)
              .setDefault(w.id === settings.worldAnvil?.defaultWorldId)
          )
        )

      components.push(
        new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(selectMenu)
      )
    }

    components.push(
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('settings_worldanvil_disconnect')
          .setLabel('Disconnect World Anvil')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('settings_back')
          .setLabel('Back to Settings')
          .setStyle(ButtonStyle.Secondary)
      )
    )

    await interaction.update({
      embeds: [embed],
      components,
    })
  }
}

/**
 * Show notification settings
 */
async function showNotificationSettings(
  interaction: ButtonInteraction,
  userId: string
): Promise<void> {
  const settings = await getUserSettings(userId) as any

  const embed = new EmbedBuilder()
    .setTitle('Notification Settings')
    .setColor(0xf59e0b)
    .setDescription('Configure which notifications you receive from FumbleBot.')
    .addFields(
      {
        name: 'Session Reminders',
        value: settings.notifications?.sessionReminders !== false ? '✅ Enabled' : '❌ Disabled',
        inline: true,
      },
      {
        name: 'Transcript Ready',
        value: settings.notifications?.transcriptReady !== false ? '✅ Enabled' : '❌ Disabled',
        inline: true,
      }
    )

  const row1 = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('settings_toggle_session_reminders')
      .setLabel(settings.notifications?.sessionReminders !== false ? 'Disable Reminders' : 'Enable Reminders')
      .setStyle(settings.notifications?.sessionReminders !== false ? ButtonStyle.Secondary : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('settings_toggle_transcript_ready')
      .setLabel(settings.notifications?.transcriptReady !== false ? 'Disable Transcript Alerts' : 'Enable Transcript Alerts')
      .setStyle(settings.notifications?.transcriptReady !== false ? ButtonStyle.Secondary : ButtonStyle.Success)
  )

  const row2 = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('settings_back')
      .setLabel('Back to Settings')
      .setStyle(ButtonStyle.Secondary)
  )

  await interaction.update({
    embeds: [embed],
    components: [row1, row2],
  })
}

/**
 * Disconnect World Anvil
 */
async function handleDisconnectWorldAnvil(
  interaction: ButtonInteraction,
  userId: string
): Promise<void> {
  try {
    await disconnectWA(userId)

    await interaction.update({
      content: '✅ World Anvil disconnected successfully.',
      embeds: [],
      components: [],
    })
  } catch (error) {
    console.error('[Settings] Failed to disconnect World Anvil:', error)
    await interaction.reply({
      content: '❌ Failed to disconnect World Anvil. Please try again.',
      ephemeral: true,
    })
  }
}

/**
 * Handle In-Character movement button
 * Format: ic_move:characterId:direction
 */
async function handleICButton(
  interaction: ButtonInteraction,
  params: string[]
): Promise<void> {
  // Parse the remaining customId parts
  // params[0] will be 'move:char-1:n', so we need to split by ':'
  const fullParams = params[0]?.split(':') || []
  const [subAction, characterId, direction] = fullParams

  if (subAction !== 'move') {
    await interaction.reply({
      content: '❌ Unknown IC action.',
      ephemeral: true,
    })
    return
  }

  if (!interaction.guildId || !interaction.channel) {
    await interaction.reply({
      content: '❌ This command can only be used in a server channel.',
      ephemeral: true,
    })
    return
  }

  const userId = interaction.user.id
  const guildId = interaction.guildId
  const channel = interaction.channel
  const channelId = channel.id
  const threadId = channel.isThread() ? channel.id : undefined

  try {
    // Verify character ownership
    const character = await characterService.getById(characterId, userId, guildId)

    if (!character) {
      await interaction.reply({
        content: '❌ Character not found or you do not have permission to move it.',
        ephemeral: true,
      })
      return
    }

    // Map direction to readable text
    const directionMap: Record<string, string> = {
      nw: 'northwest ↖️',
      n: 'north ⬆️',
      ne: 'northeast ↗️',
      w: 'west ⬅️',
      stop: 'stopped 🛑',
      e: 'east ➡️',
      sw: 'southwest ↙️',
      s: 'south ⬇️',
      se: 'southeast ↘️',
    }

    const directionText = directionMap[direction] || direction

    // For stop, just send a message
    if (direction === 'stop') {
      await webhookService.sendAsCharacter(
        channel as TextChannel | ThreadChannel,
        character,
        `*stops moving* 🛑`
      )

      await interaction.reply({
        content: `✅ ${character.name} stopped.`,
        ephemeral: true,
      })
      return
    }

    // Send movement message as character
    await webhookService.sendAsCharacter(
      channel as TextChannel | ThreadChannel,
      character,
      `*moves ${directionText}*`
    )

    // Acknowledge the movement
    await interaction.reply({
      content: `✅ ${character.name} moves ${directionText}`,
      ephemeral: true,
    })
  } catch (error: any) {
    console.error('[IC Move] Error:', error)
    await interaction.reply({
      content: `❌ Error: ${error.message || 'Failed to move character'}`,
      ephemeral: true,
    })
  }
}
