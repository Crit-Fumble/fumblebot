/**
 * Timestamp Command
 * Convert natural language dates to Discord timestamp formats
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import * as chrono from 'chrono-node';
import type { FumbleBotClient } from '../../client.js';

export const timestampCommands = [
  new SlashCommandBuilder()
    .setName('timestamp')
    .setDescription('Convert a date/time to Discord timestamp formats')
    .addStringOption((option) =>
      option
        .setName('input')
        .setDescription('Date/time in natural language (e.g., "next friday at 7pm", "in 2 hours")')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('timezone')
        .setDescription('Timezone (e.g., "EST", "PST", "UTC") - defaults to your local time')
        .setRequired(false)
    ),
];

export async function timestampHandler(
  interaction: ChatInputCommandInteraction,
  _bot: FumbleBotClient
): Promise<void> {
  const input = interaction.options.getString('input', true);
  const timezone = interaction.options.getString('timezone');

  // Parse the date with chrono-node
  const referenceDate = new Date();
  const parseOptions: chrono.ParsingOption = {};

  // Handle timezone if provided
  if (timezone) {
    parseOptions.forwardDate = true;
  }

  const parsed = chrono.parseDate(input, referenceDate, parseOptions);

  if (!parsed) {
    await interaction.reply({
      content: `❌ Could not parse "${input}" as a date/time. Try something like:\n` +
        '• "tomorrow at 3pm"\n' +
        '• "next friday at 7:30pm"\n' +
        '• "in 2 hours"\n' +
        '• "December 25th at noon"\n' +
        '• "2024-12-31 23:59"',
      ephemeral: true,
    });
    return;
  }

  const unix = Math.floor(parsed.getTime() / 1000);

  // Generate all Discord timestamp formats
  const formats = [
    { format: 't', name: 'Short Time', example: `<t:${unix}:t>` },
    { format: 'T', name: 'Long Time', example: `<t:${unix}:T>` },
    { format: 'd', name: 'Short Date', example: `<t:${unix}:d>` },
    { format: 'D', name: 'Long Date', example: `<t:${unix}:D>` },
    { format: 'f', name: 'Short Date/Time', example: `<t:${unix}:f>` },
    { format: 'F', name: 'Long Date/Time', example: `<t:${unix}:F>` },
    { format: 'R', name: 'Relative', example: `<t:${unix}:R>` },
  ];

  const embed = new EmbedBuilder()
    .setTitle('🕐 Discord Timestamps')
    .setDescription(
      `Parsed: **${input}**\n` +
      `Date: ${parsed.toLocaleString()}\n` +
      `Unix: \`${unix}\``
    )
    .setColor(0x5865F2)
    .addFields(
      formats.map((f) => ({
        name: `${f.name} (\`:${f.format}\`)`,
        value: `${f.example} → \`${f.example}\``,
        inline: true,
      }))
    )
    .setFooter({
      text: 'Click on a timestamp to copy the code',
    });

  await interaction.reply({
    embeds: [embed],
  });
}
