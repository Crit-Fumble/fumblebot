/**
 * Help Command
 * Shows available commands based on user permissions
 *
 * Public commands are shown to all users.
 * Admin-only commands (expensive/untested) are only shown to admins.
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { FumbleBotClient } from '../../client.js';
import type { CommandHandler } from '../types.js';
import { isAdmin } from '../../../../config.js';

/**
 * Command information for help display
 */
interface CommandInfo {
  name: string;
  description: string;
  usage?: string;
  subcommands?: string[];
  adminOnly: boolean;
}

/**
 * All available commands with their metadata
 */
const COMMANDS: CommandInfo[] = [
  // Public commands - available to all users
  {
    name: 'roll',
    description: 'Roll dice using standard notation (2d6+3, 1d20, etc.)',
    usage: '/roll dice:2d6+3 [label:Attack] [private:true]',
    adminOnly: false,
  },
  {
    name: 'settings',
    description: 'Configure your FumbleBot preferences',
    subcommands: ['view', 'worldanvil', 'voice', 'system'],
    adminOnly: false,
  },
  {
    name: 'character',
    description: 'Manage your characters for roleplay',
    subcommands: ['create', 'list', 'view', 'select', 'delete', 'avatar'],
    adminOnly: false,
  },
  {
    name: 'ic',
    description: 'In-character roleplay commands',
    subcommands: ['say', 'do', 'move', 'ooc'],
    adminOnly: false,
  },
  {
    name: 'timestamp',
    description: 'Convert natural language dates to Discord timestamps',
    usage: '/timestamp input:"next friday at 7pm"',
    adminOnly: false,
  },
  {
    name: 'adventure',
    description: 'MUD-style text adventure in Discord',
    subcommands: ['create', 'join', 'leave', 'do', 'say', 'emote', 'status', 'history', 'end', 'list'],
    adminOnly: false,
  },

  // Admin-only commands - expensive or untested features
  {
    name: 'voice',
    description: 'Voice transcription and AI assistant',
    subcommands: ['transcribe', 'assistant', 'end'],
    adminOnly: true,
  },
  {
    name: 'write',
    description: 'Generate text using AI (Claude)',
    usage: '/write prompt:"Write a tavern description" [style:fantasy] [length:medium]',
    adminOnly: true,
  },
  {
    name: 'imagine',
    description: 'Generate images using AI (DALL-E)',
    usage: '/imagine prompt:"A dragon perched on a castle"',
    adminOnly: true,
  },
  {
    name: 'event',
    description: 'Clone and manage Discord scheduled events',
    subcommands: ['clone', 'list'],
    adminOnly: true,
  },
  {
    name: 'audio',
    description: 'Play audio files in voice channels',
    subcommands: ['play', 'pause', 'resume', 'stop', 'skip', 'queue', 'volume'],
    adminOnly: true,
  },
];

export const helpCommands = [
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show available FumbleBot commands')
    .setDMPermission(true)
    .addStringOption((option) =>
      option
        .setName('command')
        .setDescription('Get detailed help for a specific command')
        .setRequired(false)
        .addChoices(
          ...COMMANDS.map((cmd) => ({
            name: cmd.name,
            value: cmd.name,
          }))
        )
    ),
];

export const helpHandler: CommandHandler = async (
  interaction: ChatInputCommandInteraction,
  _bot: FumbleBotClient
): Promise<void> => {
  const specificCommand = interaction.options.getString('command');
  const userIsAdmin = isAdmin(interaction.user.id);

  if (specificCommand) {
    await showCommandHelp(interaction, specificCommand, userIsAdmin);
  } else {
    await showAllCommands(interaction, userIsAdmin);
  }
};

/**
 * Show help for all available commands
 */
