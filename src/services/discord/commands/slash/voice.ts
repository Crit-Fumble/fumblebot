/**
 * Voice Commands
 * Simplified commands for voice channel transcription and AI assistant
 *
 * Commands:
 * - /voice transcribe - Join channel for transcription only
 * - /voice assistant - Join channel with AI assistant (or upgrade from transcribe)
 * - /voice end - End session and receive transcript via DM
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

// Admin IDs from environment
const ADMIN_IDS = (process.env.FUMBLEBOT_ADMIN_IDS || '').split(',').filter(Boolean);

/**
 * Check if user is an admin (can use voice commands)
 */
function isAdmin(userId: string): boolean {
  return ADMIN_IDS.includes(userId);
}

// Define slash commands
export const voiceCommands = [
  new SlashCommandBuilder()
    .setName('voice')
    .setDescription('Voice channel commands (admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Connect)
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('transcribe')
        .setDescription('Join voice channel for transcription only (admin only)')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('assistant')
        .setDescription('Join voice channel with AI assistant (admin only)')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('end')
        .setDescription('End voice session and receive transcript via DM (admin only)')
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
    case 'transcribe':
      await handleTranscribe(interaction);
      break;
    case 'assistant':
      await handleAssistant(interaction);
      break;
    case 'end':
      await handleEnd(interaction);
      break;
    default:
      await interaction.reply({
        content: 'Unknown voice command.',
        ephemeral: true,
      });
  }
}

/**
 * /voice transcribe - Join voice channel for transcription only
 */
