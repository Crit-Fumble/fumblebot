/**
 * Audio Playback Commands
 * /audio play - Play audio from URL or attachment
 * /audio pause - Pause playback
 * /audio resume - Resume playback
 * /audio stop - Stop playback and clear queue
 * /audio skip - Skip current track
 * /audio queue - View the queue
 * /audio volume - Set volume
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
  ChannelType,
} from 'discord.js';
import { joinVoiceChannel, getVoiceConnection } from '@discordjs/voice';
import type { FumbleBotClient } from '../../client.js';
import audioPlayer from '../../voice/audio-player.js';
import { isAdmin } from '../../../../config.js';

// Maximum file size: 25MB
const MAX_FILE_SIZE = 25 * 1024 * 1024;

// Allowed audio formats
const ALLOWED_EXTENSIONS = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'webm'];

export const audioCommands = [
  new SlashCommandBuilder()
    .setName('audio')
    .setDescription('Audio playback commands')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('play')
        .setDescription('Play audio from a URL or attachment')
        .addStringOption((option) =>
          option
            .setName('url')
            .setDescription('URL to an audio file')
            .setRequired(false)
        )
        .addAttachmentOption((option) =>
          option
            .setName('file')
            .setDescription('Audio file to play')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('pause').setDescription('Pause the current track')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('resume').setDescription('Resume playback')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('stop').setDescription('Stop playback and clear the queue')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('skip').setDescription('Skip the current track')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('queue').setDescription('View the current queue')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('volume')
        .setDescription('Set the playback volume')
        .addIntegerOption((option) =>
          option
            .setName('level')
            .setDescription('Volume level (0-200%)')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(200)
        )
    ),
];

export async function audioHandler(
  interaction: ChatInputCommandInteraction,
  _bot: FumbleBotClient
): Promise<void> {
  // Admin-only check - untested feature
  if (!isAdmin(interaction.user.id)) {
    await interaction.reply({
      content: 'This command is only available to server admins.',
      ephemeral: true,
    });
    return;
  }

  if (!interaction.guild) {
    await interaction.reply({
      content: '❌ This command can only be used in a server.',
      ephemeral: true,
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'play':
      await handlePlay(interaction);
      break;
    case 'pause':
      await handlePause(interaction);
      break;
    case 'resume':
      await handleResume(interaction);
      break;
    case 'stop':
      await handleStop(interaction);
      break;
    case 'skip':
      await handleSkip(interaction);
      break;
    case 'queue':
      await handleQueue(interaction);
      break;
    case 'volume':
      await handleVolume(interaction);
      break;
  }
}

async function handlePlay(interaction: ChatInputCommandInteraction): Promise<void> {
  const member = interaction.member as GuildMember;
  const voiceChannel = member.voice.channel;

  if (!voiceChannel) {
    await interaction.reply({
      content: '❌ You must be in a voice channel to use this command.',
      ephemeral: true,
    });
    return;
  }

  // Check if it's a voice channel we can join
  if (voiceChannel.type !== ChannelType.GuildVoice && voiceChannel.type !== ChannelType.GuildStageVoice) {
    await interaction.reply({
      content: '❌ Invalid voice channel type.',
      ephemeral: true,
    });
    return;
  }

  const url = interaction.options.getString('url');
  const attachment = interaction.options.getAttachment('file');

  if (!url && !attachment) {
    await interaction.reply({
      content: '❌ Please provide either a URL or an audio file attachment.',
      ephemeral: true,
    });
    return;
  }

  // Validate attachment if provided
  if (attachment) {
    // Check file size
    if (attachment.size > MAX_FILE_SIZE) {
      await interaction.reply({
        content: `❌ File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
        ephemeral: true,
      });
      return;
    }

    // Check file extension
    const ext = attachment.name?.split('.').pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      await interaction.reply({
        content: `❌ Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
        ephemeral: true,
      });
      return;
    }
  }

  await interaction.deferReply();

  try {
    const guildId = interaction.guild!.id;
    const audioUrl = attachment?.url || url!;
    const audioName = attachment?.name || url!.split('/').pop() || 'Unknown';

    // Check if already connected
    let connection = getVoiceConnection(guildId);

    if (!connection) {
      // Join voice channel
      connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: interaction.guild!.voiceAdapterCreator,
      });

      audioPlayer.connect(guildId, connection);
    }

    // Add to queue and play
    const result = await audioPlayer.play(
      guildId,
      audioUrl,
      audioName,
      interaction.user.username
    );

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTimestamp();

    if (result.isPlaying) {
      embed
        .setTitle('🎵 Now Playing')
        .setDescription(`**${audioName}**`)
        .addFields({ name: 'Requested by', value: interaction.user.username, inline: true });
    } else {
      embed
        .setTitle('📝 Added to Queue')
        .setDescription(`**${audioName}**`)
        .addFields(
          { name: 'Position', value: `#${result.position}`, inline: true },
          { name: 'Requested by', value: interaction.user.username, inline: true }
        );
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('[Audio] Play error:', error);
    await interaction.editReply({
      content: `❌ Failed to play audio: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

async function handlePause(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guild!.id;
  const status = audioPlayer.getStatus(guildId);

  if (!status.isPlaying) {
    await interaction.reply({
      content: '❌ Nothing is currently playing.',
      ephemeral: true,
    });
    return;
  }

  if (status.isPaused) {
    await interaction.reply({
      content: '❌ Playback is already paused.',
      ephemeral: true,
    });
    return;
  }

  audioPlayer.pause(guildId);

  await interaction.reply({
    content: `⏸️ Paused: **${status.currentItem?.name || 'Unknown'}**`,
  });
}

async function handleResume(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guild!.id;
  const status = audioPlayer.getStatus(guildId);

  if (!status.isPaused) {
    await interaction.reply({
      content: '❌ Playback is not paused.',
      ephemeral: true,
    });
    return;
  }

  audioPlayer.resume(guildId);

  await interaction.reply({
    content: `▶️ Resumed: **${status.currentItem?.name || 'Unknown'}**`,
  });
}

async function handleStop(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guild!.id;

  if (!audioPlayer.isConnected(guildId)) {
    await interaction.reply({
      content: '❌ Not connected to a voice channel.',
      ephemeral: true,
    });
    return;
  }

  audioPlayer.stop(guildId);
  audioPlayer.disconnect(guildId);

  await interaction.reply({
    content: '⏹️ Stopped playback and cleared the queue.',
  });
}

async function handleSkip(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guild!.id;
  const status = audioPlayer.getStatus(guildId);

  if (!status.isPlaying) {
    await interaction.reply({
      content: '❌ Nothing is currently playing.',
      ephemeral: true,
    });
    return;
  }

  const skipped = audioPlayer.skip(guildId);

  await interaction.reply({
    content: `⏭️ Skipped: **${skipped?.name || 'Unknown'}**`,
  });
}

async function handleQueue(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guild!.id;
  const { current, queue } = audioPlayer.getQueue(guildId);
  const status = audioPlayer.getStatus(guildId);

  if (!current && queue.length === 0) {
    await interaction.reply({
      content: '📭 The queue is empty.',
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('🎵 Audio Queue')
    .setColor(0x5865F2)
    .setTimestamp();

  if (current) {
    const statusIcon = status.isPaused ? '⏸️' : '▶️';
    embed.addFields({
      name: `${statusIcon} Now Playing`,
      value: `**${current.name}**\nRequested by: ${current.requestedBy}`,
      inline: false,
    });
  }

  if (queue.length > 0) {
    const queueList = queue
      .slice(0, 10)
      .map((item, i) => `${i + 1}. **${item.name}** - ${item.requestedBy}`)
      .join('\n');

    embed.addFields({
      name: `📝 Up Next (${queue.length})`,
      value: queueList,
      inline: false,
    });

    if (queue.length > 10) {
      embed.setFooter({ text: `... and ${queue.length - 10} more` });
    }
  }

  embed.addFields({
    name: '🔊 Volume',
    value: `${Math.round(status.volume * 100)}%`,
    inline: true,
  });

  await interaction.reply({ embeds: [embed] });
}

async function handleVolume(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guild!.id;
  const level = interaction.options.getInteger('level', true);
  const volume = level / 100;

  if (!audioPlayer.isConnected(guildId)) {
    await interaction.reply({
      content: '❌ Not connected to a voice channel.',
      ephemeral: true,
    });
    return;
  }

  audioPlayer.setVolume(guildId, volume);

  const volumeBar = '█'.repeat(Math.floor(level / 10)) + '░'.repeat(10 - Math.floor(level / 10));

  await interaction.reply({
    content: `🔊 Volume: ${level}%\n\`[${volumeBar}]\``,
  });
}