async function showAllCommands(
  interaction: ChatInputCommandInteraction,
  userIsAdmin: boolean
): Promise<void> {
  const publicCommands = COMMANDS.filter((cmd) => !cmd.adminOnly);
  const adminCommands = COMMANDS.filter((cmd) => cmd.adminOnly);

  const embed = new EmbedBuilder()
    .setTitle('FumbleBot Commands')
    .setColor(0x7c3aed)
    .setDescription(
      'Your AI-powered TTRPG companion for Discord.\n\n' +
      'Use `/help command:<name>` for detailed information about a specific command.'
    );

  // Public commands section
  const publicList = publicCommands
    .map((cmd) => `\`/${cmd.name}\` - ${cmd.description}`)
    .join('\n');

  embed.addFields({
    name: 'Commands',
    value: publicList,
    inline: false,
  });

  // Admin commands section (only shown to admins)
  if (userIsAdmin && adminCommands.length > 0) {
    const adminList = adminCommands
      .map((cmd) => `\`/${cmd.name}\` - ${cmd.description}`)
      .join('\n');

    embed.addFields({
      name: 'Admin Commands',
      value: adminList,
      inline: false,
    });
  }

  // Footer with additional info
  embed.addFields({
    name: 'Need Help?',
    value:
      '**Mention FumbleBot** to chat about TTRPG rules and lore\n' +
      '**World Anvil:** Link your account with `/settings worldanvil`\n' +
      '**Report Issues:** [GitHub](https://github.com/anthropics/claude-code/issues)',
    inline: false,
  });

  embed.setFooter({
    text: userIsAdmin
      ? 'You have admin access to all commands'
      : 'Some commands require admin access',
  });

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}

/**
 * Show detailed help for a specific command
 */
async function showCommandHelp(
  interaction: ChatInputCommandInteraction,
  commandName: string,
  userIsAdmin: boolean
): Promise<void> {
  const command = COMMANDS.find((cmd) => cmd.name === commandName);

  if (!command) {
    await interaction.reply({
      content: `Unknown command: \`${commandName}\``,
      ephemeral: true,
    });
    return;
  }

  // Check if user can access this command
  if (command.adminOnly && !userIsAdmin) {
    await interaction.reply({
      content: `The \`/${commandName}\` command requires admin access.`,
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`/${command.name}`)
    .setColor(command.adminOnly ? 0xef4444 : 0x22c55e)
    .setDescription(command.description);

  if (command.usage) {
    embed.addFields({
      name: 'Usage',
      value: `\`${command.usage}\``,
      inline: false,
    });
  }

  if (command.subcommands && command.subcommands.length > 0) {
    embed.addFields({
      name: 'Subcommands',
      value: command.subcommands.map((sub) => `\`${sub}\``).join(', '),
      inline: false,
    });
  }

  if (command.adminOnly) {
    embed.setFooter({ text: 'Admin-only command' });
  }

  // Add command-specific help
  const additionalHelp = getAdditionalHelp(commandName);
  if (additionalHelp) {
    embed.addFields({
      name: 'Details',
      value: additionalHelp,
      inline: false,
    });
  }

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}

/**
 * Get additional help text for specific commands
 */
function getAdditionalHelp(commandName: string): string | null {
  const helpText: Record<string, string> = {
    roll:
      '**Dice Notation:**\n' +
      '- `2d6` - Roll 2 six-sided dice\n' +
      '- `1d20+5` - Roll d20 and add 5\n' +
      '- `4d6kh3` - Roll 4d6, keep highest 3\n' +
      '- `2d20kl1` - Roll 2d20, keep lowest (disadvantage)',
    character:
      '**Character System:**\n' +
      '- Create characters with name, description, and avatar\n' +
      '- Select active character for `/ic` commands\n' +
      '- Characters are stored per-server',
    ic:
      '**In-Character Commands:**\n' +
      '- `/ic say` - Speak as your character\n' +
      '- `/ic do` - Describe an action\n' +
      '- `/ic move` - Movement description\n' +
      '- `/ic ooc` - Out-of-character message',
    adventure:
      '**Text Adventure:**\n' +
      '- Create collaborative text adventures\n' +
      '- Multiple players can join\n' +
      '- AI narrator responds to actions\n' +
      '- History tracks the story',
    voice:
      '**Voice Features:**\n' +
      '- Real-time transcription in voice channels\n' +
      '- AI assistant responds to "Hey FumbleBot"\n' +
      '- Transcripts sent via DM when session ends',
    timestamp:
      '**Supported Formats:**\n' +
      '- "tomorrow at 3pm"\n' +
      '- "next friday at 7:30pm"\n' +
      '- "in 2 hours"\n' +
      '- "December 25th at noon"',
    settings:
      '**Settings Options:**\n' +
      '- **Voice:** Choose TTS voice for FumbleBot\n' +
      '- **System:** Set default game system (5e, PF2e, etc.)\n' +
      '- **World Anvil:** Link your campaign worlds',
  };

  return helpText[commandName] || null;
}
