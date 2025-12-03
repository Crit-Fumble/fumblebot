/**
 * Pagination Utility for Discord Embeds
 *
 * Creates interactive embeds with Previous/Next buttons for long content.
 * Supports automatic page splitting and collector-based interaction handling.
 */

import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  type Message,
  type TextChannel,
  type ButtonInteraction,
  type InteractionCollector,
} from 'discord.js';

export interface PaginatedEmbedOptions {
  /** Title for all pages */
  title: string;
  /** Full content to paginate */
  content: string;
  /** Color for the embed (default: purple) */
  color?: number;
  /** Footer text (page info will be appended) */
  footerText?: string;
  /** Maximum characters per page (default: 3500 to leave room for formatting) */
  maxCharsPerPage?: number;
  /** Timeout for button interactions in ms (default: 5 minutes) */
  timeout?: number;
  /** Optional thumbnail URL */
  thumbnailUrl?: string;
  /** Optional image URL (only shown on first page) */
  imageUrl?: string;
  /** Optional fields to add to every page */
  fields?: { name: string; value: string; inline?: boolean }[];
  /** User ID that can interact (optional - if not set, anyone can) */
  authorId?: string;
}

export interface PaginatedEmbed {
  /** The Discord message containing the embed */
  message: Message;
  /** Total number of pages */
  totalPages: number;
  /** Current page (0-indexed) */
  currentPage: number;
  /** The collector handling button interactions */
  collector: InteractionCollector<ButtonInteraction>;
  /** Stop the pagination and remove buttons */
  stop: () => Promise<void>;
}

/**
 * Split content into pages, trying to break at paragraph boundaries
 */
function splitIntoPages(content: string, maxChars: number): string[] {
  if (content.length <= maxChars) {
    return [content];
  }

  const pages: string[] = [];
  let remaining = content;

  while (remaining.length > 0) {
    if (remaining.length <= maxChars) {
      pages.push(remaining);
      break;
    }

    // Find a good break point
    let breakPoint = maxChars;

    // Try to break at paragraph (double newline)
    const paragraphBreak = remaining.lastIndexOf('\n\n', maxChars);
    if (paragraphBreak > maxChars * 0.5) {
      breakPoint = paragraphBreak;
    } else {
      // Try to break at single newline
      const lineBreak = remaining.lastIndexOf('\n', maxChars);
      if (lineBreak > maxChars * 0.5) {
        breakPoint = lineBreak;
      } else {
        // Try to break at sentence
        const sentenceBreak = remaining.lastIndexOf('. ', maxChars);
        if (sentenceBreak > maxChars * 0.5) {
          breakPoint = sentenceBreak + 1;
        } else {
          // Try to break at space
          const spaceBreak = remaining.lastIndexOf(' ', maxChars);
          if (spaceBreak > maxChars * 0.5) {
            breakPoint = spaceBreak;
          }
          // Otherwise just hard break at maxChars
        }
      }
    }

    pages.push(remaining.slice(0, breakPoint).trim());
    remaining = remaining.slice(breakPoint).trim();
  }

  return pages;
}

/**
 * Create a paginated embed with interactive buttons
 */
