/**
 * Terminal Output Formatter
 * Formats terminal output for Discord embeds
 */

import { EmbedBuilder } from 'discord.js';
import type { TerminalExecResult, TerminalSession } from './terminal-service.js';
import type {
  Adventure,
  AdventureMessage,
  AdventureMessageType,
  AdventureStatus,
} from './adventure-service.js';

// Discord embed limits
const MAX_DESCRIPTION_LENGTH = 4096;
const MAX_FIELD_VALUE_LENGTH = 1024;
const CODE_BLOCK_OVERHEAD = 8; // ``` + newline + newline + ```

/**
 * Truncate text with ellipsis indicator
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Format terminal execution result as Discord embed
 */
export function formatTerminalOutput(result: TerminalExecResult): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTimestamp();

  // Set color based on exit code
  if (result.exitCode === 0) {
    embed.setColor(0x57F287); // Green
  } else {
    embed.setColor(0xED4245); // Red
  }

  // Format stdout
  if (result.stdout) {
    const maxOutput = MAX_DESCRIPTION_LENGTH - CODE_BLOCK_OVERHEAD;
    const output = truncate(result.stdout.trim(), maxOutput);
    embed.setDescription(`\`\`\`\n${output}\n\`\`\``);
  } else if (!result.stderr) {
    embed.setDescription('*No output*');
  }

  // Format stderr as field if present
  if (result.stderr) {
    const maxError = MAX_FIELD_VALUE_LENGTH - CODE_BLOCK_OVERHEAD;
    const error = truncate(result.stderr.trim(), maxError);
    embed.addFields({
      name: 'Errors',
      value: `\`\`\`\n${error}\n\`\`\``,
      inline: false,
    });
  }

  // Footer with execution info
  const footerParts: string[] = [];
  footerParts.push(`Exit: ${result.exitCode}`);
  if (result.executionTime !== undefined) {
    footerParts.push(`${result.executionTime}ms`);
  }
  embed.setFooter({ text: footerParts.join(' | ') });

  return embed;
}

/**
 * Format terminal status as Discord embed
 */
