/**
 * Message Handler
 * Handles direct messages, bot mentions, and admin channel monitoring
 */

import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js'
import type { Message, ButtonInteraction, TextChannel } from 'discord.js'
import type { FumbleBotClient } from '../client.js'
import { AIService } from '../../ai/service.js'
import { isKnowledgeBaseConfigured, getKnowledgeBaseClient } from '../../../lib/knowledge-base-client.js'
import { isAdminChannel, handleAdminChannelMessage, getAdminChannelId } from './admin-channel.js'

/**
 * Handle incoming messages
 * Responds to bot mentions, DMs, and monitors admin channel
 */
export async function handleMessage(
  message: Message,
  bot: FumbleBotClient
): Promise<void> {
  // Ignore messages from bots (including self)
  if (message.author.bot) return

  // Check if this is the admin channel - handle with autonomous logic
  if (isAdminChannel(message)) {
    // In admin channel, respond to mentions immediately, or analyze for autonomous response
    const isMentioned = message.mentions.has(bot.user!.id)
    if (isMentioned) {
      // Handle mention normally in admin channel
      const content = message.content
        .replace(new RegExp(`<@!?${bot.user!.id}>`), '')
        .trim()
      if (content) {
        await handleAIChat(message, content, bot)
      }
      return
    }
    // Autonomous response analysis for admin channel
    await handleAdminChannelMessage(message, bot)
    return
  }

  // Check if bot was mentioned or if this is a DM
  const isMentioned = message.mentions.has(bot.user!.id)
  const isDM = !message.guild

  if (!isMentioned && !isDM) return

  // Get the message content without the mention
  let content = message.content
    .replace(new RegExp(`<@!?${bot.user!.id}>`), '')
    .trim()

  // If empty after removing mention, provide help
  if (!content) {
    await message.reply({
      content:
        "Hey! What's up?\n\n" +
        "**Quick stuff:**\n" +
        "• `/roll 2d6+3` - dice\n" +
        "• `/npc tavern keeper` - generate NPCs\n" +
        "• Ask me about spells, monsters, rules, whatever\n\n" +
        "Just @ me with a question.",
    })
    return
  }

  // Check for quick commands in messages
  const quickCommands = parseQuickCommands(content)

  if (quickCommands.type === 'roll') {
    await handleQuickRoll(message, quickCommands.value)
    return
  }

  // Otherwise, use AI to respond
  await handleAIChat(message, content, bot)
}

interface QuickCommand {
  type: 'roll' | 'help' | 'chat'
  value: string
}

/**
 * Parse quick commands from message content
 */
function parseQuickCommands(content: string): QuickCommand {
  // Check for dice notation
  const diceMatch = content.match(/^(\d*d\d+([+-]\d+)?)\s*$/i)
  if (diceMatch) {
    return { type: 'roll', value: diceMatch[1] }
  }

  // Check for "roll X" format
  const rollMatch = content.match(/^roll\s+(.+)$/i)
  if (rollMatch) {
    return { type: 'roll', value: rollMatch[1] }
  }

  // Check for help
  if (/^(help|commands|what can you do)/i.test(content)) {
    return { type: 'help', value: '' }
  }

  return { type: 'chat', value: content }
}

/**
 * Handle quick dice roll from message
 */
async function handleQuickRoll(message: Message, notation: string): Promise<void> {
  try {
    // Parse notation
    const match = notation.toLowerCase().match(/^(\d+)?d(\d+)([+-]\d+)?$/i)

    if (!match) {
      await message.reply({
        content: `❌ Invalid dice notation: \`${notation}\`\nTry something like \`2d6+3\` or \`1d20\``,
      })
      return
    }

    const count = parseInt(match[1] || '1', 10)
    const sides = parseInt(match[2], 10)
    const modifier = parseInt(match[3] || '0', 10)

    // Validate
    if (count < 1 || count > 100) {
      await message.reply({ content: '❌ Dice count must be between 1 and 100' })
      return
    }

    if (sides < 2 || sides > 1000) {
      await message.reply({ content: '❌ Dice sides must be between 2 and 1000' })
      return
    }

    // Roll
    const rolls: number[] = []
    for (let i = 0; i < count; i++) {
      rolls.push(Math.floor(Math.random() * sides) + 1)
    }

    const total = rolls.reduce((sum, roll) => sum + roll, 0) + modifier

    // Check for crit/fumble on d20
    const isCrit = sides === 20 && count === 1 && rolls[0] === 20
    const isFumble = sides === 20 && count === 1 && rolls[0] === 1

    let response = `🎲 **${notation}**\n`
    response += `Rolls: [${rolls.join(', ')}]`

    if (modifier !== 0) {
      response += ` ${modifier >= 0 ? '+' : ''}${modifier}`
    }

    response += ` = **${total}**`

    if (isCrit) {
      response = `🎉 **CRITICAL HIT!**\n${response}`
    } else if (isFumble) {
      response = `💀 **FUMBLE!**\n${response}`
    }

    await message.reply({ content: response })
  } catch (error) {
    await message.reply({ content: '❌ Failed to roll dice.' })
  }
}

