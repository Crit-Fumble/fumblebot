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
