/**
 * Voice Commands
 * Commands for voice channel integration, sound playback, and voice assistant
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type GuildMember,
  ChannelType,
} from 'discord.js';
import { voiceClient, voiceAssistant } from '../../voice/index.js';
import type { FumbleBotClient } from '../../client.js';
import type { CommandHandler } from '../types.js';

// Test guild ID from environment
const TEST_GUILD_ID = process.env.FUMBLEBOT_DISCORD_TEST_GUILD_ID;
const HOME_GUILD_ID = process.env.FUMBLEBOT_DISCORD_GUILD_ID;
const ADMIN_IDS = (process.env.FUMBLEBOT_ADMIN_IDS || '').split(',').filter(Boolean);

/**
 * Check if user is an admin (can use voice listen commands)
 */
function isAdmin(userId: string): boolean {
  return ADMIN_IDS.includes(userId);
}

/**
 * Check if guild is allowed for voice commands (test or home server)
 */
function isAllowedGuild(guildId: string): boolean {
  return guildId === TEST_GUILD_ID || guildId === HOME_GUILD_ID;
}

// Define slash commands
export const voiceCommands = [
  new SlashCommandBuilder()
    .setName('voice')
    .setDescription('Voice channel integration commands')
    .setDefaultMemberPermissions(PermissionFlagsBits.Connect)
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('join')
        .setDescription('Join voice channel and start listening for "Hey FumbleBot"')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('leave').setDescription('Leave the current voice channel')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('status').setDescription('Check voice connection status')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('play')
        .setDescription('Play a sound effect from RPG assets')
        .addStringOption((option) =>
          option
            .setName('asset')
            .setDescription('Asset ID or name to play')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addNumberOption((option) =>
          option
            .setName('volume')
            .setDescription('Volume level (0.0 to 1.0)')
            .setMinValue(0.0)
            .setMaxValue(1.0)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('stop').setDescription('Stop current audio playback')
    ),
];

/**
 * Discord command handler for voice commands
 */
export async function voiceHandler(
  interaction: ChatInputCommandInteraction,
  _bot: FumbleBotClient
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'join':
      await handleJoin(interaction);
      break;
    case 'leave':
      await handleLeave(interaction);
      break;
    case 'status':
      await handleStatus(interaction);
      break;
    case 'play':
      await handlePlay(interaction);
      break;
    case 'stop':
      await handleStop(interaction);
      break;
    default:
      await interaction.reply({
        content: 'Unknown voice command.',
        ephemeral: true,
      });
  }
}

/**
 * Join voice channel and start listening
 */
