/**
 * FumbleBot Discord Interactive Components
 *
 * Builders for embeds, buttons, select menus, and modals
 * that make slash command responses interactive and visually appealing.
 */

import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ColorResolvable,
} from 'discord.js';

// ===========================================
// Color Palette
// ===========================================

export const Colors = {
  PRIMARY: 0x5865f2 as ColorResolvable, // Discord Blurple
  SUCCESS: 0x57f287 as ColorResolvable, // Green
  WARNING: 0xfee75c as ColorResolvable, // Yellow
  DANGER: 0xed4245 as ColorResolvable, // Red
  INFO: 0x5865f2 as ColorResolvable, // Blue
  FUMBLE: 0xff6b6b as ColorResolvable, // FumbleBot Red
  CRIT: 0x00ff00 as ColorResolvable, // Critical Green
} as const;

// ===========================================
// Campaign Embeds
// ===========================================

export interface CampaignData {
  id: string;
  name: string;
  description?: string | null;
  systemTitle: string;
  systemIcon?: string | null;
  memberCount: number;
  characterCount: number;
  sessionCount: number;
  status: 'active' | 'idle' | 'archived';
  createdAt: Date;
}

/**
 * Campaign list embed with summary cards
 */
export function buildCampaignListEmbed(campaigns: CampaignData[]) {
  const embed = new EmbedBuilder()
    .setTitle('📜 Your Campaigns')
    .setColor(Colors.PRIMARY)
    .setTimestamp();

  if (campaigns.length === 0) {
    embed.setDescription(
      'No campaigns found in this server.\nUse `/fumble campaign create` to start one!'
    );
    return { embeds: [embed] };
  }

  for (const campaign of campaigns.slice(0, 10)) {
    const statusEmoji =
      campaign.status === 'active' ? '🟢' : campaign.status === 'idle' ? '🟡' : '⚫';
    embed.addFields({
      name: `${statusEmoji} ${campaign.name}`,
      value: [
        campaign.description || '_No description_',
        `**System:** ${campaign.systemTitle}`,
        `**Members:** ${campaign.memberCount} · **Characters:** ${campaign.characterCount} · **Sessions:** ${campaign.sessionCount}`,
      ].join('\n'),
      inline: false,
    });
  }

  if (campaigns.length > 10) {
    embed.setFooter({ text: `Showing 10 of ${campaigns.length} campaigns` });
  }

  return { embeds: [embed] };
}

/**
 * Detailed campaign info embed with action buttons
 */
export function buildCampaignInfoEmbed(campaign: CampaignData, isAdmin: boolean) {
  const statusColors = {
    active: Colors.SUCCESS,
    idle: Colors.WARNING,
    archived: Colors.DANGER,
  };

  const embed = new EmbedBuilder()
    .setTitle(campaign.name)
    .setDescription(campaign.description || '_No description set_')
    .setColor(statusColors[campaign.status])
    .addFields(
      { name: 'Game System', value: campaign.systemTitle, inline: true },
      { name: 'Status', value: campaign.status.toUpperCase(), inline: true },
      { name: '\u200B', value: '\u200B', inline: true },
      { name: 'Members', value: campaign.memberCount.toString(), inline: true },
      { name: 'Characters', value: campaign.characterCount.toString(), inline: true },
      { name: 'Sessions', value: campaign.sessionCount.toString(), inline: true }
    )
    .setTimestamp(campaign.createdAt)
    .setFooter({ text: 'Campaign created' });

  if (campaign.systemIcon) {
    embed.setThumbnail(campaign.systemIcon);
  }

  // Action buttons
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`campaign:join:${campaign.id}`)
      .setLabel('Join Campaign')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('👋'),
    new ButtonBuilder()
      .setCustomId(`campaign:characters:${campaign.id}`)
      .setLabel('View Characters')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🧙'),
    new ButtonBuilder()
      .setCustomId(`campaign:sessions:${campaign.id}`)
      .setLabel('Session History')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📖')
  );

  // Admin-only buttons
  if (isAdmin) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`campaign:settings:${campaign.id}`)
        .setLabel('Settings')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⚙️')
    );
  }

  return { embeds: [embed], components: [row] };
}

