/**
 * Activity Commands
 * Commands for launching and managing Discord Activities
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  ChannelType,
} from 'discord.js'
import type { FumbleBotClient } from '../../client.js'

// Define slash commands
export const activityCommands = [
  new SlashCommandBuilder()
    .setName('activity')
    .setDescription('Launch Crit-Fumble activities')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('start')
        .setDescription('Start a Crit-Fumble activity in your voice channel')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('invite')
        .setDescription('Get an invite link for the current activity')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('info')
        .setDescription('Information about Crit-Fumble activities')
    ),

  new SlashCommandBuilder()
    .setName('vtt')
    .setDescription('Launch the Virtual Tabletop activity')
    .addStringOption((option) =>
      option
        .setName('session')
        .setDescription('Session ID to join (optional)')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('session')
    .setDescription('Manage gaming sessions')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('Create a new gaming session')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('Session name')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('system')
            .setDescription('Game system')
            .setRequired(false)
            .addChoices(
              { name: 'D&D 5th Edition', value: 'dnd5e' },
              { name: 'Pathfinder 2e', value: 'pf2e' },
              { name: 'Call of Cthulhu', value: 'coc' },
              { name: 'Other', value: 'other' }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('join')
        .setDescription('Join an existing session')
        .addStringOption((option) =>
          option
            .setName('code')
            .setDescription('Session invite code')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('end')
        .setDescription('End the current session')
    ),
]

// Command handler
export async function activityHandler(
  interaction: ChatInputCommandInteraction,
  _bot: FumbleBotClient
): Promise<void> {
  const commandName = interaction.commandName

  try {
    if (commandName === 'activity') {
      const subcommand = interaction.options.getSubcommand()

      if (subcommand === 'start') {
        // Check if user is in a voice channel
        const member = await interaction.guild?.members.fetch(interaction.user.id)
        const voiceChannel = member?.voice.channel

        if (!voiceChannel) {
          await interaction.reply({
            content: '❌ You need to be in a voice channel to start an activity!',
            ephemeral: true,
          })
          return
        }

        // Create activity invite
        // Note: This requires the application to be registered as a Discord Activity
        const clientId = process.env.FUMBLEBOT_DISCORD_CLIENT_ID

        const embed = new EmbedBuilder()
          .setColor(0x7c3aed)
          .setTitle('🎮 Crit-Fumble Activity')
          .setDescription(
            `Starting activity in **${voiceChannel.name}**...\n\n` +
              'Click the button below to join the activity!'
          )
          .addFields(
            { name: 'Voice Channel', value: voiceChannel.name, inline: true },
            { name: 'Participants', value: `${voiceChannel.members.size}`, inline: true }
          )
          .setFooter({ text: 'Activity will launch in the voice channel' })

        // Create activity launch URL
        // Discord Activities use a special URL format
        const activityUrl = `https://discord.com/activities/${clientId}`

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel('Launch Activity')
            .setStyle(ButtonStyle.Link)
            .setURL(activityUrl)
            .setEmoji('🎮'),
          new ButtonBuilder()
            .setLabel('Open in Browser')
            .setStyle(ButtonStyle.Link)
            .setURL('https://www.crit-fumble.com/discord/activity')
        )

        await interaction.reply({ embeds: [embed], components: [row] })
      } else if (subcommand === 'invite') {
        const member = await interaction.guild?.members.fetch(interaction.user.id)
        const voiceChannel = member?.voice.channel

        if (!voiceChannel) {
          await interaction.reply({
            content: '❌ You need to be in a voice channel with an active activity!',
            ephemeral: true,
          })
          return
        }

        const invite = await voiceChannel.createInvite({
          maxAge: 3600, // 1 hour
          maxUses: 10,
          targetType: 2, // Embedded application
          // targetApplication would be set to your activity's application ID
        })

        const embed = new EmbedBuilder()
          .setColor(0x7c3aed)
          .setTitle('Activity Invite')
          .setDescription(`Share this link to invite others to the activity:`)
          .addFields({ name: 'Invite Link', value: invite.url })
          .setFooter({ text: 'Expires in 1 hour • Max 10 uses' })

        await interaction.reply({ embeds: [embed], ephemeral: true })
      } else if (subcommand === 'info') {
        const embed = new EmbedBuilder()
          .setColor(0x7c3aed)
          .setTitle('🎮 About Crit-Fumble Activities')
          .setDescription(
            'Crit-Fumble Activities bring the tabletop experience directly into your Discord voice channel!'
          )
          .addFields(
            {
              name: '🎲 Virtual Tabletop',
              value: 'Roll dice, track initiative, and manage your game all in one place.',
            },
            {
              name: '🎵 Ambiance Player',
              value: 'Set the mood with atmospheric music and sound effects.',
            },
            {
              name: '📋 Session Manager',
              value: 'Track characters, NPCs, and campaign notes.',
            },
            {
              name: '🗺️ Map Viewer',
              value: 'Share and annotate battle maps with your party.',
            }
          )
          .addFields({
            name: 'How to Start',
            value:
              '1. Join a voice channel\n' +
              '2. Use `/activity start`\n' +
              '3. Click the Activity button that appears\n' +
              '4. Others in the voice channel will see the activity!',
          })
          .setFooter({ text: 'Coming March 2026' })

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel('Learn More')
            .setStyle(ButtonStyle.Link)
            .setURL('https://www.crit-fumble.com/features/activities')
        )

        await interaction.reply({ embeds: [embed], components: [row] })
      }
    } else if (commandName === 'vtt') {
      const sessionId = interaction.options.getString('session')

      const member = await interaction.guild?.members.fetch(interaction.user.id)
      const voiceChannel = member?.voice.channel

      const embed = new EmbedBuilder()
        .setColor(0x7c3aed)
        .setTitle('🎲 Virtual Tabletop')
        .setDescription(
          sessionId
            ? `Joining session: **${sessionId}**`
            : 'Launching Virtual Tabletop...'
        )
        .setFooter({ text: 'VTT Coming March 2026' })

      const url = sessionId
        ? `https://www.crit-fumble.com/vtt?session=${sessionId}`
        : 'https://www.crit-fumble.com/vtt'

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel('Open VTT')
          .setStyle(ButtonStyle.Link)
          .setURL(url)
      )

      await interaction.reply({ embeds: [embed], components: [row] })
    } else if (commandName === 'session') {
      const subcommand = interaction.options.getSubcommand()

      if (subcommand === 'create') {
        const name = interaction.options.getString('name', true)
        const system = interaction.options.getString('system') || 'dnd5e'

        // TODO: Create session via API
        const sessionCode = Math.random().toString(36).substring(2, 8).toUpperCase()

        const embed = new EmbedBuilder()
          .setColor(0x22c55e)
          .setTitle('✅ Session Created')
          .setDescription(`**${name}**`)
          .addFields(
            { name: 'System', value: system, inline: true },
            { name: 'Code', value: `\`${sessionCode}\``, inline: true },
            { name: 'DM', value: `${interaction.user}`, inline: true }
          )
          .setFooter({ text: 'Share the code with your players to join!' })

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel('Open Session')
            .setStyle(ButtonStyle.Link)
            .setURL(`https://www.crit-fumble.com/session/${sessionCode}`),
          new ButtonBuilder()
            .setCustomId(`session_invite_${sessionCode}`)
            .setLabel('Copy Invite')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📋')
        )

        await interaction.reply({ embeds: [embed], components: [row] })
      } else if (subcommand === 'join') {
        const code = interaction.options.getString('code', true).toUpperCase()

        // TODO: Validate session via API
        const embed = new EmbedBuilder()
          .setColor(0x7c3aed)
          .setTitle('Joining Session...')
          .setDescription(`Session code: \`${code}\``)

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel('Join Session')
            .setStyle(ButtonStyle.Link)
            .setURL(`https://www.crit-fumble.com/session/${code}/join`)
        )

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true })
      } else if (subcommand === 'end') {
        // TODO: End session via API
        await interaction.reply({
          content: '✅ Session ended. Thanks for playing!',
          ephemeral: true,
        })
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Command failed'
    await interaction.reply({ content: `❌ ${errorMessage}`, ephemeral: true })
  }
}
