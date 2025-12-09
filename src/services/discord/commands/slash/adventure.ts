/**
 * Adventure Commands
 * MUD-style text adventure commands using Core Adventure API
 *
 * Commands:
 * - /adventure create <name> - Create a new adventure in this channel
 * - /adventure join - Join the current adventure
 * - /adventure leave - Leave the current adventure
 * - /adventure status - Check adventure status
 * - /adventure do <action> - Perform an action
 * - /adventure say <message> - Say something in character
 * - /adventure emote <action> - Express an emotion/action
 * - /adventure history - View recent adventure history
 * - /adventure end - End the adventure
 * - /adventure list - List all active adventures
 */

import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { FumbleBotClient } from '../../client.js';
import type { CommandHandler } from '../types.js';
import {
  adventureService,
  formatAdventureStatus,
  formatAdventureHistory,
  formatAdventureMessage,
} from '../../../terminal/index.js';

// Define slash commands
export const adventureCommands = [
  new SlashCommandBuilder()
    .setName('adventure')
    .setDescription('Text adventure commands')
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('Create a new adventure in this channel')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('Name of the adventure')
            .setRequired(true)
            .setMaxLength(100)
        )
        .addStringOption((option) =>
          option
            .setName('description')
            .setDescription('Description of the adventure')
            .setRequired(false)
            .setMaxLength(500)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('join')
        .setDescription('Join the current adventure')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('Your character name')
            .setRequired(false)
            .setMaxLength(50)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('leave').setDescription('Leave the current adventure')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('status').setDescription('Check adventure status')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('do')
        .setDescription('Perform an action')
        .addStringOption((option) =>
          option
            .setName('action')
            .setDescription('What do you do?')
            .setRequired(true)
            .setMaxLength(500)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('say')
        .setDescription('Say something in character')
        .addStringOption((option) =>
          option
            .setName('message')
            .setDescription('What do you say?')
            .setRequired(true)
            .setMaxLength(500)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('emote')
        .setDescription('Express an emotion or action')
        .addStringOption((option) =>
          option
            .setName('action')
            .setDescription('What do you express?')
            .setRequired(true)
            .setMaxLength(500)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('history').setDescription('View recent adventure history')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('end').setDescription('End the adventure')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('list').setDescription('List all active adventures')
    ),
];

/**
 * Handler for all /adventure commands
 */
export const adventureHandler: CommandHandler = async (
  interaction: ChatInputCommandInteraction,
  _bot: FumbleBotClient
): Promise<void> => {
  if (!interaction.guild) {
    await interaction.reply({
      content: 'This command can only be used in a server.',
      ephemeral: true,
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'create':
      await handleCreate(interaction);
      break;
    case 'join':
      await handleJoin(interaction);
      break;
    case 'leave':
      await handleLeave(interaction);
      break;
    case 'status':
      await handleStatus(interaction);
      break;
    case 'do':
      await handleDo(interaction);
      break;
    case 'say':
      await handleSay(interaction);
      break;
    case 'emote':
      await handleEmote(interaction);
      break;
    case 'history':
      await handleHistory(interaction);
      break;
    case 'end':
      await handleEnd(interaction);
      break;
    case 'list':
      await handleList(interaction);
      break;
  }
};

/**
 * Handle /adventure create
 */
async function handleCreate(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guild!.id;
  const channelId = interaction.channel!.id;
  const name = interaction.options.getString('name', true);
  const description = interaction.options.getString('description') ?? undefined;

  await interaction.deferReply();

  try {
    // Check if adventure already exists
    const existing = await adventureService.getByChannel(guildId, channelId);
    if (existing && existing.status !== 'ended') {
      await interaction.editReply({
        content: `An adventure is already running in this channel: **${existing.name}**\n\nUse \`/adventure end\` to end it first, or \`/adventure join\` to join.`,
      });
      return;
    }

    const adventure = await adventureService.create(guildId, channelId, name, description);

    // Auto-join the creator
    await adventureService.join(adventure.id, interaction.user.id, interaction.user.username);

    await interaction.editReply({
      content: `**Adventure Created: ${name}**\n\n${description ? `*${description}*\n\n` : ''}You have automatically joined the adventure.\n\nOthers can join with \`/adventure join\`\nStart playing with \`/adventure do <action>\` or \`/adventure say <message>\``,
    });
  } catch (error) {
    console.error('[Adventure] Create error:', error);
    await interaction.editReply({
      content: `Failed to create adventure: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

/**
 * Handle /adventure join
 */
async function handleJoin(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guild!.id;
  const channelId = interaction.channel!.id;
  const characterName = interaction.options.getString('name') ?? interaction.user.username;

  await interaction.deferReply();

  try {
    const adventure = await adventureService.getByChannel(guildId, channelId);
    if (!adventure || adventure.status === 'ended') {
      await interaction.editReply({
        content: 'No active adventure in this channel. Use `/adventure create <name>` to start one.',
      });
      return;
    }

    const result = await adventureService.join(
      adventure.id,
      interaction.user.id,
      characterName
    );

    if (result.success) {
      await interaction.editReply({
        content: `**${characterName}** has joined the adventure!\n\nPlayers: ${result.playerCount}`,
      });
    } else {
      await interaction.editReply({
        content: 'Failed to join the adventure. You may already be in it.',
      });
    }
  } catch (error) {
    console.error('[Adventure] Join error:', error);
    await interaction.editReply({
      content: `Failed to join: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

/**
 * Handle /adventure leave
 */
async function handleLeave(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guild!.id;
  const channelId = interaction.channel!.id;

  await interaction.deferReply();

  try {
    const adventure = await adventureService.getByChannel(guildId, channelId);
    if (!adventure || adventure.status === 'ended') {
      await interaction.editReply({
        content: 'No active adventure in this channel.',
      });
      return;
    }

    const success = await adventureService.leave(
      adventure.id,
      interaction.user.id,
      interaction.user.username
    );

    if (success) {
      await interaction.editReply({
        content: `**${interaction.user.username}** has left the adventure.`,
      });
    } else {
      await interaction.editReply({
        content: 'Failed to leave the adventure.',
      });
    }
  } catch (error) {
    console.error('[Adventure] Leave error:', error);
    await interaction.editReply({
      content: `Failed to leave: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

/**
 * Handle /adventure status
 */
async function handleStatus(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guild!.id;
  const channelId = interaction.channel!.id;

  await interaction.deferReply();

  try {
    const adventure = await adventureService.getByChannel(guildId, channelId);
    const embed = formatAdventureStatus(adventure);
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('[Adventure] Status error:', error);
    await interaction.editReply({
      content: `Failed to get status: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

/**
 * Handle /adventure do
 */
async function handleDo(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guild!.id;
  const channelId = interaction.channel!.id;
  const action = interaction.options.getString('action', true);

  await interaction.deferReply();

  try {
    const adventure = await adventureService.getByChannel(guildId, channelId);
    if (!adventure || adventure.status === 'ended') {
      await interaction.editReply({
        content: 'No active adventure in this channel.',
      });
      return;
    }

    const result = await adventureService.sendAction(
      adventure.id,
      interaction.user.id,
      action
    );

    if (result.success) {
      const formatted = formatAdventureMessage(result.message);
      await interaction.editReply({ content: formatted });
    } else {
      await interaction.editReply({
        content: 'Failed to send action. You may need to `/adventure join` first.',
      });
    }
  } catch (error) {
    console.error('[Adventure] Do error:', error);
    await interaction.editReply({
      content: `Failed to perform action: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

/**
 * Handle /adventure say
 */
async function handleSay(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guild!.id;
  const channelId = interaction.channel!.id;
  const message = interaction.options.getString('message', true);

  await interaction.deferReply();

  try {
    const adventure = await adventureService.getByChannel(guildId, channelId);
    if (!adventure || adventure.status === 'ended') {
      await interaction.editReply({
        content: 'No active adventure in this channel.',
      });
      return;
    }

    const result = await adventureService.say(
      adventure.id,
      interaction.user.id,
      message
    );

    if (result.success) {
      const formatted = formatAdventureMessage(result.message);
      await interaction.editReply({ content: formatted });
    } else {
      await interaction.editReply({
        content: 'Failed to say message. You may need to `/adventure join` first.',
      });
    }
  } catch (error) {
    console.error('[Adventure] Say error:', error);
    await interaction.editReply({
      content: `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

/**
 * Handle /adventure emote
 */
async function handleEmote(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guild!.id;
  const channelId = interaction.channel!.id;
  const action = interaction.options.getString('action', true);

  await interaction.deferReply();

  try {
    const adventure = await adventureService.getByChannel(guildId, channelId);
    if (!adventure || adventure.status === 'ended') {
      await interaction.editReply({
        content: 'No active adventure in this channel.',
      });
      return;
    }

    const result = await adventureService.emote(
      adventure.id,
      interaction.user.id,
      action
    );

    if (result.success) {
      const formatted = formatAdventureMessage(result.message);
      await interaction.editReply({ content: formatted });
    } else {
      await interaction.editReply({
        content: 'Failed to emote. You may need to `/adventure join` first.',
      });
    }
  } catch (error) {
    console.error('[Adventure] Emote error:', error);
    await interaction.editReply({
      content: `Failed to emote: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

/**
 * Handle /adventure history
 */
async function handleHistory(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guild!.id;
  const channelId = interaction.channel!.id;

  await interaction.deferReply();

  try {
    const adventure = await adventureService.getByChannel(guildId, channelId);
    if (!adventure) {
      await interaction.editReply({
        content: 'No adventure in this channel.',
      });
      return;
    }

    const messages = await adventureService.getHistory(adventure.id, 20);
    const embed = formatAdventureHistory(adventure, messages);
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('[Adventure] History error:', error);
    await interaction.editReply({
      content: `Failed to get history: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

/**
 * Handle /adventure end
 */
async function handleEnd(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guild!.id;
  const channelId = interaction.channel!.id;

  await interaction.deferReply();

  try {
    const adventure = await adventureService.getByChannel(guildId, channelId);
    if (!adventure || adventure.status === 'ended') {
      await interaction.editReply({
        content: 'No active adventure in this channel.',
      });
      return;
    }

    const success = await adventureService.end(adventure.id);

    if (success) {
      await interaction.editReply({
        content: `**Adventure Ended: ${adventure.name}**\n\nThank you for playing!`,
      });
    } else {
      await interaction.editReply({
        content: 'Failed to end the adventure.',
      });
    }
  } catch (error) {
    console.error('[Adventure] End error:', error);
    await interaction.editReply({
      content: `Failed to end adventure: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

/**
 * Handle /adventure list
 */
async function handleList(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  try {
    const adventures = await adventureService.list();

    if (adventures.length === 0) {
      await interaction.editReply({
        content: 'No active adventures. Use `/adventure create <name>` to start one.',
      });
      return;
    }

    const list = adventures
      .map((a, i) => {
        const statusIcon = a.status === 'active' ? '▶️' : a.status === 'waiting' ? '⏳' : '⏸️';
        return `${i + 1}. ${statusIcon} **${a.name}** - ${a.playerCount} player${a.playerCount !== 1 ? 's' : ''}`;
      })
      .join('\n');

    await interaction.editReply({
      content: `**Active Adventures**\n\n${list}`,
    });
  } catch (error) {
    console.error('[Adventure] List error:', error);
    await interaction.editReply({
      content: `Failed to list adventures: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}