// ===========================================
// Character Embeds
// ===========================================

export interface CharacterData {
  id: string;
  name: string;
  type: 'pc' | 'npc' | 'familiar' | 'companion' | 'monster';
  avatarUrl?: string | null;
  ownerName: string;
  campaignName: string;
  isActive: boolean;
}

/**
 * Character list with filter buttons
 */
export function buildCharacterListEmbed(characters: CharacterData[], filter: string = 'all') {
  const typeEmojis = {
    pc: '🧙',
    npc: '👤',
    familiar: '🐱',
    companion: '🐺',
    monster: '👹',
  };

  const embed = new EmbedBuilder()
    .setTitle('🧙 Characters')
    .setColor(Colors.PRIMARY)
    .setTimestamp();

  const filtered = filter === 'all' ? characters : characters.filter((c) => c.type === filter);

  if (filtered.length === 0) {
    embed.setDescription('No characters found matching this filter.');
  } else {
    for (const char of filtered.slice(0, 15)) {
      const emoji = typeEmojis[char.type];
      const status = char.isActive ? '' : ' _(inactive)_';
      embed.addFields({
        name: `${emoji} ${char.name}${status}`,
        value: `**Owner:** ${char.ownerName}\n**Campaign:** ${char.campaignName}`,
        inline: true,
      });
    }
  }

  // Filter buttons
  const filterRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('char:filter:all')
      .setLabel('All')
      .setStyle(filter === 'all' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('char:filter:pc')
      .setLabel('PCs')
      .setStyle(filter === 'pc' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setEmoji('🧙'),
    new ButtonBuilder()
      .setCustomId('char:filter:npc')
      .setLabel('NPCs')
      .setStyle(filter === 'npc' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setEmoji('👤'),
    new ButtonBuilder()
      .setCustomId('char:filter:companion')
      .setLabel('Companions')
      .setStyle(filter === 'companion' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setEmoji('🐺')
  );

  return { embeds: [embed], components: [filterRow] };
}

/**
 * Character sheet summary embed
 */
export function buildCharacterSheetEmbed(
  character: CharacterData & {
    level?: number;
    class?: string;
    hp?: { current: number; max: number };
    ac?: number;
  }
) {
  const embed = new EmbedBuilder()
    .setTitle(character.name)
    .setColor(Colors.PRIMARY)
    .setDescription(`**${character.type.toUpperCase()}** in ${character.campaignName}`);

  if (character.avatarUrl) {
    embed.setThumbnail(character.avatarUrl);
  }

  if (character.level && character.class) {
    embed.addFields({ name: 'Class & Level', value: `Level ${character.level} ${character.class}`, inline: true });
  }

  if (character.hp) {
    const hpBar = buildProgressBar(character.hp.current, character.hp.max);
    embed.addFields({ name: 'Hit Points', value: `${hpBar} ${character.hp.current}/${character.hp.max}`, inline: true });
  }

  if (character.ac) {
    embed.addFields({ name: 'Armor Class', value: character.ac.toString(), inline: true });
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`char:select:${character.id}`)
      .setLabel('Set as Active')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`char:sheet:${character.id}`)
      .setLabel('Full Sheet')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`char:speak:${character.id}`)
      .setLabel('Speak As')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('💬')
  );

  return { embeds: [embed], components: [row] };
}

// ===========================================
// Dice Roll Embeds
// ===========================================

export interface RollResult {
  notation: string;
  rolls: number[];
  total: number;
  isCrit: boolean;
  isFumble: boolean;
  label?: string;
  characterName?: string;
  isHidden?: boolean;
}

/**
 * Dice roll result embed with visual flair
 */