export function formatTerminalStatus(
  session: TerminalSession | null,
  coreStatus?: { exists: boolean; status?: string; uptime?: number }
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('Terminal Status')
    .setTimestamp();

  if (!session && (!coreStatus || !coreStatus.exists)) {
    embed
      .setColor(0x95A5A6) // Gray
      .setDescription('No terminal session active in this channel.')
      .addFields({
        name: 'Get Started',
        value: 'Use `/adventure start` to start a terminal session.',
        inline: false,
      });
    return embed;
  }

  // Terminal is running
  embed.setColor(0x57F287); // Green

  if (session) {
    embed.addFields(
      {
        name: 'Container ID',
        value: `\`${session.containerId.slice(0, 12)}\``,
        inline: true,
      },
      {
        name: 'Started By',
        value: `<@${session.startedBy}>`,
        inline: true,
      },
      {
        name: 'Started At',
        value: `<t:${Math.floor(session.startedAt.getTime() / 1000)}:R>`,
        inline: true,
      }
    );
  }

  if (coreStatus?.uptime !== undefined) {
    const minutes = Math.floor(coreStatus.uptime / 60);
    const seconds = coreStatus.uptime % 60;
    embed.addFields({
      name: 'Uptime',
      value: minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`,
      inline: true,
    });
  }

  embed.setDescription('Terminal session is running. Use `/adventure exec <command>` to run commands.');

  return embed;
}

/**
 * Format session list as Discord embed
 */
export function formatSessionList(sessions: TerminalSession[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('Active Terminals')
    .setColor(0x5865F2) // Discord blue
    .setTimestamp();

  if (sessions.length === 0) {
    embed.setDescription('No active terminal sessions in this server.');
    return embed;
  }

  const sessionList = sessions
    .map((s, i) => {
      const startedAt = Math.floor(s.startedAt.getTime() / 1000);
      return `${i + 1}. <#${s.channelId}> - Started <t:${startedAt}:R> by <@${s.startedBy}>`;
    })
    .join('\n');

  embed
    .setDescription(sessionList)
    .setFooter({ text: `${sessions.length} active session${sessions.length === 1 ? '' : 's'}` });

  return embed;
}

// =============================================================================
// Adventure API Formatters
// =============================================================================

/**
 * Get status color for adventure
 */
function getStatusColor(status: AdventureStatus): number {
  switch (status) {
    case 'active':
      return 0x57F287; // Green
    case 'waiting':
      return 0xFEE75C; // Yellow
    case 'paused':
      return 0xEB459E; // Pink
    case 'ended':
      return 0x95A5A6; // Gray
    default:
      return 0x5865F2; // Discord blue
  }
}

/**
 * Get message type prefix for display
 */
function getMessagePrefix(type: AdventureMessageType): string {
  switch (type) {
    case 'action':
      return '*';
    case 'say':
      return '"';
    case 'emote':
      return '~';
    case 'narrative':
      return '>';
    case 'system':
      return '[';
    default:
      return '';
  }
}

/**
 * Get message type suffix for display
 */
function getMessageSuffix(type: AdventureMessageType): string {
  switch (type) {
    case 'say':
      return '"';
    case 'system':
      return ']';
    default:
      return '';
  }
}

/**
 * Format an adventure message for Discord
 */
export function formatAdventureMessage(message: AdventureMessage): string {
  const prefix = getMessagePrefix(message.type);
  const suffix = getMessageSuffix(message.type);

  switch (message.type) {
    case 'action':
      return `*${message.playerName} ${message.content}*`;
    case 'say':
      return `**${message.playerName}:** "${message.content}"`;
    case 'emote':
      return `*${message.playerName} ${message.content}*`;
    case 'narrative':
      return `> ${message.content}`;
    case 'system':
      return `[${message.content}]`;
    default:
      return `${prefix}${message.content}${suffix}`;
  }
}

/**
 * Format adventure status as Discord embed
 */
export function formatAdventureStatus(adventure: Adventure | null): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTimestamp();

  if (!adventure) {
    embed
      .setTitle('Adventure Status')
      .setColor(0x95A5A6) // Gray
      .setDescription('No adventure session in this channel.')
      .addFields({
        name: 'Get Started',
        value: 'Use `/adventure create <name>` to start a new adventure.',
        inline: false,
      });
    return embed;
  }

  embed
    .setTitle(adventure.name)
    .setColor(getStatusColor(adventure.status));

  if (adventure.description) {
    embed.setDescription(adventure.description);
  }

  // Status field
  const statusText = adventure.status.charAt(0).toUpperCase() + adventure.status.slice(1);
  embed.addFields({
    name: 'Status',
    value: statusText,
    inline: true,
  });

  // Players field
  if (adventure.players && adventure.players.length > 0) {
    const playerList = adventure.players
      .map((p) => {
        const roleIcon = p.role === 'dm' ? '**DM**' : p.role === 'bot' ? '**Bot**' : '';
        return `${p.name} ${roleIcon}`.trim();
      })
      .join(', ');

    embed.addFields({
      name: `Players (${adventure.players.length})`,
      value: playerList,
      inline: true,
    });
  } else {
    embed.addFields({
      name: 'Players',
      value: `${adventure.playerCount} player${adventure.playerCount !== 1 ? 's' : ''}`,
      inline: true,
    });
  }

  // Created/Started times
  if (adventure.startedAt) {
    const startedTimestamp = Math.floor(new Date(adventure.startedAt).getTime() / 1000);
    embed.addFields({
      name: 'Started',
      value: `<t:${startedTimestamp}:R>`,
      inline: true,
    });
  } else {
    const createdTimestamp = Math.floor(new Date(adventure.createdAt).getTime() / 1000);
    embed.addFields({
      name: 'Created',
      value: `<t:${createdTimestamp}:R>`,
      inline: true,
    });
  }

  // History count
  if (adventure.historyCount) {
    embed.addFields({
      name: 'Messages',
      value: adventure.historyCount.toString(),
      inline: true,
    });
  }

  // Footer with ID
  embed.setFooter({ text: `Adventure ID: ${adventure.id}` });

  return embed;
}

/**
 * Format adventure history as Discord embed
 */
export function formatAdventureHistory(
  adventure: Adventure,
  messages: AdventureMessage[]
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`${adventure.name} - Recent History`)
    .setColor(getStatusColor(adventure.status))
    .setTimestamp();

  if (messages.length === 0) {
    embed.setDescription('*No messages yet. Start your adventure!*');
    return embed;
  }

  // Format messages, most recent last
  const formattedMessages = messages
    .slice(-15) // Last 15 messages
    .map((msg) => formatAdventureMessage(msg))
    .join('\n');

  // Truncate if too long
  const maxLength = MAX_DESCRIPTION_LENGTH - 50;
  const description = formattedMessages.length > maxLength
    ? '...\n' + formattedMessages.slice(-maxLength)
    : formattedMessages;

  embed.setDescription(description);
  embed.setFooter({ text: `${messages.length} total messages` });

  return embed;
}
