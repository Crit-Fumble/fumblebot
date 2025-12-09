/**
 * Event Commands
 * /event clone - Clone a scheduled event with a new date
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  GuildScheduledEventPrivacyLevel,
  GuildScheduledEventEntityType,
  type ChatInputCommandInteraction,
  type AutocompleteInteraction,
} from 'discord.js';
import * as chrono from 'chrono-node';
import type { FumbleBotClient } from '../../client.js';

export const eventCommands = [
  new SlashCommandBuilder()
    .setName('event')
    .setDescription('Event management commands')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('clone')
        .setDescription('Clone an existing scheduled event with a new date')
        .addStringOption((option) =>
          option
            .setName('event')
            .setDescription('The event to clone')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName('date')
            .setDescription('New date/time (e.g., "next friday at 7pm", "December 25 at 3pm")')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('list')
        .setDescription('List upcoming scheduled events')
    ),
];

export async function eventHandler(
  interaction: ChatInputCommandInteraction,
  _bot: FumbleBotClient
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'clone') {
    await handleEventClone(interaction);
  } else if (subcommand === 'list') {
    await handleEventList(interaction);
  }
}

/**
 * Handle autocomplete for event selection
 */
export async function eventAutocomplete(
  interaction: AutocompleteInteraction
): Promise<{ name: string; value: string }[]> {
  if (!interaction.guild) return [];

  try {
    const events = await interaction.guild.scheduledEvents.fetch();
    const focusedValue = interaction.options.getFocused().toLowerCase();

    return events
      .filter((event) => {
        // Filter by search term
        if (focusedValue) {
          return event.name.toLowerCase().includes(focusedValue);
        }
        return true;
      })
      .map((event) => {
        // Format with date for display
        const dateStr = event.scheduledStartAt
          ? event.scheduledStartAt.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })
          : 'No date';

        return {
          name: `${event.name} (${dateStr})`.substring(0, 100),
          value: event.id,
        };
      })
      .slice(0, 25);
  } catch (error) {
    console.error('[Event] Autocomplete error:', error);
    return [];
  }
}

async function handleEventClone(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      content: '❌ This command can only be used in a server.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  const eventId = interaction.options.getString('event', true);
  const dateInput = interaction.options.getString('date', true);

  try {
    // Fetch the original event
    const originalEvent = await interaction.guild.scheduledEvents.fetch(eventId);

    if (!originalEvent) {
      await interaction.editReply({
        content: '❌ Could not find that event. It may have been deleted.',
      });
      return;
    }

    // Parse the new date
    const parsedDate = chrono.parseDate(dateInput);

    if (!parsedDate) {
      await interaction.editReply({
        content: `❌ Could not parse "${dateInput}" as a date.\n\nTry something like:\n• "next friday at 7pm"\n• "December 25 at 3pm"\n• "in 2 weeks at 6:30pm"`,
      });
      return;
    }

    // Ensure the date is in the future
    if (parsedDate.getTime() < Date.now()) {
      await interaction.editReply({
        content: '❌ The new date must be in the future.',
      });
      return;
    }

    // Calculate end time if original had one
    let scheduledEndTime: Date | undefined;
    if (originalEvent.scheduledEndAt && originalEvent.scheduledStartAt) {
      const duration = originalEvent.scheduledEndAt.getTime() - originalEvent.scheduledStartAt.getTime();
      scheduledEndTime = new Date(parsedDate.getTime() + duration);
    }

    // Clone the event
    const newEvent = await interaction.guild.scheduledEvents.create({
      name: originalEvent.name,
      description: originalEvent.description || undefined,
      scheduledStartTime: parsedDate,
      scheduledEndTime: scheduledEndTime,
      privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
      entityType: originalEvent.entityType,
      channel: originalEvent.entityType === GuildScheduledEventEntityType.Voice ||
               originalEvent.entityType === GuildScheduledEventEntityType.StageInstance
        ? originalEvent.channelId || undefined
        : undefined,
      entityMetadata: originalEvent.entityType === GuildScheduledEventEntityType.External
        ? { location: originalEvent.entityMetadata?.location || 'Unknown' }
        : undefined,
      image: originalEvent.coverImageURL() || undefined,
    });

    // Build response embed
    const embed = new EmbedBuilder()
      .setTitle('✅ Event Cloned')
      .setDescription(`Successfully cloned **${originalEvent.name}**`)
      .setColor(0x57F287)
      .addFields(
        {
          name: '📅 Original Date',
          value: originalEvent.scheduledStartAt
            ? `<t:${Math.floor(originalEvent.scheduledStartAt.getTime() / 1000)}:F>`
            : 'Unknown',
          inline: true,
        },
        {
          name: '📅 New Date',
          value: `<t:${Math.floor(parsedDate.getTime() / 1000)}:F>`,
          inline: true,
        },
        {
          name: '🔗 Event Link',
          value: newEvent.url || 'No link available',
          inline: false,
        }
      )
      .setTimestamp();

    if (newEvent.coverImageURL()) {
      embed.setThumbnail(newEvent.coverImageURL()!);
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('[Event] Clone error:', error);
    await interaction.editReply({
      content: `❌ Failed to clone event: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

async function handleEventList(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      content: '❌ This command can only be used in a server.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  try {
    const events = await interaction.guild.scheduledEvents.fetch();

    if (events.size === 0) {
      await interaction.editReply({
        content: '📅 No scheduled events found.',
      });
      return;
    }

    // Sort by start time
    const sortedEvents = [...events.values()].sort((a, b) => {
      const aTime = a.scheduledStartAt?.getTime() || 0;
      const bTime = b.scheduledStartAt?.getTime() || 0;
      return aTime - bTime;
    });

    const embed = new EmbedBuilder()
      .setTitle('📅 Scheduled Events')
      .setColor(0x5865F2)
      .setDescription(
        sortedEvents
          .slice(0, 10)
          .map((event, i) => {
            const timestamp = event.scheduledStartAt
              ? `<t:${Math.floor(event.scheduledStartAt.getTime() / 1000)}:R>`
              : 'No date';
            const location = event.entityMetadata?.location || event.channel?.name || 'Unknown';
            return `**${i + 1}. ${event.name}**\n└ ${timestamp} • ${location}`;
          })
          .join('\n\n')
      )
      .setFooter({
        text: `${events.size} total event${events.size !== 1 ? 's' : ''}`,
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('[Event] List error:', error);
    await interaction.editReply({
      content: `❌ Failed to list events: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}