async function handleTranscribe(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;
  const member = interaction.member as GuildMember;
  const voiceChannel = member.voice.channel;

  // Admin check
  if (!isAdmin(userId)) {
    await interaction.reply({
      content: 'This command is only available to server admins.',
      ephemeral: true,
    });
    return;
  }

  if (!voiceChannel) {
    await interaction.reply({
      content: 'You need to be in a voice channel first!',
      ephemeral: true,
    });
    return;
  }

  if (
    voiceChannel.type !== ChannelType.GuildVoice &&
    voiceChannel.type !== ChannelType.GuildStageVoice
  ) {
    await interaction.reply({
      content: 'Cannot join this type of channel.',
      ephemeral: true,
    });
    return;
  }

  // Check if already active
  if (voiceAssistant.isActive(guildId)) {
    const sessionInfo = voiceAssistant.getSessionInfo(guildId);
    if (sessionInfo?.mode === 'assistant') {
      await interaction.reply({
        content: 'Voice assistant is already active. Use `/voice end` to stop.',
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: 'Transcription is already active. Use `/voice end` to stop.',
        ephemeral: true,
      });
    }
    return;
  }

  // Show loading state
  await interaction.deferReply();

  try {
    // Get the text channel for live subtitles
    const textChannel = interaction.channel?.isTextBased() && !interaction.channel.isDMBased()
      ? interaction.channel
      : undefined;

    // Start transcription-only mode
    await voiceAssistant.startListening(voiceChannel, textChannel as any, {
      mode: 'transcribe',
      startedBy: userId,
    });

    const embed = new EmbedBuilder()
      .setTitle('Transcription Started')
      .setDescription(`Now transcribing in **${voiceChannel.name}**`)
      .setColor(0x22c55e)
      .addFields(
        {
          name: 'Mode',
          value: 'Transcription only (no AI responses)',
          inline: true,
        },
        {
          name: 'Live Subtitles',
          value: textChannel
            ? `Posting to <#${textChannel.id}>`
            : 'No text channel available',
          inline: true,
        }
      )
      .setFooter({ text: 'Use /voice assistant to enable AI, or /voice end to stop' });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('[Voice] Error starting transcription:', error);
    const errorEmbed = new EmbedBuilder()
      .setTitle('Failed to Start Transcription')
      .setDescription(`${error instanceof Error ? error.message : 'Unknown error'}`)
      .setColor(0xef4444);
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

/**
 * /voice assistant - Join voice channel with AI assistant (or upgrade from transcribe)
 */
async function handleAssistant(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;
  const member = interaction.member as GuildMember;
  const voiceChannel = member.voice.channel;

  // Admin check
  if (!isAdmin(userId)) {
    await interaction.reply({
      content: 'This command is only available to server admins.',
      ephemeral: true,
    });
    return;
  }

  if (!voiceChannel) {
    await interaction.reply({
      content: 'You need to be in a voice channel first!',
      ephemeral: true,
    });
    return;
  }

  if (
    voiceChannel.type !== ChannelType.GuildVoice &&
    voiceChannel.type !== ChannelType.GuildStageVoice
  ) {
    await interaction.reply({
      content: 'Cannot join this type of channel.',
      ephemeral: true,
    });
    return;
  }

  // Check if already active
  if (voiceAssistant.isActive(guildId)) {
    const sessionInfo = voiceAssistant.getSessionInfo(guildId);
    if (sessionInfo?.mode === 'assistant') {
      await interaction.reply({
        content: 'Voice assistant is already active. Use `/voice end` to stop.',
        ephemeral: true,
      });
      return;
    }

    // Upgrade from transcribe to assistant
    voiceAssistant.enableAssistantMode(guildId, userId);

    const embed = new EmbedBuilder()
      .setTitle('Assistant Mode Enabled')
      .setDescription('FumbleBot now responds to wake words.')
      .setColor(0x7c3aed)
      .addFields(
        {
          name: 'Wake Word',
          value: '"Hey FumbleBot"',
          inline: true,
        },
        {
          name: 'Example Commands',
          value:
            '- "Hey FumbleBot, roll d20"\n' +
            '- "Hey FumbleBot, roll initiative"\n' +
            '- "Hey FumbleBot, what is grappling?"',
          inline: false,
        }
      )
      .setFooter({ text: 'Use /voice end to stop' });

    await interaction.reply({ embeds: [embed] });
    return;
  }

  // Show loading state
  await interaction.deferReply();

  try {
    // Get the text channel for live subtitles
    const textChannel = interaction.channel?.isTextBased() && !interaction.channel.isDMBased()
      ? interaction.channel
      : undefined;

    // Start full assistant mode
    await voiceAssistant.startListening(voiceChannel, textChannel as any, {
      mode: 'assistant',
      startedBy: userId,
    });

    const embed = new EmbedBuilder()
      .setTitle('Voice Assistant Active')
      .setDescription(`Now listening in **${voiceChannel.name}**`)
      .setColor(0x7c3aed)
      .addFields(
        {
          name: 'Wake Word',
          value: '"Hey FumbleBot"',
          inline: true,
        },
        {
          name: 'Transcription',
          value: textChannel
            ? `Live subtitles in <#${textChannel.id}>`
            : 'No text channel for subtitles',
          inline: true,
        },
        {
          name: 'Example Commands',
          value:
            '- "Hey FumbleBot, roll d20"\n' +
            '- "Hey FumbleBot, roll 2d6 plus 3"\n' +
            '- "Hey FumbleBot, roll initiative"\n' +
            '- "Hey FumbleBot, what is grappling?"',
          inline: false,
        }
      )
      .setFooter({ text: 'Use /voice end to stop and receive transcript' });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('[Voice] Error starting assistant:', error);
    const errorEmbed = new EmbedBuilder()
      .setTitle('Failed to Start Assistant')
      .setDescription(`${error instanceof Error ? error.message : 'Unknown error'}`)
      .setColor(0xef4444);
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

/**
 * /voice end - End voice session and DM transcript to admin
 */
async function handleEnd(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  // Admin check
  if (!isAdmin(userId)) {
    await interaction.reply({
      content: 'This command is only available to server admins.',
      ephemeral: true,
    });
    return;
  }

  // Check if connected
  if (!voiceAssistant.isActive(guildId)) {
    await interaction.reply({
      content: 'No voice session is active.',
      ephemeral: true,
    });
    return;
  }

  // Defer reply since DM and stop might take a moment
  await interaction.deferReply({ ephemeral: true });

  try {
    // DM transcript to the admin who ran /voice end
    const transcript = voiceAssistant.getTranscript(guildId);
    if (transcript && transcript.entries.length > 0) {
      await voiceAssistant.dmSessionTranscript(userId, guildId);
    }

    // Stop the session
    await voiceAssistant.stopListening(guildId);
    await voiceClient.leaveChannel(guildId);

    await interaction.editReply({
      content: 'Session ended. Transcript sent to your DMs.',
    });
  } catch (error) {
    console.error('[Voice] Error ending session:', error);
    await interaction.editReply({
      content: `Failed to end session: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

// voiceHandler is the CommandHandler, voiceCommands contains the slash command definitions
