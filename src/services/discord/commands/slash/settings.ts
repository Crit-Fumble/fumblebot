/**
 * Settings Command
 * Discord embed-based UI for user account settings
 *
 * Commands:
 * - /settings - Show current settings with interactive UI
 * - /settings worldanvil - Configure World Anvil integration
 * - /settings voice - Configure voice preferences
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type ChatInputCommandInteraction,
  type MessageActionRowComponentBuilder,
} from 'discord.js';
import type { FumbleBotClient } from '../../client.js';
import type { CommandHandler } from '../types.js';
import { getUserSettings, saveUserSettings, type UserSettings } from '../../settings/index.js';
import { getWorldAnvilService } from '../../../worldanvil/index.js';

// Available TTS voices
const VOICES = [
  { id: 'orion', name: 'Orion', description: 'Male narrator (default)' },
  { id: 'luna', name: 'Luna', description: 'Female, warm' },
  { id: 'zeus', name: 'Zeus', description: 'Male, deep' },
  { id: 'athena', name: 'Athena', description: 'Female, authoritative' },
  { id: 'perseus', name: 'Perseus', description: 'Male, heroic' },
  { id: 'angus', name: 'Angus', description: 'Male, Scottish' },
  { id: 'stella', name: 'Stella', description: 'Female, bright' },
];

// Available game systems
const GAME_SYSTEMS = [
  { id: '5e', name: '5e (2024)', description: 'D&D 5th Edition' },
  { id: '5e-2014', name: '5e (2014)', description: 'D&D 5e Legacy' },
  { id: 'pf2e', name: 'Pathfinder 2e', description: 'Pathfinder Second Edition' },
  { id: 'cypher', name: 'Cypher System', description: 'Monte Cook Games' },
  { id: 'custom', name: 'Custom/Other', description: 'Other game system' },
];

// Define slash commands
export const settingsCommands = [
  new SlashCommandBuilder()
    .setName('settings')
    .setDescription('Configure your FumbleBot settings')
    .setDMPermission(true)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('view')
        .setDescription('View your current settings')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('worldanvil')
        .setDescription('Configure World Anvil integration')
        .addStringOption((option) =>
          option
            .setName('api_key')
            .setDescription('Your World Anvil API key (from worldanvil.com/developer)')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('voice')
        .setDescription('Configure voice preferences')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('system')
        .setDescription('Set your default game system')
    ),
];


/**
 * Discord command handler for settings commands
 */
export async function settingsHandler(
  interaction: ChatInputCommandInteraction,
  _bot: FumbleBotClient
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'view':
      await handleViewSettings(interaction);
      break;
    case 'worldanvil':
      await handleWorldAnvilSettings(interaction);
      break;
    case 'voice':
      await handleVoiceSettings(interaction);
      break;
    case 'system':
      await handleSystemSettings(interaction);
      break;
    default:
      await handleViewSettings(interaction);
  }
}

/**
 * /settings view - Show current settings with interactive buttons
 */
async function handleViewSettings(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;

  await interaction.deferReply({ ephemeral: true });

  try {
    const settings = await getUserSettings(userId);

    const embed = new EmbedBuilder()
      .setTitle('Your FumbleBot Settings')
      .setColor(0x7c3aed)
      .setDescription('Configure your preferences for FumbleBot across all servers.')
      .addFields(
        {
          name: 'Default Voice',
          value: `\`${settings.defaultVoice}\` - ${VOICES.find((v) => v.id === settings.defaultVoice)?.description || 'Unknown'}`,
          inline: true,
        },
        {
          name: 'Game System',
          value: `\`${settings.defaultGameSystem}\` - ${GAME_SYSTEMS.find((s) => s.id === settings.defaultGameSystem)?.name || 'Unknown'}`,
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
            `Session Reminders: ${settings.notifications.sessionReminders ? '✅' : '❌'}\n` +
            `Transcript Ready: ${settings.notifications.transcriptReady ? '✅' : '❌'}`,
          inline: true,
        }
      )
      .setFooter({ text: 'Use the buttons below or subcommands to change settings' });

    // Create action buttons
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
    );

    const row2 = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('settings_notifications')
        .setLabel('Notifications')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔔'),
      new ButtonBuilder()
        .setCustomId('settings_link_core')
        .setLabel('Link to Core Account')
        .setStyle(ButtonStyle.Link)
        .setURL('https://core.crit-fumble.com/link/discord')
    );

    await interaction.editReply({
      embeds: [embed],
      components: [row1, row2],
    });
  } catch (error) {
    console.error('[Settings] Error fetching settings:', error);
    await interaction.editReply({
      content: '❌ Failed to load settings. Please try again.',
    });
  }
}

