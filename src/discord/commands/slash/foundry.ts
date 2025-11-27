/**
 * Foundry VTT Commands
 *
 * Discord slash commands for interacting with Foundry VTT instances
 * Version: 0.1.0 (Proof of Concept)
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  AttachmentBuilder,
} from 'discord.js';
import type { FumbleBotClient } from '../../client.js';
import { FoundryClient } from '../../../foundry/index.js';
import { getScreenshotService } from '../../../foundry/screenshot.js';
import { readFile, unlink } from 'fs/promises';
import type { CommandHandler } from '../types.js';

// POC: Hardcoded staging instance URL
// TODO: Phase 1 - Look up instance URL from database based on world/campaign
const STAGING_FOUNDRY_URL = 'http://104.131.164.164:30000';

/**
 * /foundry - Foundry VTT integration commands
 */
const foundryCommand = new SlashCommandBuilder()
  .setName('foundry')
  .setDescription('Foundry VTT integration commands (POC)')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('test')
      .setDescription('Test connection to Foundry instance')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('screenshot')
      .setDescription('Capture screenshot of Foundry VTT instance')
      .addStringOption((option) =>
        option
          .setName('type')
          .setDescription('Type of screenshot to capture')
          .setRequired(false)
          .addChoices(
            { name: 'Full View', value: 'full' },
            { name: 'Canvas Only', value: 'canvas' },
            { name: 'Sidebar Only', value: 'sidebar' }
          )
      )
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Admin-only for POC
  .setDMPermission(false); // Guild-only

/**
 * Foundry command handler
 */
async function foundryHandlerFn(
  interaction: ChatInputCommandInteraction,
  _bot: FumbleBotClient
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'test':
      await handleTest(interaction);
      break;
    case 'screenshot':
      await handleScreenshot(interaction);
      break;
    default:
      await interaction.reply({
        content: 'Unknown subcommand',
        ephemeral: true,
      });
  }
}

/**
 * Handle /foundry test command
 */
async function handleTest(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    // Create Foundry client
    const client = new FoundryClient({
      baseUrl: STAGING_FOUNDRY_URL,
      timeout: 5000,
    });

    // Test connection
    const health = await client.healthCheck();

    // Create success embed
    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Foundry Connection Test')
      .setDescription('Successfully connected to Foundry VTT instance')
      .addFields(
        { name: 'Status', value: health.status, inline: true },
        { name: 'Module Version', value: health.version, inline: true },
        { name: 'Foundry Version', value: health.foundryVersion, inline: true },
        { name: 'World ID', value: health.worldId, inline: true },
        { name: 'World Title', value: health.worldTitle, inline: true },
        { name: 'URL', value: STAGING_FOUNDRY_URL, inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    // Create error embed
    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('❌ Foundry Connection Test Failed')
      .setDescription(
        error instanceof Error ? error.message : 'Unknown error occurred'
      )
      .addFields({ name: 'URL', value: STAGING_FOUNDRY_URL, inline: false })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

/**
 * Handle /foundry screenshot command
 */
async function handleScreenshot(interaction: ChatInputCommandInteraction) {
  const type = interaction.options.getString('type') || 'full';

  await interaction.deferReply();

  try {
    const screenshotService = getScreenshotService();

    // Capture screenshot based on type
    let result;
    switch (type) {
      case 'canvas':
        result = await screenshotService.captureCanvas(STAGING_FOUNDRY_URL);
        break;
      case 'sidebar':
        result = await screenshotService.captureSidebar(STAGING_FOUNDRY_URL);
        break;
      case 'full':
      default:
        result = await screenshotService.captureScreenshot(STAGING_FOUNDRY_URL);
        break;
    }

    // Create attachment from screenshot
    const attachment = new AttachmentBuilder(result.buffer, {
      name: 'foundry-screenshot.png',
    });

    // Create embed
    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle(`📸 Foundry VTT Screenshot - ${type === 'canvas' ? 'Canvas' : type === 'sidebar' ? 'Sidebar' : 'Full View'}`)
      .setDescription(`Screenshot captured from ${STAGING_FOUNDRY_URL}`)
      .setImage('attachment://foundry-screenshot.png')
      .addFields(
        { name: 'Viewport', value: `${result.viewport.width}x${result.viewport.height}`, inline: true },
        { name: 'Type', value: type, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({
      embeds: [embed],
      files: [attachment],
    });

    // Clean up temporary file
    try {
      await unlink(result.filePath);
    } catch (error) {
      console.error('Failed to delete temp screenshot:', error);
    }
  } catch (error) {
    console.error('Screenshot error:', error);

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('❌ Screenshot Failed')
      .setDescription(
        error instanceof Error ? error.message : 'Unknown error occurred'
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

// Export commands and handler
export const foundryCommands = [foundryCommand];
export const foundryHandler = foundryHandlerFn;