interface LookupClassification {
  isLookup: boolean;
  category: string;
  query: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Use Haiku to intelligently classify if a message is a D&D/TTRPG lookup request
 * Returns the category and optimized search query
 */
async function classifyWithHaiku(content: string): Promise<LookupClassification> {
  const aiService = AIService.getInstance();

  try {
    const result = await aiService.lookup(
      content,
      `You are a classifier for a TTRPG Discord bot. Analyze if this message is asking for TTRPG rule/content lookup.

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "isLookup": true/false,
  "category": "spells|bestiary|items|classes|races|feats|backgrounds|conditions|actions|lore|none",
  "query": "optimized search term",
  "confidence": "high|medium|low"
}

Categories:
- spells: Spell lookups (fireball, cure wounds, cantrips)
- bestiary: Monsters/creatures (goblin, dragon, beholder)
- items: Magic items, weapons, armor, equipment
- classes: Character classes and subclasses
- races: Player races/species
- feats: Character feats
- backgrounds: Character backgrounds
- conditions: Status conditions (poisoned, stunned) and diseases
- actions: Game rules, actions, mechanics (chase rules, grappling, opportunity attacks)
- lore: Setting lore, locations, NPCs, deities, factions, history (Waterdeep, Drizzt, Forgotten Realms, Baldur's Gate)
- none: Not a TTRPG lookup (greetings, off-topic chat)

Examples:
"Chase rules" → {"isLookup":true,"category":"actions","query":"chase","confidence":"high"}
"what is a goblin" → {"isLookup":true,"category":"bestiary","query":"goblin","confidence":"high"}
"fireball spell" → {"isLookup":true,"category":"spells","query":"fireball","confidence":"high"}
"how does grappling work" → {"isLookup":true,"category":"actions","query":"grapple","confidence":"high"}
"tell me about Waterdeep" → {"isLookup":true,"category":"lore","query":"Waterdeep","confidence":"high"}
"who is Drizzt" → {"isLookup":true,"category":"lore","query":"Drizzt Do'Urden","confidence":"high"}
"hey bot" → {"isLookup":false,"category":"none","query":"","confidence":"high"}
"longsword" → {"isLookup":true,"category":"items","query":"longsword","confidence":"medium"}`,
      { maxTokens: 150 }
    );

    // Parse the JSON response
    const cleaned = result.content.trim().replace(/```json\n?|\n?```/g, '');
    const parsed = JSON.parse(cleaned);

    return {
      isLookup: parsed.isLookup === true,
      category: parsed.category || 'bestiary',
      query: parsed.query || content,
      confidence: parsed.confidence || 'medium',
    };
  } catch (error) {
    console.error('[FumbleBot] Haiku classification failed:', error);
    // Fallback to simple detection
    return fallbackDetection(content);
  }
}

/**
 * Fallback detection when Haiku fails
 */
function fallbackDetection(content: string): LookupClassification {
  const contentLower = content.toLowerCase();

  // Quick check for obvious D&D terms
  const dndTerms = ['spell', 'monster', 'creature', 'item', 'weapon', 'armor', 'feat', 'class', 'race', 'background', 'condition', 'rule', 'action'];
  const hasTerms = dndTerms.some(term => contentLower.includes(term));

  // Check for question patterns
  const isQuestion = /^(what|how|tell|look|search|find|explain)/i.test(content);

  return {
    isLookup: hasTerms || isQuestion,
    category: 'bestiary', // Default fallback
    query: content.replace(/\?/g, '').trim(),
    confidence: 'low',
  };
}

/**
 * Handle AI chat response
 */
async function handleAIChat(
  message: Message,
  content: string,
  _bot: FumbleBotClient
): Promise<void> {
  // Show typing indicator
  if ('sendTyping' in message.channel) {
    await message.channel.sendTyping()
  }

  try {
    const aiService = AIService.getInstance()

    // Use Haiku to intelligently classify the message
    const classification = await classifyWithHaiku(content);
    console.log(`[FumbleBot] Classification: ${JSON.stringify(classification)}`);

    if (classification.isLookup && classification.category !== 'none') {
      console.log(`[FumbleBot] Detected rule lookup: "${classification.query}" in category "${classification.category}" (${classification.confidence})`);

      // Try KB first if configured
      if (isKnowledgeBaseConfigured()) {
        try {
          const kbClient = getKnowledgeBaseClient();
          const kbResult = await kbClient.search({
            query: classification.query,
            limit: 3,
          });

          if (kbResult.results.length > 0) {
            console.log(`[FumbleBot] KB found ${kbResult.results.length} results for "${classification.query}"`);

            // Get the top result's full content
            const topResult = kbResult.results[0];
            const document = await kbClient.getDocument(topResult.id);

            // Use paginated reply for long KB content
            await sendPaginatedReply(
              message,
              `📖 ${document.title}`,
              document.content,
              {
                source: `${document.system} Knowledge Base`,
                footerText: `System: ${document.system}`,
                authorId: message.author.id,
              }
            );
            return;
          }
          console.log('[FumbleBot] KB had no results, trying web search');
        } catch (error) {
          console.error('[FumbleBot] KB search error:', error);
          // Fall through to web search
        }
      }

      // Try web search as fallback - route based on category
      if (classification.category === 'lore') {
        // Route lore queries to Forgotten Realms Wiki
        console.log(`[FumbleBot] Searching Forgotten Realms Wiki for: ${classification.query}`);
        const loreResult = await aiService.searchForgottenRealms(classification.query);

        if (loreResult.success && loreResult.content) {
          await sendPaginatedReply(
            message,
            `📜 Lore: ${classification.query}`,
            loreResult.content,
            {
              source: loreResult.source ? `[View on Forgotten Realms Wiki](${loreResult.source})` : undefined,
              authorId: message.author.id,
            }
          );
          return;
        }
        console.log('[FumbleBot] Forgotten Realms search failed, falling back to AI');
      } else {
        // Route other categories to 5e.tools
        const searchResult = await aiService.search5eTools(classification.query, classification.category);

        if (searchResult.success && searchResult.content) {
          // Use paginated reply for long web search content
          const categoryTitles: Record<string, string> = {
            spells: '🔮 Spell',
            bestiary: '🐉 Monster',
            items: '⚔️ Item',
            classes: '👤 Class',
            races: '🧝 Race',
            feats: '⭐ Feat',
            backgrounds: '📜 Background',
            conditions: '💀 Condition',
            actions: '📋 Rules',
          };
          const titlePrefix = categoryTitles[classification.category] || '📖';

          await sendPaginatedReply(
            message,
            `${titlePrefix}: ${classification.query}`,
            searchResult.content,
            {
              source: searchResult.source ? `[View on 5e.tools](${searchResult.source})` : undefined,
              authorId: message.author.id,
            }
          );
          return;
        }
        // Fall through to general AI chat if web search fails
        console.log('[FumbleBot] Web search failed, falling back to AI');
      }
    }

    // Build context from recent messages (fetch more for better context)
    const recentMessages = await message.channel.messages.fetch({ limit: 20 })
    const contextMessages = recentMessages
      .reverse()
      .filter((m) => m.content.trim().length > 0) // Include bot messages for conversation flow
      .slice(-15) // Keep last 15 after filtering
      .map((m) => {
        const author = m.author.bot ? `🤖 ${m.author.displayName}` : m.author.displayName;
        return `[${author}]: ${m.content.substring(0, 500)}`;
      })
      .join('\n');

    // Get channel/guild context for better responses
    const channelName = 'name' in message.channel ? message.channel.name : 'DM';
    const guildName = message.guild?.name || 'Direct Message';

    const response = await aiService.complete({
      messages: [
        {
          role: 'user',
          content: content,
        },
      ],
      systemPrompt: `You're FumbleBot - a chill TTRPG nerd who hangs out in the Crit-Fumble Discord.

Personality:
- Casual and friendly, not corporate or over-enthusiastic
- Give straight answers without unnecessary preamble
- Use Discord markdown naturally
- Skip the "I'd be happy to help!" stuff - just help

What you know:
- D&D 5e (2024 rules), Cypher System, FoundryVTT
- You have a knowledge base with spells, classes, monsters, rules
- You can search 5e.tools for anything you don't know off the top of your head

Location: #${channelName} in ${guildName}

Recent conversation:
${contextMessages}

Keep it brief. Don't pad responses. Reference the conversation naturally if relevant.`,
      maxTokens: 500,
      temperature: 0.7,
    })

    // Split response if too long for Discord
    const maxLength = 2000
    let responseText = response.content

    if (responseText.length > maxLength) {
      responseText = responseText.slice(0, maxLength - 3) + '...'
    }

    await message.reply({ content: responseText })
  } catch (error) {
    console.error('[FumbleBot] AI chat error:', error)
    await message.reply({
      content: "Brain's not cooperating. Give me a sec and try again.",
    })
  }
}

/**
 * Send a paginated embed response for long content
 * Includes interactive buttons for navigation
 */
async function sendPaginatedReply(
  message: Message,
  title: string,
  content: string,
  options?: {
    source?: string;
    footerText?: string;
    color?: number;
    authorId?: string;
  }
): Promise<void> {
  const maxCharsPerPage = 3500;
  const color = options?.color ?? 0x7c3aed;

  // Check if pagination is needed
  if (content.length <= maxCharsPerPage) {
    // Simple embed without pagination
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(content)
      .setColor(color)
      .setTimestamp();

    if (options?.source) {
      embed.addFields({
        name: '🔗 Source',
        value: options.source,
        inline: true,
      });
    }

    if (options?.footerText) {
      embed.setFooter({ text: options.footerText });
    }

    await message.reply({ embeds: [embed] });
    return;
  }

  // Split content into pages
  const pages = splitIntoPages(content, maxCharsPerPage);
  let currentPage = 0;

  const buildPageEmbed = (pageIndex: number): EmbedBuilder => {
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(pages[pageIndex])
      .setColor(color)
      .setTimestamp();

    if (options?.source) {
      embed.addFields({
        name: '🔗 Source',
        value: options.source,
        inline: true,
      });
    }

    const pageInfo = `Page ${pageIndex + 1}/${pages.length}`;
    embed.setFooter({
      text: options?.footerText ? `${options.footerText} • ${pageInfo}` : pageInfo,
    });

    return embed;
  };

  const buildButtons = (pageIndex: number): ActionRowBuilder<ButtonBuilder> => {
    const row = new ActionRowBuilder<ButtonBuilder>();

    row.addComponents(
      new ButtonBuilder()
        .setCustomId('msg_page_first')
        .setLabel('⏮')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pageIndex === 0)
    );

    row.addComponents(
      new ButtonBuilder()
        .setCustomId('msg_page_prev')
        .setLabel('◀ Previous')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(pageIndex === 0)
    );

    row.addComponents(
      new ButtonBuilder()
        .setCustomId('msg_page_indicator')
        .setLabel(`${pageIndex + 1} / ${pages.length}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );

    row.addComponents(
      new ButtonBuilder()
        .setCustomId('msg_page_next')
        .setLabel('Next ▶')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(pageIndex === pages.length - 1)
    );

    row.addComponents(
      new ButtonBuilder()
        .setCustomId('msg_page_last')
        .setLabel('⏭')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pageIndex === pages.length - 1)
    );

    return row;
  };

  // Send initial message with pagination
  const reply = await message.reply({
    embeds: [buildPageEmbed(0)],
    components: [buildButtons(0)],
  });

  // Create collector for button interactions
  const collector = reply.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 5 * 60 * 1000, // 5 minute timeout
    filter: (interaction) => {
      // Only allow the original author to navigate (or anyone if no authorId)
      if (options?.authorId && interaction.user.id !== options.authorId) {
        interaction.reply({
          content: 'Only the person who asked can use these buttons.',
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
      case 'msg_page_first':
        currentPage = 0;
        break;
      case 'msg_page_prev':
        currentPage = Math.max(0, currentPage - 1);
        break;
      case 'msg_page_next':
        currentPage = Math.min(pages.length - 1, currentPage + 1);
        break;
      case 'msg_page_last':
        currentPage = pages.length - 1;
        break;
      default:
        return;
    }

    await interaction.update({
      embeds: [buildPageEmbed(currentPage)],
      components: [buildButtons(currentPage)],
    });
  });

  collector.on('end', async () => {
    // Remove buttons when collector expires
    try {
      await reply.edit({
        embeds: [buildPageEmbed(currentPage)],
        components: [], // Remove buttons
      });
    } catch (e) {
      // Message might have been deleted
    }
  });
}

/**
 * Split content into pages for pagination
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

    let breakPoint = maxChars;

    // Try paragraph break first
    const paragraphBreak = remaining.lastIndexOf('\n\n', maxChars);
    if (paragraphBreak > maxChars * 0.5) {
      breakPoint = paragraphBreak;
    } else {
      // Try line break
      const lineBreak = remaining.lastIndexOf('\n', maxChars);
      if (lineBreak > maxChars * 0.5) {
        breakPoint = lineBreak;
      } else {
        // Try sentence break
        const sentenceBreak = remaining.lastIndexOf('. ', maxChars);
        if (sentenceBreak > maxChars * 0.5) {
          breakPoint = sentenceBreak + 1;
        } else {
          // Try space
          const spaceBreak = remaining.lastIndexOf(' ', maxChars);
          if (spaceBreak > maxChars * 0.5) {
            breakPoint = spaceBreak;
          }
        }
      }
    }

    pages.push(remaining.slice(0, breakPoint).trim());
    remaining = remaining.slice(breakPoint).trim();
  }

  return pages;
}