/**
 * /settings worldanvil - Configure World Anvil integration
 */
async function handleWorldAnvilSettings(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;
  const apiKey = interaction.options.getString('api_key');

  await interaction.deferReply({ ephemeral: true });

  try {
    // If API key provided, save it
    if (apiKey) {
      // Validate API key by trying to fetch identity
      const waService = getWorldAnvilService();
      if (waService) {
        waService.setAuthToken(apiKey);
        try {
          await waService.getIdentity();
          // Save to Core
          await saveUserSettings(userId, {
            worldAnvil: {
              connected: true,
              // Username will be fetched on next load
            },
          } as any);

          await interaction.editReply({
            content: '✅ World Anvil API key saved successfully! Use `/settings worldanvil` again to select your default world.',
          });
          return;
        } catch (e) {
          await interaction.editReply({
            content: '❌ Invalid World Anvil API key. Please check your key and try again.\n\nGet your API key from: https://www.worldanvil.com/developer',
          });
          return;
        }
      }
    }

    // Show World Anvil settings UI
    const settings = await getUserSettings(userId);

    if (!settings.worldAnvil?.connected) {
      // Not connected - show connection instructions
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
        .setFooter({ text: 'Your API key is stored securely and never shared' });

      const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel('Get API Key')
          .setStyle(ButtonStyle.Link)
          .setURL('https://www.worldanvil.com/developer'),
        new ButtonBuilder()
          .setCustomId('settings_back')
          .setLabel('Back to Settings')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({
        embeds: [embed],
        components: [row],
      });
    } else {
      // Connected - show world selection
      const waService = getWorldAnvilService();
      let worlds: Array<{ id: string; title: string }> = [];

      if (waService) {
        try {
          const { entities } = await waService.listWorlds();
          worlds = entities.map((w: any) => ({ id: w.id, title: w.title }));
        } catch (e) {
          console.error('[Settings] Failed to fetch World Anvil worlds:', e);
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
        );

      const components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];

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
          );

        components.push(
          new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(selectMenu)
        );
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
      );

      await interaction.editReply({
        embeds: [embed],
        components,
      });
    }
  } catch (error) {
    console.error('[Settings] World Anvil settings error:', error);
    await interaction.editReply({
      content: '❌ Failed to load World Anvil settings. Please try again.',
    });
  }
}

/**
 * /settings voice - Configure voice preferences
 */
async function handleVoiceSettings(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;

  await interaction.deferReply({ ephemeral: true });

  try {
    const settings = await getUserSettings(userId);

    const embed = new EmbedBuilder()
      .setTitle('Voice Settings')
      .setColor(0x7c3aed)
      .setDescription('Select your preferred TTS voice for FumbleBot responses.')
      .addFields({
        name: 'Current Voice',
        value: `**${settings.defaultVoice}** - ${VOICES.find((v) => v.id === settings.defaultVoice)?.description || 'Unknown'}`,
      });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('settings_voice_select')
      .setPlaceholder('Choose a voice')
      .addOptions(
        VOICES.map((voice) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(voice.name)
            .setDescription(voice.description)
            .setValue(voice.id)
            .setDefault(voice.id === settings.defaultVoice)
        )
      );

    const row1 = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(selectMenu);

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
    );

    await interaction.editReply({
      embeds: [embed],
      components: [row1, row2],
    });
  } catch (error) {
    console.error('[Settings] Voice settings error:', error);
    await interaction.editReply({
      content: '❌ Failed to load voice settings. Please try again.',
    });
  }
}

/**
 * /settings system - Set default game system
 */
async function handleSystemSettings(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;

  await interaction.deferReply({ ephemeral: true });

  try {
    const settings = await getUserSettings(userId);

    const embed = new EmbedBuilder()
      .setTitle('Game System Settings')
      .setColor(0x22c55e)
      .setDescription(
        'Select your default game system. This affects rule lookups, character generation, and dice roll formatting.'
      )
      .addFields({
        name: 'Current System',
        value: `**${GAME_SYSTEMS.find((s) => s.id === settings.defaultGameSystem)?.name || settings.defaultGameSystem}**`,
      });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('settings_system_select')
      .setPlaceholder('Choose a game system')
      .addOptions(
        GAME_SYSTEMS.map((system) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(system.name)
            .setDescription(system.description)
            .setValue(system.id)
            .setDefault(system.id === settings.defaultGameSystem)
        )
      );

    const row1 = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(selectMenu);

    const row2 = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('settings_back')
        .setLabel('Back to Settings')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({
      embeds: [embed],
      components: [row1, row2],
    });
  } catch (error) {
    console.error('[Settings] System settings error:', error);
    await interaction.editReply({
      content: '❌ Failed to load system settings. Please try again.',
    });
  }
}
