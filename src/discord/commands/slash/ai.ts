/**
 * AI Commands
 * Interact with OpenAI and Anthropic through Discord
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js'
import type { FumbleBotClient } from '../../client.js'
import { AIService } from '../../../ai/service.js'

// Define slash commands
export const aiCommands = [
  new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Ask FumbleBot a question (uses AI)')
    .addStringOption((option) =>
      option
        .setName('question')
        .setDescription('Your question')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('model')
        .setDescription('AI model to use')
        .setRequired(false)
        .addChoices(
          { name: 'Claude (Anthropic)', value: 'anthropic' },
          { name: 'GPT-4 (OpenAI)', value: 'openai' }
        )
    )
    .addBooleanOption((option) =>
      option
        .setName('private')
        .setDescription('Only show the response to you')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('dm')
    .setDescription('Generate a DM response for a TTRPG scenario')
    .addStringOption((option) =>
      option
        .setName('scenario')
        .setDescription('Describe the situation or player action')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('system')
        .setDescription('Game system (e.g., D&D 5e, Pathfinder)')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('tone')
        .setDescription('Response tone')
        .setRequired(false)
        .addChoices(
          { name: 'Dramatic', value: 'dramatic' },
          { name: 'Humorous', value: 'humorous' },
          { name: 'Dark/Gritty', value: 'dark' },
          { name: 'Whimsical', value: 'whimsical' },
          { name: 'Neutral', value: 'neutral' }
        )
    ),

  new SlashCommandBuilder()
    .setName('npc')
    .setDescription('Generate an NPC description')
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('Type of NPC (e.g., merchant, guard, villain)')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('setting')
        .setDescription('Setting/world context')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('lore')
    .setDescription('Generate lore or world-building content')
    .addStringOption((option) =>
      option
        .setName('topic')
        .setDescription('Topic for lore generation')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('style')
        .setDescription('Style of lore')
        .setRequired(false)
        .addChoices(
          { name: 'Historical Chronicle', value: 'chronicle' },
          { name: 'Legend/Myth', value: 'legend' },
          { name: 'Scholarly Essay', value: 'scholarly' },
          { name: 'Tavern Tale', value: 'tavern' }
        )
    ),
]

// Command handler
export async function aiHandler(
  interaction: ChatInputCommandInteraction,
  _bot: FumbleBotClient
): Promise<void> {
  const commandName = interaction.commandName

  // Defer reply since AI calls can take time
  await interaction.deferReply({
    ephemeral: interaction.options.getBoolean('private') ?? false,
  })

  try {
    const aiService = AIService.getInstance()

    if (commandName === 'ask') {
      const question = interaction.options.getString('question', true)
      const providerChoice = interaction.options.getString('model') as 'openai' | 'anthropic' | null

      const response = await aiService.complete({
        messages: [{ role: 'user', content: question }],
        provider: providerChoice || undefined,
        systemPrompt: `You are FumbleBot, a helpful assistant for the Crit-Fumble Gaming community.
You specialize in tabletop RPGs, gaming, and creative writing.
Keep responses concise and friendly. Use Discord markdown formatting.`,
      })

      const embed = new EmbedBuilder()
        .setColor(0x7c3aed)
        .setTitle('FumbleBot Response')
        .setDescription(response.content.slice(0, 4096))
        .setFooter({
          text: `Model: ${response.model} | Tokens: ${response.usage.totalTokens}`,
        })
        .setTimestamp()

      await interaction.editReply({ embeds: [embed] })
    } else if (commandName === 'dm') {
      const scenario = interaction.options.getString('scenario', true)
      const system = interaction.options.getString('system') || 'fantasy TTRPG'
      const tone = interaction.options.getString('tone') || 'dramatic'

      const prompt = `You are an experienced Dungeon Master/Game Master for ${system}.
Generate a ${tone} response to the following scenario. Include:
- Vivid description
- Any relevant game mechanics or dice rolls needed
- Potential consequences or outcomes

Scenario: ${scenario}`

      const response = await aiService.complete({
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: 'You are an expert TTRPG Game Master. Use evocative language and create engaging scenarios.',
      })

      const embed = new EmbedBuilder()
        .setColor(0xeab308)
        .setTitle('🎭 DM Response')
        .setDescription(response.content.slice(0, 4096))
        .addFields({
          name: 'System',
          value: system,
          inline: true,
        })
        .setFooter({ text: `Tone: ${tone}` })
        .setTimestamp()

      await interaction.editReply({ embeds: [embed] })
    } else if (commandName === 'npc') {
      const type = interaction.options.getString('type', true)
      const setting = interaction.options.getString('setting') || 'fantasy world'

      const prompt = `Generate a detailed NPC for a ${setting}.
NPC Type: ${type}

Include:
- Name and appearance
- Personality traits (2-3)
- Brief backstory (2-3 sentences)
- A memorable quirk or habit
- A secret or hidden motivation
- A sample quote they might say`

      const response = await aiService.complete({
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: 'You are a creative TTRPG character designer. Create memorable and unique NPCs.',
      })

      const embed = new EmbedBuilder()
        .setColor(0x22c55e)
        .setTitle(`👤 ${type.charAt(0).toUpperCase() + type.slice(1)} NPC`)
        .setDescription(response.content.slice(0, 4096))
        .setFooter({ text: `Setting: ${setting}` })
        .setTimestamp()

      await interaction.editReply({ embeds: [embed] })
    } else if (commandName === 'lore') {
      const topic = interaction.options.getString('topic', true)
      const style = interaction.options.getString('style') || 'chronicle'

      const styleDescriptions: Record<string, string> = {
        chronicle: 'a historical chronicle written by a scholar',
        legend: 'an ancient legend passed down through generations',
        scholarly: 'an academic essay from a learned institution',
        tavern: 'a tale told by a traveling bard in a tavern',
      }

      const prompt = `Write ${styleDescriptions[style]} about: ${topic}

Keep it engaging and suitable for use in a TTRPG campaign. Include specific details that a Game Master could use.`

      const response = await aiService.complete({
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: 'You are a master storyteller and world-builder for fantasy settings.',
      })

      const embed = new EmbedBuilder()
        .setColor(0x8b5cf6)
        .setTitle(`📜 ${topic}`)
        .setDescription(response.content.slice(0, 4096))
        .setFooter({ text: `Style: ${style}` })
        .setTimestamp()

      await interaction.editReply({ embeds: [embed] })
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate response'
    await interaction.editReply({
      content: `❌ ${errorMessage}`,
    })
  }
}
