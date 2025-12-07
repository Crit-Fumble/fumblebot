/**
 * Admin Channel Handler
 * Autonomous response logic for the admin channel
 *
 * FumbleBot monitors the admin channel and responds intelligently:
 * - Answers open questions directed at no one specific
 * - Offers advice when appropriate
 * - Avoids interrupting human conversations
 * - Distinguishes between users and replies appropriately
 */

import type { Message, TextChannel } from 'discord.js'
import type { FumbleBotClient } from '../client.js'
import { AIService } from '../../ai/service.js'
import { GuildContextManager } from '../../context/guild-context-manager.js'
import type { GuildContext, ChannelContext, CategoryContext } from '../../context/types.js'

/** Result of analyzing whether FumbleBot should respond */
interface ShouldRespondResult {
  shouldRespond: boolean
  reason: string
  replyToUserId: string | null
  responseType: 'answer' | 'advice' | 'clarification' | 'none'
  confidence: number
}

/** Conversation participant for tracking */
interface ConversationParticipant {
  userId: string
  username: string
  displayName: string
  messageCount: number
  lastMessage: string
  lastMessageTime: Date
}

/**
 * Get the admin channel ID from environment
 */
export function getAdminChannelId(): string | null {
  return process.env.FUMBLEBOT_DISCORD_ADMIN_CHANNEL || null
}

/**
 * Check if a message is from the admin channel
 */
export function isAdminChannel(message: Message): boolean {
  const adminChannelId = getAdminChannelId()
  return adminChannelId !== null && message.channelId === adminChannelId
}

/**
 * Analyze recent conversation to determine if FumbleBot should respond
 * Uses Claude Sonnet for nuanced social understanding of when to engage
 */
async function analyzeConversation(
  message: Message,
  recentMessages: Message[],
  serverContext: string
): Promise<ShouldRespondResult> {
  const aiService = AIService.getInstance()

  // Build conversation context
  const participants = buildParticipantMap(recentMessages)
  const conversationText = formatConversationForAnalysis(recentMessages, participants)
  const currentMessage = `${message.author.displayName}: ${message.content}`

  const systemPrompt = `You are an AI analyzing Discord conversations to decide when FumbleBot (a TTRPG assistant) should participate.

Your job is to read social cues and determine if FumbleBot's input would be welcome and valuable.

RULES FOR RESPONDING:
1. RESPOND if: Someone asks an open question (not directed at a specific person)
2. RESPOND if: Someone asks about TTRPG rules, spells, monsters, mechanics
3. RESPOND if: Someone seems stuck or could use helpful advice
4. RESPOND if: The conversation stalls and FumbleBot could add value
5. DO NOT respond if: Two or more people are having an active back-and-forth conversation
6. DO NOT respond if: The question was clearly directed at a specific person by name
7. DO NOT respond if: The topic is completely off-topic/personal (not TTRPG related)
8. DO NOT respond if: Someone already answered the same question recently

Be conservative - when in doubt, don't interrupt. But don't be so conservative that you never help.

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "shouldRespond": true/false,
  "reason": "Brief explanation of your decision",
  "replyToUserId": "discord_user_id_to_address or null if general",
  "responseType": "answer|advice|clarification|none",
  "confidence": 0.0-1.0
}`

  const analysisPrompt = `Analyze this conversation:

CONVERSATION CONTEXT:
${conversationText}

LATEST MESSAGE:
${currentMessage}

PARTICIPANTS (with Discord IDs):
${formatParticipantsWithIds(participants)}

SERVER CONTEXT:
${serverContext}

Should FumbleBot respond to this conversation? Analyze the social dynamics and decide.`

  try {
    // Use Sonnet for nuanced social analysis
    const result = await aiService.chat(
      [{ role: 'user', content: analysisPrompt }],
      systemPrompt,
      { maxTokens: 250, temperature: 0.3 }
    )
    const cleaned = result.content.trim().replace(/```json\n?|\n?```/g, '')
    const parsed = JSON.parse(cleaned)

    return {
      shouldRespond: parsed.shouldRespond === true,
      reason: parsed.reason || 'Unknown',
      replyToUserId: parsed.replyToUserId || null,
      responseType: parsed.responseType || 'none',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
    }
  } catch (error) {
    console.error('[Admin] Conversation analysis failed:', error)
    // Default to not responding if analysis fails
    return {
      shouldRespond: false,
      reason: 'Analysis failed',
      replyToUserId: null,
      responseType: 'none',
      confidence: 0,
    }
  }
}