export async function createPaginatedEmbed(
  channel: TextChannel,
  options: PaginatedEmbedOptions
): Promise<PaginatedEmbed | null> {
  const {
    title,
    content,
    color = 0x7c3aed,
    footerText = '',
    maxCharsPerPage = 3500,
    timeout = 5 * 60 * 1000, // 5 minutes
    thumbnailUrl,
    imageUrl,
    fields = [],
    authorId,
  } = options;

  // Split content into pages
  const pages = splitIntoPages(content, maxCharsPerPage);
  const totalPages = pages.length;

  // If only one page, no need for pagination
  if (totalPages === 1) {
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(content)
      .setColor(color)
      .setTimestamp();

    if (footerText) {
      embed.setFooter({ text: footerText });
    }
    if (thumbnailUrl) {
      embed.setThumbnail(thumbnailUrl);
    }
    if (imageUrl) {
      embed.setImage(imageUrl);
    }
    for (const field of fields) {
      embed.addFields(field);
    }

    const message = await channel.send({ embeds: [embed] });
    return null; // No pagination needed
  }

  // Build the initial embed (page 0)
  let currentPage = 0;

  const buildEmbed = (pageIndex: number): EmbedBuilder => {
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(pages[pageIndex])
      .setColor(color)
      .setTimestamp();

    const pageInfo = `Page ${pageIndex + 1}/${totalPages}`;
    embed.setFooter({ text: footerText ? `${footerText} • ${pageInfo}` : pageInfo });

    if (thumbnailUrl) {
      embed.setThumbnail(thumbnailUrl);
    }
    // Only show image on first page
    if (imageUrl && pageIndex === 0) {
      embed.setImage(imageUrl);
    }
    for (const field of fields) {
      embed.addFields(field);
    }

    return embed;
  };

  const buildButtons = (pageIndex: number): ActionRowBuilder<ButtonBuilder> => {
    const row = new ActionRowBuilder<ButtonBuilder>();

    // First page button
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('page_first')
        .setLabel('⏮')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pageIndex === 0)
    );

    // Previous button
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('page_prev')
        .setLabel('◀')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(pageIndex === 0)
    );

    // Page indicator (non-interactive)
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('page_indicator')
        .setLabel(`${pageIndex + 1} / ${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );

    // Next button
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('page_next')
        .setLabel('▶')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(pageIndex === totalPages - 1)
    );

    // Last page button
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('page_last')
        .setLabel('⏭')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pageIndex === totalPages - 1)
    );

    return row;
  };

  // Send initial message
  const message = await channel.send({
    embeds: [buildEmbed(0)],
    components: [buildButtons(0)],
  });

  // Create collector for button interactions
  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: timeout,
    filter: (interaction) => {
      // If authorId is set, only that user can interact
      if (authorId && interaction.user.id !== authorId) {
        interaction.reply({
          content: 'Only the person who requested this can use these buttons.',
          ephemeral: true,
        });
        return false;
      }
      return true;
    },
  });

  collector.on('collect', async (interaction: ButtonInteraction) => {
    const action = interaction.customId;

    switch (action) {
      case 'page_first':
        currentPage = 0;
        break;
      case 'page_prev':
        currentPage = Math.max(0, currentPage - 1);
        break;
      case 'page_next':
        currentPage = Math.min(totalPages - 1, currentPage + 1);
        break;
      case 'page_last':
        currentPage = totalPages - 1;
        break;
      default:
        return;
    }

    await interaction.update({
      embeds: [buildEmbed(currentPage)],
      components: [buildButtons(currentPage)],
    });
  });

  collector.on('end', async () => {
    // Remove buttons when collector expires
    try {
      await message.edit({
        embeds: [buildEmbed(currentPage)],
        components: [], // Remove buttons
      });
    } catch (e) {
      // Message might have been deleted
    }
  });

  const stop = async () => {
    collector.stop();
    try {
      await message.edit({
        embeds: [buildEmbed(currentPage)],
        components: [],
      });
    } catch (e) {
      // Message might have been deleted
    }
  };

  return {
    message,
    totalPages,
    currentPage,
    collector,
    stop,
  };
}

/**
 * Helper to check if content needs pagination
 */
export function needsPagination(content: string, maxChars: number = 3500): boolean {
  return content.length > maxChars;
}

/**
 * Quick helper to send a simple paginated response
 */
export async function sendPaginatedResponse(
  channel: TextChannel,
  title: string,
  content: string,
  options?: Partial<PaginatedEmbedOptions>
): Promise<Message | PaginatedEmbed | null> {
  if (!needsPagination(content)) {
    // Send simple embed without pagination
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(content)
      .setColor(options?.color ?? 0x7c3aed)
      .setTimestamp();

    if (options?.footerText) {
      embed.setFooter({ text: options.footerText });
    }

    return channel.send({ embeds: [embed] });
  }

  return createPaginatedEmbed(channel, {
    title,
    content,
    ...options,
  });
}
