/**
 * AI Generation Commands
 * /write - Text generation with Claude/GPT
 * /imagine - Image generation with DALL-E
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { FumbleBotClient } from '../../client.js';
import { AIService } from '../../../ai/service.js';
import { isAdmin } from '../../../../config.js';

export const aiGenerateCommands = [
  // /write command
  new SlashCommandBuilder()
    .setName('write')
    .setDescription('Generate text using AI')
    .addStringOption((option) =>
      option
        .setName('prompt')
        .setDescription('What to write about')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('style')
        .setDescription('Writing style')
        .setRequired(false)
        .addChoices(
          { name: 'Creative', value: 'creative' },
          { name: 'Professional', value: 'professional' },
          { name: 'Casual', value: 'casual' },
          { name: 'Academic', value: 'academic' },
          { name: 'Fantasy/TTRPG', value: 'fantasy' }
        )
    )
    .addStringOption((option) =>
      option
        .setName('length')
        .setDescription('Response length')
        .setRequired(false)
        .addChoices(
          { name: 'Short (1-2 paragraphs)', value: 'short' },
          { name: 'Medium (3-4 paragraphs)', value: 'medium' },
          { name: 'Long (5+ paragraphs)', value: 'long' }
        )
    )
    .addBooleanOption((option) =>
      option
        .setName('private')
        .setDescription('Only show the result to you')
        .setRequired(false)
    ),

  // /imagine command
  new SlashCommandBuilder()
    .setName('imagine')
    .setDescription('Generate an image using AI (DALL-E)')
    .addStringOption((option) =>
      option
        .setName('prompt')
        .setDescription('Describe the image you want')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('size')
        .setDescription('Image dimensions')
        .setRequired(false)
        .addChoices(
          { name: 'Square (1024x1024)', value: '1024x1024' },
          { name: 'Landscape (1792x1024)', value: '1792x1024' },
          { name: 'Portrait (1024x1792)', value: '1024x1792' }
        )
    )
    .addStringOption((option) =>
      option
        .setName('style')
        .setDescription('Art style hint to add to prompt')
        .setRequired(false)
        .addChoices(
          { name: 'Fantasy Art', value: 'fantasy art style, detailed, epic' },
          { name: 'Realistic', value: 'photorealistic, detailed, high quality' },
          { name: 'Anime', value: 'anime style, vibrant colors' },
          { name: 'Oil Painting', value: 'oil painting style, classical art' },
          { name: 'Pixel Art', value: 'pixel art style, retro gaming' },
          { name: 'Watercolor', value: 'watercolor painting style, soft colors' }
        )
    )
    .addBooleanOption((option) =>
      option
        .setName('private')
        .setDescription('Only show the result to you')
        .setRequired(false)
    ),
];

export async function aiGenerateHandler(
  interaction: ChatInputCommandInteraction,
  _bot: FumbleBotClient
): Promise<void> {
  // Admin-only check - these commands use expensive AI APIs
  if (!isAdmin(interaction.user.id)) {
    await interaction.reply({
      content: 'This command is only available to server admins.',
      ephemeral: true,
    });
    return;
  }

  const command = interaction.commandName;

  if (command === 'write') {
    await handleWrite(interaction);
  } else if (command === 'imagine') {
    await handleImagine(interaction);
  }
}

async function handleWrite(interaction: ChatInputCommandInteraction): Promise<void> {
  const prompt = interaction.options.getString('prompt', true);
  const style = interaction.options.getString('style') ?? 'creative';
  const length = interaction.options.getString('length') ?? 'medium';
  const isPrivate = interaction.options.getBoolean('private') ?? false;

  await interaction.deferReply({ ephemeral: isPrivate });

  const aiService = AIService.getInstance();

  if (!aiService.isProviderAvailable('anthropic')) {
    await interaction.editReply({
      content: '❌ AI service is not available. Please try again later.',
    });
    return;
  }

  // Build style instructions
  const styleInstructions: Record<string, string> = {
    creative: 'Be creative, engaging, and use vivid language.',
    professional: 'Be professional, clear, and formal.',
    casual: 'Be conversational, friendly, and relaxed.',
    academic: 'Be scholarly, well-structured, and cite concepts where relevant.',
    fantasy: 'Write in a fantasy/TTRPG style with dramatic flair and immersive descriptions.',
  };

  // Build length instructions
  const lengthTokens: Record<string, number> = {
    short: 300,
    medium: 600,
    long: 1200,
  };

  const lengthInstructions: Record<string, string> = {
    short: 'Keep your response to 1-2 paragraphs.',
    medium: 'Write 3-4 paragraphs.',
    long: 'Write a detailed response of 5 or more paragraphs.',
  };

  try {
    const result = await aiService.chat(
      [{ role: 'user', content: prompt }],
      `You are a creative writing assistant. ${styleInstructions[style]} ${lengthInstructions[length]}`,
      { maxTokens: lengthTokens[length], temperature: 0.8 }
    );

    // Split into chunks if too long for Discord
    const content = result.content;
    if (content.length <= 4000) {
      const embed = new EmbedBuilder()
        .setTitle('✍️ Generated Text')
        .setDescription(content)
        .setColor(0x9B59B6)
        .setFooter({
          text: `Style: ${style} | Length: ${length} | Requested by ${interaction.user.username}`,
        });

      await interaction.editReply({ embeds: [embed] });
    } else {
      // For very long responses, send as text
      await interaction.editReply({
        content: `**✍️ Generated Text** (${style}, ${length})\n\n${content.substring(0, 1900)}...`,
      });

      // Send additional chunks as follow-up
      for (let i = 1900; i < content.length; i += 1900) {
        await interaction.followUp({
          content: content.substring(i, i + 1900),
          ephemeral: isPrivate,
        });
      }
    }
  } catch (error) {
    console.error('[Write] Generation error:', error);
    await interaction.editReply({
      content: `❌ Failed to generate text: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

async function handleImagine(interaction: ChatInputCommandInteraction): Promise<void> {
  const prompt = interaction.options.getString('prompt', true);
  const size = (interaction.options.getString('size') ?? '1024x1024') as '1024x1024' | '1792x1024' | '1024x1792';
  const styleHint = interaction.options.getString('style');
  const isPrivate = interaction.options.getBoolean('private') ?? false;

  await interaction.deferReply({ ephemeral: isPrivate });

  const aiService = AIService.getInstance();

  if (!aiService.isProviderAvailable('openai')) {
    await interaction.editReply({
      content: '❌ Image generation service is not available. Please try again later.',
    });
    return;
  }

  try {
    // Combine prompt with style hint if provided
    const fullPrompt = styleHint ? `${prompt}, ${styleHint}` : prompt;

    const imageUrl = await aiService.generateImage(fullPrompt, size);

    if (!imageUrl) {
      await interaction.editReply({
        content: '❌ Failed to generate image. The service returned no result.',
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('🎨 Generated Image')
      .setDescription(`**Prompt:** ${prompt}${styleHint ? `\n**Style:** ${styleHint}` : ''}`)
      .setImage(imageUrl)
      .setColor(0xE91E63)
      .setFooter({
        text: `Size: ${size} | Requested by ${interaction.user.username}`,
      });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('[Imagine] Generation error:', error);

    // Handle content policy violations
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('content_policy') || errorMessage.includes('safety')) {
      await interaction.editReply({
        content: '❌ Your prompt was rejected by the content policy. Please try a different prompt.',
      });
    } else {
      await interaction.editReply({
        content: `❌ Failed to generate image: ${errorMessage}`,
      });
    }
  }
}