/**
 * Build a map of conversation participants
 */
function buildParticipantMap(messages: Message[]): Map<string, ConversationParticipant> {
  const participants = new Map<string, ConversationParticipant>()

  for (const msg of messages) {
    if (msg.author.bot) continue

    const existing = participants.get(msg.author.id)
    if (existing) {
      existing.messageCount++
      existing.lastMessage = msg.content
      existing.lastMessageTime = msg.createdAt
    } else {
      participants.set(msg.author.id, {
        userId: msg.author.id,
        username: msg.author.username,
        displayName: msg.member?.displayName || msg.author.displayName,
        messageCount: 1,
        lastMessage: msg.content,
        lastMessageTime: msg.createdAt,
      })
    }
  }

  return participants
}

/**
 * Format conversation for AI analysis
 */
function formatConversationForAnalysis(
  messages: Message[],
  participants: Map<string, ConversationParticipant>
): string {
  return messages
    .filter(m => !m.author.bot || m.author.id === messages[0].client.user?.id)
    .map(m => {
      const participant = participants.get(m.author.id)
      const name = participant?.displayName || m.author.displayName
      const timestamp = m.createdAt.toLocaleTimeString()
      const replyInfo = m.reference?.messageId ? ' (replying to previous)' : ''
      return `[${timestamp}] ${name}: ${m.content}${replyInfo}`
    })
    .join('\n')
}

/**
 * Format participants for context (display only)
 */
function formatParticipants(participants: Map<string, ConversationParticipant>): string {
  return Array.from(participants.values())
    .map(p => `- ${p.displayName} (@${p.username}): ${p.messageCount} messages`)
    .join('\n')
}

/**
 * Format participants with Discord IDs for AI to reference in replies
 */
function formatParticipantsWithIds(participants: Map<string, ConversationParticipant>): string {
  return Array.from(participants.values())
    .map(p => `- ${p.displayName} (@${p.username}) [ID: ${p.userId}]: ${p.messageCount} messages`)
    .join('\n')
}

/**
 * Build server context string from GuildContextManager
 */
function buildServerContext(guildContext: GuildContext | undefined): string {
  if (!guildContext) return 'No server context available'

  const lines: string[] = [
    `Server: ${guildContext.guildName}`,
    '',
    'Categories and Channels:',
  ]

  // Add categories with their channels
  for (const [, category] of guildContext.categories) {
    lines.push(`\n📁 ${category.name}:`)
    for (const [, channel] of category.channels) {
      const topic = channel.topic ? ` - ${channel.topic.substring(0, 50)}` : ''
      lines.push(`  #${channel.name}${topic}`)
    }
  }

  // Add uncategorized channels
  if (guildContext.uncategorizedChannels.size > 0) {
    lines.push('\n📁 Uncategorized:')
    for (const [, channel] of guildContext.uncategorizedChannels) {
      lines.push(`  #${channel.name}`)
    }
  }

  return lines.join('\n')
}

/**
 * Generate an intelligent response for the admin channel
 */
