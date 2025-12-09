/**
 * Character Management Commands
 * /character create, select, edit, remove, list
 */

import type {
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  AttachmentBuilder,
} from 'discord.js';
import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import characterService from '../services/character/character-service.js';
import type { Command, CommandContext, CommandResult } from './types.js';

export const character: Command = {
  name: 'character',
  description: 'Manage your roleplay characters',

  data: new SlashCommandBuilder()
    .setName('character')
    .setDescription('Manage your roleplay characters')
    .addSubcommand(sub =>
      sub
        .setName('create')
        .setDescription('Create a new character')
        .addStringOption(opt =>
          opt
            .setName('name')
            .setDescription('Character name')
            .setRequired(true)
            .setMaxLength(100)
        )
        .addAttachmentOption(opt =>
          opt
            .setName('token')
            .setDescription('Character avatar/token image')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('select')
        .setDescription('Select a character to use in this channel')
        .addStringOption(opt =>
          opt
            .setName('character')
            .setDescription('Choose a character')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('deselect')
        .setDescription('Deselect your active character in this channel')
    )
    .addSubcommand(sub =>
      sub
        .setName('edit')
        .setDescription('Edit a character')
        .addStringOption(opt =>
          opt
            .setName('character')
            .setDescription('Character to edit')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption(opt =>
          opt
            .setName('name')
            .setDescription('New character name')
            .setRequired(false)
            .setMaxLength(100)
        )
        .addAttachmentOption(opt =>
          opt
            .setName('token')
            .setDescription('New character avatar/token image')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Delete a character')
        .addStringOption(opt =>
          opt
            .setName('character')
            .setDescription('Character to delete')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('List all your characters')
    ),

  async execute(context: CommandContext): Promise<CommandResult> {
    const interaction = context.interaction as ChatInputCommandInteraction;
    const subcommand = interaction.options.getSubcommand();

    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const channelId = interaction.channelId;
    const threadId = interaction.channel?.isThread() ? interaction.channel.id : undefined;

    if (!guildId) {
      return {
        content: 'This command can only be used in a server.',
        ephemeral: true,
      };
    }

    try {
      switch (subcommand) {
        case 'create':
          return await handleCreate(interaction, userId, guildId);

        case 'select':
          return await handleSelect(interaction, userId, guildId, channelId, threadId);

        case 'deselect':
          return await handleDeselect(interaction, userId, guildId, channelId, threadId);

        case 'edit':
          return await handleEdit(interaction, userId, guildId);

        case 'remove':
          return await handleRemove(interaction, userId, guildId);

        case 'list':
          return await handleList(interaction, userId, guildId, channelId, threadId);

        default:
          return {
            content: 'Unknown subcommand.',
            ephemeral: true,
          };
      }
    } catch (error: any) {
      console.error('[Character Command] Error:', error);
      return {
        content: `Error: ${error.message || 'An unexpected error occurred'}`,
        ephemeral: true,
      };
    }
  },

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    if (!guildId) {
      await interaction.respond([]);
      return;
    }

    try {
      const focusedValue = interaction.options.getFocused();
      const characters = await characterService.search(userId, guildId, focusedValue);

      await interaction.respond(
        characters.slice(0, 25).map(char => ({
          name: char.name,
          value: char.id,
        }))
      );
    } catch (error) {
      console.error('[Character Autocomplete] Error:', error);
      await interaction.respond([]);
    }
  },
};

/**
 * Handle /character create
 */
async function handleCreate(
  interaction: ChatInputCommandInteraction,
  userId: string,
  guildId: string
): Promise<CommandResult> {
  const name = interaction.options.getString('name', true);
  const tokenAttachment = interaction.options.getAttachment('token');

  const character = await characterService.create(userId, guildId, {
    name,
    tokenUrl: tokenAttachment?.url,
  });

  const embed = new EmbedBuilder()
    .setTitle('✅ Character Created')
    .setDescription(`**${character.name}** has been created!`)
    .setColor(0x00ff00)
    .setFooter({ text: 'Use /character select to activate this character in a channel' });

  if (character.tokenUrl) {
    embed.setThumbnail(character.tokenUrl);
  }

  return {
    embeds: [embed],
    ephemeral: true,
  };
}

/**
 * Handle /character select
 */
async function handleSelect(
  interaction: ChatInputCommandInteraction,
  userId: string,
  guildId: string,
  channelId: string,
  threadId?: string
): Promise<CommandResult> {
  const characterId = interaction.options.getString('character', true);

  const character = await characterService.setActive(
    characterId,
    userId,
    guildId,
    channelId,
    threadId
  );

  const contextName = threadId ? 'thread' : 'channel';

  const embed = new EmbedBuilder()
    .setTitle('🎭 Character Selected')
    .setDescription(
      `**${character.name}** is now your active character in this ${contextName}.\n\n` +
      `Use /ic commands to speak and act as ${character.name}.`
    )
    .setColor(0x00aaff);

  if (character.tokenUrl) {
    embed.setThumbnail(character.tokenUrl);
  }

  return {
    embeds: [embed],
    ephemeral: true,
  };
}

/**
 * Handle /character deselect
 */
async function handleDeselect(
  interaction: ChatInputCommandInteraction,
  userId: string,
  guildId: string,
  channelId: string,
  threadId?: string
): Promise<CommandResult> {
  const activeChar = await characterService.getActive(userId, guildId, channelId, threadId);

  if (!activeChar) {
    return {
      content: 'You do not have an active character in this channel.',
      ephemeral: true,
    };
  }

  await characterService.deactivateAll(userId, guildId, channelId, threadId);

  return {
    content: `**${activeChar.name}** is no longer active in this channel.`,
    ephemeral: true,
  };
}

/**
 * Handle /character edit
 */
async function handleEdit(
  interaction: ChatInputCommandInteraction,
  userId: string,
  guildId: string
): Promise<CommandResult> {
  const characterId = interaction.options.getString('character', true);
  const newName = interaction.options.getString('name');
  const newToken = interaction.options.getAttachment('token');

  if (!newName && !newToken) {
    return {
      content: 'Please provide at least one field to update (name or token).',
      ephemeral: true,
    };
  }

  const character = await characterService.update(characterId, userId, guildId, {
    name: newName || undefined,
    tokenUrl: newToken ? newToken.url : undefined,
  });

  const embed = new EmbedBuilder()
    .setTitle('✏️ Character Updated')
    .setDescription(`**${character.name}** has been updated.`)
    .setColor(0x00aaff);

  if (character.tokenUrl) {
    embed.setThumbnail(character.tokenUrl);
  }

  return {
    embeds: [embed],
    ephemeral: true,
  };
}

/**
 * Handle /character remove
 */
async function handleRemove(
  interaction: ChatInputCommandInteraction,
  userId: string,
  guildId: string
): Promise<CommandResult> {
  const characterId = interaction.options.getString('character', true);

  const character = await characterService.getById(characterId, userId, guildId);
  if (!character) {
    return {
      content: 'Character not found.',
      ephemeral: true,
    };
  }

  await characterService.delete(characterId, userId, guildId);

  return {
    content: `**${character.name}** has been deleted.`,
    ephemeral: true,
  };
}

/**
 * Handle /character list
 */
async function handleList(
  interaction: ChatInputCommandInteraction,
  userId: string,
  guildId: string,
  channelId: string,
  threadId?: string
): Promise<CommandResult> {
  const characters = await characterService.listWithActiveStatus(
    userId,
    guildId,
    channelId,
    threadId
  );

  if (characters.length === 0) {
    return {
      content: 'You have no characters in this server. Use `/character create` to make one!',
      ephemeral: true,
    };
  }

  const embed = new EmbedBuilder()
    .setTitle('🎭 Your Characters')
    .setDescription(
      characters
        .map(char => {
          const activeIndicator = char.isActive ? '✅ **ACTIVE**' : '';
          return `• **${char.name}** ${activeIndicator}`;
        })
        .join('\n')
    )
    .setColor(0x00aaff)
    .setFooter({ text: `Total: ${characters.length}` });

  return {
    embeds: [embed],
    ephemeral: true,
  };
}
