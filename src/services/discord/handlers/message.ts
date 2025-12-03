/**
 * Message Handler
 * Handles direct messages and bot mentions
 */

import type { Message } from 'discord.js'
import type { FumbleBotClient } from '../client.js'
import { AIService } from '../../ai/service.js'

/**
 * Handle incoming messages
 * Responds to bot mentions and DMs
 */
export async function handleMessage(
  message: Message,
  bot: FumbleBotClient
): Promise<void> {
  // Ignore messages from bots (including self)
  if (message.author.bot) return

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
        "👋 Hi! I'm FumbleBot, your TTRPG companion!\n\n" +
        "**Commands:**\n" +
        "• `/roll 2d6+3` - Roll dice\n" +
        "• `/ask <question>` - Ask me anything\n" +
        "• `/dm <scenario>` - Get DM responses\n" +
        "• `/npc <type>` - Generate NPCs\n" +
        "• `/activity start` - Start a Discord Activity\n\n" +
        "Or just chat with me by mentioning me!",
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

/**
 * Detect if message is a D&D rule lookup and determine category
 */
function detectRuleLookup(content: string): { isLookup: boolean; category: string; query: string } {
  const contentLower = content.toLowerCase();

  // Keywords that indicate a rule/info lookup
  const lookupPatterns = [
    /what (?:is|are|does) (?:a |an |the )?(.+?)(?:\?|$)/i,
    /tell me about (?:the |a |an )?(.+?)(?:\?|$)/i,
    /how does (?:the |a |an )?(.+?) work(?:\?|$)/i,
    /look up (?:the |a |an )?(.+?)(?:\?|$)/i,
    /search (?:for )?(?:the |a |an )?(.+?)(?:\?|$)/i,
    /find (?:the |a |an )?(.+?)(?:\?|$)/i,
  ];

  let isLookup = false;
  let query = content;

  // Check for lookup patterns
  for (const pattern of lookupPatterns) {
    const match = content.match(pattern);
    if (match) {
      isLookup = true;
      query = match[1].trim();
      break;
    }
  }

  // Also trigger for D&D-specific terms even without question format
  const dndTerms = ['spell', 'monster', 'creature', 'item', 'weapon', 'armor', 'feat', 'class', 'race', 'subclass', 'background', 'condition'];
  if (!isLookup && dndTerms.some(term => contentLower.includes(term))) {
    isLookup = true;
  }

  // Determine category
  let category = 'spells';
  if (contentLower.includes('monster') || contentLower.includes('creature') || contentLower.includes('bestiary')) {
    category = 'bestiary';
    query = query.replace(/monster|creature|bestiary/gi, '').trim();
  } else if (contentLower.includes('item') || contentLower.includes('weapon') || contentLower.includes('armor') || contentLower.includes('equipment')) {
    category = 'items';
    query = query.replace(/item|weapon|armor|equipment/gi, '').trim();
  } else if (contentLower.includes('class') || contentLower.includes('subclass')) {
    category = 'classes';
    query = query.replace(/class|subclass/gi, '').trim();
  } else if (contentLower.includes('race') || contentLower.includes('species')) {
    category = 'races';
    query = query.replace(/race|species/gi, '').trim();
  } else if (contentLower.includes('feat')) {
    category = 'feats';
    query = query.replace(/feat/gi, '').trim();
  } else if (contentLower.includes('background')) {
    category = 'backgrounds';
    query = query.replace(/background/gi, '').trim();
  } else if (contentLower.includes('condition') || contentLower.includes('disease')) {
    category = 'conditions';
    query = query.replace(/condition|disease/gi, '').trim();
  } else if (contentLower.includes('spell') || contentLower.includes('cast')) {
    category = 'spells';
    query = query.replace(/spell|cast/gi, '').trim();
  }

  // Clean up query
  query = query.replace(/\?/g, '').trim();
  if (!query) query = content;

  return { isLookup, category, query };
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

    // Check if this is a D&D rule lookup
    const lookup = detectRuleLookup(content);

    if (lookup.isLookup) {
      console.log(`[FumbleBot] Detected rule lookup: "${lookup.query}" in category "${lookup.category}"`);

      // Try web search first
      const searchResult = await aiService.search5eTools(lookup.query, lookup.category);

      if (searchResult.success && searchResult.content) {
        // Format response for Discord
        let responseText = searchResult.content;

        // Split response if too long for Discord
        const maxLength = 2000;
        if (responseText.length > maxLength) {
          responseText = responseText.slice(0, maxLength - 3) + '...';
        }

        await message.reply({ content: responseText });
        return;
      }
      // Fall through to general AI chat if web search fails
      console.log('[FumbleBot] Web search failed, falling back to AI');
    }

    // Build context from recent messages
    const recentMessages = await message.channel.messages.fetch({ limit: 5 })
    const context = recentMessages
      .reverse()
      .filter((m) => !m.author.bot)
      .map((m) => `${m.author.displayName}: ${m.content}`)
      .join('\n')

    const response = await aiService.complete({
      messages: [
        {
          role: 'user',
          content: content,
        },
      ],
      systemPrompt: `You are FumbleBot, a friendly and helpful assistant for the Crit-Fumble Gaming community.
You specialize in tabletop RPGs (D&D, Pathfinder, etc.), gaming, and creative writing.
Keep responses concise (under 2000 characters) and engaging. Use Discord markdown.
You can use emojis sparingly for personality.

You have access to web search tools for looking up D&D 5e rules, spells, monsters, and items from 5e.tools.
If someone asks about a spell, monster, or rule you're not sure about, mention that you can search 5e.tools for accurate info.

Current conversation context:
${context}

Important: Never break character or reveal you're an AI. You're FumbleBot!`,
      maxTokens: 500,
      temperature: 0.8,
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
      content: "🤖 I'm having trouble thinking right now. Try again in a moment!",
    })
  }
}