export function buildRollEmbed(result: RollResult, rollerName: string) {
  let color: ColorResolvable = Colors.PRIMARY;
  let title = '🎲 Dice Roll';

  if (result.isCrit) {
    color = Colors.CRIT;
    title = '✨ CRITICAL HIT! ✨';
  } else if (result.isFumble) {
    color = Colors.FUMBLE;
    title = '💀 FUMBLE! 💀';
  }

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setTimestamp();

  if (result.characterName) {
    embed.setAuthor({ name: result.characterName });
  }

  // Roll details
  const rollsDisplay = result.rolls.map((r) => `\`${r}\``).join(' + ');
  embed.addFields(
    { name: 'Notation', value: `\`${result.notation}\``, inline: true },
    { name: 'Rolls', value: rollsDisplay, inline: true },
    { name: 'Total', value: `**${result.total}**`, inline: true }
  );

  if (result.label) {
    embed.setDescription(`*${result.label}*`);
  }

  embed.setFooter({ text: `Rolled by ${rollerName}` });

  // Quick roll buttons
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`roll:again:${result.notation}`)
      .setLabel('Roll Again')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🎲'),
    new ButtonBuilder()
      .setCustomId('roll:d20')
      .setLabel('d20')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('roll:2d6')
      .setLabel('2d6')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('roll:custom')
      .setLabel('Custom')
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

// ===========================================
// Session Embeds
// ===========================================

export interface SessionData {
  id: string;
  name?: string | null;
  campaignName: string;
  status: 'active' | 'paused' | 'ended';
  startedAt: Date;
  endedAt?: Date | null;
  messageCount: number;
  participantCount: number;
}

/**
 * Active session status embed
 */
export function buildSessionStatusEmbed(session: SessionData) {
  const statusColors = {
    active: Colors.SUCCESS,
    paused: Colors.WARNING,
    ended: Colors.DANGER,
  };

  const statusEmoji = {
    active: '🟢 LIVE',
    paused: '⏸️ PAUSED',
    ended: '🔴 ENDED',
  };

  const embed = new EmbedBuilder()
    .setTitle(session.name || 'Game Session')
    .setDescription(`**Campaign:** ${session.campaignName}`)
    .setColor(statusColors[session.status])
    .addFields(
      { name: 'Status', value: statusEmoji[session.status], inline: true },
      { name: 'Messages', value: session.messageCount.toString(), inline: true },
      { name: 'Participants', value: session.participantCount.toString(), inline: true }
    )
    .setTimestamp(session.startedAt)
    .setFooter({ text: 'Session started' });

  // Duration calculation
  const endTime = session.endedAt || new Date();
  const duration = Math.floor((endTime.getTime() - session.startedAt.getTime()) / 1000);
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  embed.addFields({ name: 'Duration', value: `${hours}h ${minutes}m`, inline: true });

  // Control buttons based on status
  const row = new ActionRowBuilder<ButtonBuilder>();

  if (session.status === 'active') {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`session:pause:${session.id}`)
        .setLabel('Pause')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⏸️'),
      new ButtonBuilder()
        .setCustomId(`session:end:${session.id}`)
        .setLabel('End Session')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🛑')
    );
  } else if (session.status === 'paused') {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`session:resume:${session.id}`)
        .setLabel('Resume')
        .setStyle(ButtonStyle.Success)
        .setEmoji('▶️'),
      new ButtonBuilder()
        .setCustomId(`session:end:${session.id}`)
        .setLabel('End Session')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🛑')
    );
  }

  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`session:summary:${session.id}`)
      .setLabel('View Summary')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📝')
  );

  return { embeds: [embed], components: [row] };
}

// ===========================================
// Select Menus
// ===========================================

/**
 * Campaign selection dropdown
 */