async function handleJoin(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;
  const member = interaction.member as GuildMember;
  const voiceChannel = member.voice.channel;

  if (!voiceChannel) {
    await interaction.reply({
      content: '❌ You need to be in a voice channel first!',
      ephemeral: true,
    });
    return;
  }

  if (
    voiceChannel.type !== ChannelType.GuildVoice &&
    voiceChannel.type !== ChannelType.GuildStageVoice
  ) {
    await interaction.reply({
      content: '❌ Cannot join this type of channel.',
      ephemeral: true,
    });
    return;
  }

  // Check if voice listening is available for this user/guild
  const canListen = isAdmin(userId) && isAllowedGuild(guildId);

  // Check if already listening
  if (voiceAssistant.isActive(guildId)) {
    await interaction.reply({
      content: '🎧 Already listening for wake word in this server.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  try {
    if (canListen) {
      // Start voice assistant (joins channel + starts listening)
      await voiceAssistant.startListening(voiceChannel);

      const embed = new EmbedBuilder()
        .setTitle('🎧 Voice Assistant Active')
        .setDescription(`Now listening in **${voiceChannel.name}**`)
        .setColor(0x22c55e)
        .addFields(
          {
            name: 'Wake Word',
            value: '"Hey FumbleBot"',
            inline: true,
          },
          {
            name: 'Example Commands',
            value:
              '• "Hey FumbleBot, roll d20"\n' +
              '• "Hey FumbleBot, roll 2d6 plus 3"\n' +
              '• "Hey FumbleBot, roll initiative"\n' +
              '• "Hey FumbleBot, goodbye"',
            inline: false,
          }
        )
        .setFooter({ text: 'Say "Hey FumbleBot, goodbye" to stop listening' });

      await interaction.editReply({ embeds: [embed] });
    } else {
      // Just join without listening (for non-admins or non-allowed guilds)
      await voiceClient.joinChannel(voiceChannel);

      await interaction.editReply({
        content: `🎙️ Joined **${voiceChannel.name}**\n\n` +
          `*Voice assistant is currently in beta and only available to admins in select servers.*`,
      });
    }
  } catch (error) {
    console.error('[Voice] Error joining channel:', error);
    await interaction.editReply({
      content: `❌ Failed to join voice channel: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

/**
 * Leave voice channel
 */
async function handleLeave(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId!;

  if (!voiceClient.isConnected(guildId)) {
    await interaction.reply({
      content: '❌ Not in a voice channel.',
      ephemeral: true,
    });
    return;
  }

  try {
    // Stop listening if active
    if (voiceAssistant.isActive(guildId)) {
      await voiceAssistant.stopListening(guildId);
    }

    await voiceClient.leaveChannel(guildId);

    await interaction.reply({
      content: '👋 Left voice channel',
      ephemeral: false,
    });
  } catch (error) {
    console.error('[Voice] Error leaving channel:', error);
    await interaction.reply({
      content: `❌ Failed to leave voice channel: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ephemeral: true,
    });
  }
}

/**
 * Check voice status
 */
async function handleStatus(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId!;

  if (!voiceClient.isConnected(guildId)) {
    await interaction.reply({
      content: '📊 **Voice Status**: Not connected',
      ephemeral: true,
    });
    return;
  }

  const channelId = voiceClient.getCurrentChannel(guildId);
  const channel = channelId ? interaction.guild?.channels.cache.get(channelId) : null;
  const isListening = voiceAssistant.isActive(guildId);
  const isPaused = voiceAssistant.isPaused(guildId);

  // Determine listening status display
  let listeningStatus: string;
  if (!isListening) {
    listeningStatus = '⚫ Inactive';
  } else if (isPaused) {
    listeningStatus = '🟡 Paused (no users in channel)';
  } else {
    listeningStatus = '🟢 Active';
  }

  const embed = new EmbedBuilder()
    .setTitle('📊 Voice Status')
    .setColor(isPaused ? 0xfbbf24 : 0x7c3aed)
    .addFields(
      {
        name: 'Connected',
        value: channel ? `**${channel.name}**` : `<#${channelId}>`,
        inline: true,
      },
      {
        name: 'Wake Word Listening',
        value: listeningStatus,
        inline: true,
      }
    );

  if (isListening && !isPaused) {
    embed.addFields({
      name: 'How to Use',
      value: 'Say **"Hey FumbleBot"** followed by a command.\n' +
        'Examples:\n' +
        '• "Hey FumbleBot, roll d20"\n' +
        '• "Hey FumbleBot, roll initiative"\n' +
        '• "Hey FumbleBot, goodbye" (to stop listening)',
      inline: false,
    });
  } else if (isPaused) {
    embed.addFields({
      name: 'Auto-Resume',
      value: 'Listening will automatically resume when someone joins the voice channel.',
      inline: false,
    });
  }

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}

/**
 * Play sound effect from RPG assets
 */
async function handlePlay(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId!;
  const assetIdOrName = interaction.options.getString('asset', true);
  const volume = interaction.options.getNumber('volume') ?? 0.5;

  // Check if connected
  if (!voiceClient.isConnected(guildId)) {
    await interaction.reply({
      content: '❌ Not in a voice channel. Use `/voice join` first.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  try {
    // TODO: Lookup asset from database
    await interaction.editReply({
      content:
        `🎵 **Sound Effect Playback** (Coming Soon)\n\n` +
        `Asset: \`${assetIdOrName}\`\n` +
        `Volume: ${Math.round(volume * 100)}%\n\n` +
        `*This feature will play sound effects from RPG assets tagged as "sound" in voice channels.*`,
    });
  } catch (error) {
    console.error('[Voice] Error playing sound:', error);
    await interaction.editReply({
      content: `❌ Failed to play sound: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

/**
 * Stop current playback
 */
async function handleStop(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId!;

  if (!voiceClient.isConnected(guildId)) {
    await interaction.reply({
      content: '❌ Not in a voice channel.',
      ephemeral: true,
    });
    return;
  }

  try {
    voiceClient.stop(guildId);

    await interaction.reply({
      content: '⏹️ Stopped playback',
      ephemeral: false,
    });
  } catch (error) {
    console.error('[Voice] Error stopping playback:', error);
    await interaction.reply({
      content: `❌ Failed to stop playback: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ephemeral: true,
    });
  }
}

/**
 * Autocomplete handler for asset selection
 */
export async function handleVoiceAutocomplete(interaction: any) {
  const focusedValue = interaction.options.getFocused();

  // STUB: Return example assets
  const choices = [
    { name: 'Sword Swing', value: 'asset-sword-swing' },
    { name: 'Magic Spell Cast', value: 'asset-magic-cast' },
    { name: 'Door Creak', value: 'asset-door-creak' },
    { name: 'Footsteps', value: 'asset-footsteps' },
    { name: 'Thunder Clap', value: 'asset-thunder' },
  ].filter((choice) => choice.name.toLowerCase().includes(focusedValue.toLowerCase()));

  await interaction.respond(
    choices.slice(0, 25).map((choice) => ({
      name: choice.name,
      value: choice.value,
    }))
  );
}