async function generateResponse(
  message: Message,
  recentMessages: Message[],
  analysis: ShouldRespondResult,
  serverContext: string
): Promise<string> {
  const aiService = AIService.getInstance()

  // Build conversation context
  const participants = buildParticipantMap(recentMessages)
  const conversationText = formatConversationForAnalysis(recentMessages, participants)

  // Determine if this should be a reply to someone specific
  const replyTarget = analysis.replyToUserId
    ? participants.get(analysis.replyToUserId)
    : null

  const systemPrompt = `You are FumbleBot, a helpful TTRPG assistant in the Crit-Fumble Discord server's admin channel.

Your personality:
- Casual and friendly, like a fellow TTRPG nerd
- Direct and helpful without being overly formal
- Knowledgeable about D&D 5e, Pathfinder, and other TTRPGs
- You can see the entire server structure and help with server-related questions

Response type: ${analysis.responseType}
${replyTarget ? `You are responding to ${replyTarget.displayName}` : 'This is a general response to the channel'}

Server structure (for context):
${serverContext}

Recent conversation:
${conversationText}

Guidelines:
- Keep responses concise (2-3 sentences unless more detail is needed)
- Use Discord markdown when helpful
- If answering a question, be accurate and cite sources when relevant
- If offering advice, be constructive and practical
- Don't repeat what others have already said
- Match the casual tone of the conversation`

  const response = await aiService.chat(
    [{ role: 'user', content: message.content }],
    systemPrompt,
    { maxTokens: 500, temperature: 0.7 }
  )

  return response.content
}

/**
 * Handle a message in the admin channel
 * Determines if FumbleBot should respond and generates appropriate response
 */
export async function handleAdminChannelMessage(
  message: Message,
  bot: FumbleBotClient
): Promise<void> {
  // Don't respond to bots (including self)
  if (message.author.bot) return

  // Get recent messages for context
  const recentMessages = await message.channel.messages.fetch({ limit: 15 })
  const sortedMessages = Array.from(recentMessages.values())
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp)

  // Get server context
  const contextManager = GuildContextManager.getInstance()
  const guildContext = message.guild
    ? contextManager.getGuildContext(message.guild.id)
    : undefined
  const serverContext = buildServerContext(guildContext)

  // Analyze if we should respond
  const analysis = await analyzeConversation(message, sortedMessages, serverContext)

  console.log(`[Admin] Analysis: ${JSON.stringify(analysis)}`)

  // Only respond if analysis says we should and confidence is high enough
  if (!analysis.shouldRespond || analysis.confidence < 0.6) {
    console.log(`[Admin] Not responding: ${analysis.reason} (confidence: ${analysis.confidence})`)
    return
  }

  // Show typing indicator
  if ('sendTyping' in message.channel) {
    await message.channel.sendTyping()
  }

  try {
    // Generate response
    const response = await generateResponse(message, sortedMessages, analysis, serverContext)

    // Get channel as TextChannel (admin channel is always a text channel)
    const channel = message.channel as TextChannel

    // Determine how to send the response
    if (analysis.replyToUserId && analysis.replyToUserId === message.author.id) {
      // Reply directly to the message
      await message.reply({ content: response })
    } else if (analysis.replyToUserId) {
      // Mention the specific user
      await channel.send({
        content: `<@${analysis.replyToUserId}> ${response}`,
      })
    } else {
      // General response to channel
      await channel.send({ content: response })
    }

    console.log(`[Admin] Responded (${analysis.responseType}): ${response.substring(0, 100)}...`)
  } catch (error) {
    console.error('[Admin] Response generation failed:', error)
    // Don't send error messages in admin channel - fail silently
  }
}

/**
 * Get summary of a specific channel for context
 */
export function getChannelSummary(
  guildId: string,
  channelId: string
): string | null {
  const contextManager = GuildContextManager.getInstance()
  const channel = contextManager.getChannelContext(guildId, channelId)

  if (!channel) return null

  const recentMessages = channel.recentMessages.slice(-5)
  const messagePreview = recentMessages
    .map(m => `${m.authorUsername}: ${m.content.substring(0, 100)}`)
    .join('\n')

  return `#${channel.name}${channel.topic ? ` (${channel.topic})` : ''}\nRecent activity:\n${messagePreview}`
}

/**
 * Get full server context for MCP or API use
 */
export function getFullServerContext(guildId: string): {
  guild: GuildContext | undefined
  categories: CategoryContext[]
  channels: ChannelContext[]
} {
  const contextManager = GuildContextManager.getInstance()
  const guild = contextManager.getGuildContext(guildId)

  if (!guild) {
    return { guild: undefined, categories: [], channels: [] }
  }

  return {
    guild,
    categories: Array.from(guild.categories.values()),
    channels: Array.from(guild.channelIndex.values()),
  }
}