export function buildCampaignSelectMenu(
  campaigns: Array<{ id: string; name: string; systemTitle: string }>,
  placeholder: string = 'Select a campaign...'
) {
  const select = new StringSelectMenuBuilder()
    .setCustomId('select:campaign')
    .setPlaceholder(placeholder)
    .addOptions(
      campaigns.slice(0, 25).map((c) => ({
        label: c.name,
        description: c.systemTitle,
        value: c.id,
        emoji: '📜',
      }))
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

/**
 * Character selection dropdown
 */
export function buildCharacterSelectMenu(
  characters: Array<{ id: string; name: string; type: string }>,
  placeholder: string = 'Select a character...'
) {
  const typeEmojis: Record<string, string> = {
    pc: '🧙',
    npc: '👤',
    familiar: '🐱',
    companion: '🐺',
    monster: '👹',
  };

  const select = new StringSelectMenuBuilder()
    .setCustomId('select:character')
    .setPlaceholder(placeholder)
    .addOptions(
      characters.slice(0, 25).map((c) => ({
        label: c.name,
        description: c.type.toUpperCase(),
        value: c.id,
        emoji: typeEmojis[c.type] || '👤',
      }))
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

/**
 * Game system selection dropdown
 */
export function buildSystemSelectMenu(
  systems: Array<{ id: string; title: string; description?: string | null }>
) {
  const select = new StringSelectMenuBuilder()
    .setCustomId('select:system')
    .setPlaceholder('Select a game system...')
    .addOptions(
      systems.slice(0, 25).map((s) => ({
        label: s.title,
        description: s.description?.slice(0, 100) || undefined,
        value: s.id,
        emoji: '🎮',
      }))
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

// ===========================================
// Modals
// ===========================================

/**
 * Create campaign modal
 */
export function buildCreateCampaignModal() {
  return new ModalBuilder()
    .setCustomId('modal:create-campaign')
    .setTitle('Create New Campaign')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('name')
          .setLabel('Campaign Name')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g., Curse of Strahd')
          .setRequired(true)
          .setMaxLength(100)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('description')
          .setLabel('Description')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Brief description of your campaign...')
          .setRequired(false)
          .setMaxLength(1000)
      )
    );
}

/**
 * Create character modal
 */
export function buildCreateCharacterModal(campaignId: string) {
  return new ModalBuilder()
    .setCustomId(`modal:create-character:${campaignId}`)
    .setTitle('Create New Character')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('name')
          .setLabel('Character Name')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('description')
          .setLabel('Brief Description')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('A brief description of your character...')
          .setRequired(false)
          .setMaxLength(500)
      )
    );
}

/**
 * Custom dice roll modal
 */
export function buildCustomRollModal() {
  return new ModalBuilder()
    .setCustomId('modal:custom-roll')
    .setTitle('Custom Dice Roll')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('notation')
          .setLabel('Dice Notation')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g., 2d20+5, 4d6kh3, 1d100')
          .setRequired(true)
          .setMaxLength(50)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('label')
          .setLabel('What is this roll for?')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g., Attack roll, Stealth check')
          .setRequired(false)
          .setMaxLength(100)
      )
    );
}

/**
 * In-character speech modal
 */
export function buildSpeakAsModal(characterName: string, characterId: string) {
  return new ModalBuilder()
    .setCustomId(`modal:speak:${characterId}`)
    .setTitle(`Speak as ${characterName}`)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('message')
          .setLabel('What does your character say?')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(2000)
      )
    );
}

/**
 * Session start modal
 */
export function buildStartSessionModal(campaignId: string) {
  return new ModalBuilder()
    .setCustomId(`modal:start-session:${campaignId}`)
    .setTitle('Start New Session')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('name')
          .setLabel('Session Name (Optional)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g., Session 12: The Dragon\'s Lair')
          .setRequired(false)
          .setMaxLength(100)
      )
    );
}

// ===========================================
// Utility Functions
// ===========================================

/**
 * Build a text-based progress bar
 */
function buildProgressBar(current: number, max: number, length: number = 10): string {
  const percentage = Math.min(Math.max(current / max, 0), 1);
  const filled = Math.round(percentage * length);
  const empty = length - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}

/**
 * Confirmation buttons for destructive actions
 */
export function buildConfirmationButtons(action: string, targetId: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`confirm:${action}:${targetId}`)
      .setLabel('Confirm')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`cancel:${action}:${targetId}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
  );
}

/**
 * Pagination buttons
 */
export function buildPaginationButtons(currentPage: number, totalPages: number, prefix: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${prefix}:first`)
      .setLabel('«')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage <= 1),
    new ButtonBuilder()
      .setCustomId(`${prefix}:prev`)
      .setLabel('‹')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage <= 1),
    new ButtonBuilder()
      .setCustomId(`${prefix}:page`)
      .setLabel(`${currentPage} / ${totalPages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`${prefix}:next`)
      .setLabel('›')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage >= totalPages),
    new ButtonBuilder()
      .setCustomId(`${prefix}:last`)
      .setLabel('»')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage >= totalPages)
  );
}
