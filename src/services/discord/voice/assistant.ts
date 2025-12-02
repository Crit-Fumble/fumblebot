/**
 * Voice Assistant for FumbleBot
 * Handles voice commands after wake word detection
 *
 * Flow:
 * 1. User says "Hey FumbleBot, roll initiative"
 * 2. VoiceListener detects wake word and extracts command
 * 3. VoiceAssistant processes command via AI
 * 4. Response is synthesized and played back (optional TTS)
 *
 * Transcription Features:
 * - Collects all transcriptions during a voice session
 * - Posts batch summaries to text channel during pauses
 * - Generates full markdown transcript when leaving voice
 */

import { EventEmitter } from 'events';
import { AttachmentBuilder, EmbedBuilder, ActivityType } from 'discord.js';
import type { VoiceBasedChannel, GuildMember, TextChannel, Client, VoiceState } from 'discord.js';
import { voiceClient, VoiceClient } from './client.js';
import { voiceListener, VoiceListener } from './listener.js';
import { deepgramListener, DeepgramListener } from './deepgram-listener.js';
import { deepgramTTS, DeepgramTTS, type DeepgramVoice } from './deepgram-tts.js';
import { getPromptsForContext } from '../../../controllers/prompts.js';
import { AIService } from '../../ai/service.js';
import OpenAI from 'openai';
import { loadOpenAIConfig, getVoiceConfig } from '../../../config.js';
import { getMCPPromptForContext, MCP_TOOLS_SHORT_PROMPT } from './mcp-tools-prompt.js';

/** Intent parsing result from LLM */
export interface IntentResult {
  /** Should FumbleBot respond to this? */
  shouldRespond: boolean;
  /** Why should/shouldn't FumbleBot respond? */
  reason: 'wake_word' | 'dice_request' | 'rule_question' | 'valuable_info' | 'search_request' | 'post_request' | 'not_for_bot';
  /** The intent type if responding */
  intent?: 'roll_dice' | 'lookup_rule' | 'question' | 'greeting' | 'goodbye' | 'search_messages' | 'post_to_channel' | 'other';
  /** Parsed dice expression if applicable (e.g., "2d20+5") */
  diceExpression?: string;
  /** The question or request extracted */
  request?: string;
  /** Short response to give (if intent is clear enough) */
  suggestedResponse?: string;
  /** Search query for message search (extracted keywords, NPC name, topic, etc.) */
  searchQuery?: string;
  /** Target channel name for posting (e.g., "logs", "session-notes", "general") */
  targetChannel?: string;
  /** Content to post (session summary, search result, etc.) */
  contentToPost?: string;
}

/** Individual transcription entry */
export interface TranscriptionEntry {
  userId: string;
  username: string;
  text: string;
  timestamp: number;
  isCommand: boolean;
}

/** Session transcript containing all entries */
export interface SessionTranscript {
  guildId: string;
  channelId: string;
  channelName: string;
  startTime: number;
  endTime?: number;
  entries: TranscriptionEntry[];
  /** Index of last entry posted to text channel */
  lastPostedIndex: number;
}

/** Live subtitle message state */
interface SubtitleState {
  /** The message being edited for live subtitles */
  message: import('discord.js').Message | null;
  /** Recent lines to show (rolling window) */
  lines: string[];
  /** Last update timestamp */
  lastUpdate: number;
  /** Maximum lines to show */
  maxLines: number;
}

export interface VoiceAssistantConfig {
  /** Enable/disable TTS responses */
  ttsEnabled: boolean;
  /** Guild ID for test mode */
  testGuildId?: string;
  /** Text channel to send transcriptions to */
  transcriptChannelId?: string;
  /** Whether to log all transcriptions */
  logTranscriptions: boolean;
  /** Enable live subtitle mode (real-time scrolling transcription) */
  liveSubtitlesEnabled: boolean;
  /** Maximum lines to show in live subtitles */
  subtitleMaxLines: number;
  /** Subtitle update debounce (ms) */
  subtitleDebounceMs: number;
  /** Transcription provider: 'deepgram' (preferred) or 'whisper' (fallback) */
  transcriptionProvider: 'deepgram' | 'whisper' | 'auto';
  /** TTS provider: 'deepgram' (faster) or 'openai' (more expressive) */
  ttsProvider: 'deepgram' | 'openai' | 'auto';
  /** Deepgram voice to use (if using Deepgram TTS) */
  deepgramVoice: DeepgramVoice;
}

export interface VoiceCommand {
  userId: string;
  guildId: string;
  channelId: string;
  command: string;
  timestamp: number;
}

const DEFAULT_CONFIG: VoiceAssistantConfig = {
  ttsEnabled: true, // TTS enabled for audible responses
  logTranscriptions: true,
  liveSubtitlesEnabled: true, // Real-time scrolling subtitles
  subtitleMaxLines: 8, // Show last 8 lines
  subtitleDebounceMs: 500, // Update at most every 500ms
  transcriptionProvider: 'auto', // Auto-select best available (Deepgram preferred)
  ttsProvider: 'auto', // Auto-select best available (Deepgram preferred for speed)
  deepgramVoice: 'aura-orion-en', // Male narrator voice for TTRPG
};

interface GuildVoiceState {
  guildId: string;
  channelId: string;
  channel: VoiceBasedChannel;
  isPaused: boolean;
  botId: string;
  whisperPrompt: string;
  /** Text channel for posting transcriptions */
  textChannel?: TextChannel;
  /** Active transcript for this session */
  transcript: SessionTranscript;
  /** Live subtitle state */
  subtitles: SubtitleState;
  /** Subtitle update debounce timer */
  subtitleTimer?: NodeJS.Timeout;
  /** Which transcription provider is being used */
  transcriptionProvider: 'deepgram' | 'whisper';
  /** Which TTS provider is being used */
  ttsProvider: 'deepgram' | 'openai';
  /** Session mode: transcribe-only or full assistant */
  mode: 'transcribe' | 'assistant';
  /** Discord user ID of admin who started the session */
  startedBy: string;
}

// Default whisper prompt for wake word detection
const DEFAULT_WHISPER_PROMPT = 'Hey FumbleBot, roll d20, roll initiative, fumblebot, goodbye';

export class VoiceAssistant extends EventEmitter {
  private config: VoiceAssistantConfig;
  private openai: OpenAI | null = null;
  private aiService: AIService;
  private activeGuilds: Map<string, GuildVoiceState> = new Map();
  private commandHistory: VoiceCommand[] = [];
  private discordClient: Client | null = null;

  constructor(config: Partial<VoiceAssistantConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.aiService = AIService.getInstance();
    this.initOpenAI();
    this.setupListeners();
  }

  private initOpenAI(): void {
    try {
      const openaiConfig = loadOpenAIConfig();
      if (openaiConfig.apiKey) {
        this.openai = new OpenAI({ apiKey: openaiConfig.apiKey });
        console.log('[VoiceAssistant] OpenAI client initialized for TTS');
      }
    } catch {
      console.warn('[VoiceAssistant] OpenAI config not available');
    }
  }

  /**
   * Fast pattern-based intent detection (no LLM, ~0ms)
   * Handles common commands like dice rolls and goodbye
   */
  private detectFastIntent(textLower: string): IntentResult | null {
    // Check for goodbye/exit commands - require explicit wake word or "stop listening"
    // Isolated "goodbye" or "bye" are likely Whisper hallucinations
    const hasFumblebotGoodbye =
      textLower.includes('goodbye fumblebot') ||
      textLower.includes('bye fumblebot') ||
      textLower.includes('fumblebot goodbye') ||
      textLower.includes('fumblebot bye') ||
      textLower.includes('fumblebot stop') ||
      textLower.includes('stop listening');

    if (hasFumblebotGoodbye) {
      return {
        shouldRespond: true,
        reason: 'wake_word',
        intent: 'goodbye',
      };
    }

    // Check for dice roll patterns with or without wake word
    // Matches: "roll d20", "roll a d20", "roll 2d6+3", "d20", "fumblebot roll d20"
    const hasFumblebot = textLower.includes('fumblebot') || textLower.includes('fumble bot');
    const hasRollKeyword = textLower.includes('roll');
    const diceMatch = textLower.match(/(\d+)?d(\d+)([+-]\d+)?/i);

    if (diceMatch && (hasFumblebot || hasRollKeyword)) {
      const count = diceMatch[1] || '1';
      const sides = diceMatch[2];
      const modifier = diceMatch[3] || '';
      return {
        shouldRespond: true,
        reason: 'dice_request',
        intent: 'roll_dice',
        diceExpression: `${count}d${sides}${modifier}`,
      };
    }

    // Check for initiative (common TTRPG request)
    if ((hasFumblebot || hasRollKeyword) && textLower.includes('initiative')) {
      return {
        shouldRespond: true,
        reason: 'dice_request',
        intent: 'roll_dice',
        diceExpression: 'd20',
        request: 'initiative',
      };
    }

    // Check for greetings with wake word
    if (hasFumblebot && (textLower.includes('hello') || textLower.includes('hi '))) {
      return {
        shouldRespond: true,
        reason: 'wake_word',
        intent: 'greeting',
        suggestedResponse: "Hello! I'm ready to help with your game. Ask me to roll dice or look up rules!",
      };
    }

    return null; // No fast match, use LLM
  }

  /**
   * Parse transcription intent using Claude Haiku
   * Determines if FumbleBot should respond and what action to take
   */
  private async parseIntent(text: string, recentContext?: string): Promise<IntentResult> {
    const prompt = `You are FumbleBot, a TTRPG assistant for Discord voice channels. Analyze this transcription and determine if you should respond.

RULES:
1. ONLY respond if:
   - User says your name ("FumbleBot", "Fumble", "Hey Fumblebot")
   - User asks to roll dice ("roll a d20", "roll initiative", "give me a strength check")
   - User asks a D&D rules question
   - User asks to search Discord messages ("what was that NPC's name", "find the message about X", "search for Y")
   - User asks to post something to a channel ("post summary in logs", "send that to session-notes")
   - You have CRITICAL info to add (rarely - don't interrupt normal conversation)

2. DO NOT respond to:
   - Normal player conversation
   - In-character roleplay between players
   - Planning discussions that don't need dice

Transcription: "${text}"
${recentContext ? `\nRecent context:\n${recentContext}` : ''}

Respond with ONLY valid JSON (no markdown, no code blocks):
{
  "shouldRespond": true/false,
  "reason": "wake_word" | "dice_request" | "rule_question" | "valuable_info" | "search_request" | "post_request" | "not_for_bot",
  "intent": "roll_dice" | "lookup_rule" | "question" | "greeting" | "goodbye" | "search_messages" | "post_to_channel" | "other",
  "diceExpression": "XdY+Z format if rolling dice, null otherwise",
  "request": "the extracted request/question if any",
  "suggestedResponse": "short response (1-2 sentences max) with markdown, null if not responding",
  "searchQuery": "keywords/topic to search for if search_messages intent, null otherwise",
  "targetChannel": "channel name to post to if post_to_channel intent (e.g. 'logs', 'session-notes'), null otherwise",
  "contentToPost": "what to post (e.g. 'session summary', 'search result') if posting, null otherwise"
}`;

    try {
      const result = await this.aiService.lookup(prompt, undefined, { maxTokens: 300 });
      const parsed = JSON.parse(result.content.trim());
      return parsed as IntentResult;
    } catch (error) {
      console.error('[VoiceAssistant] Failed to parse intent:', error);
      // Fallback to simple wake word detection
      const hasWakeWord = text.toLowerCase().includes('fumblebot') ||
                          text.toLowerCase().includes('hey fumble');
      return {
        shouldRespond: hasWakeWord,
        reason: hasWakeWord ? 'wake_word' : 'not_for_bot',
        intent: hasWakeWord ? 'other' : undefined,
        request: hasWakeWord ? text : undefined,
      };
    }
  }

  /**
   * Execute a dice roll from expression
   * Returns a result object with both display and TTS-friendly text
   */
  private rollDice(expression: string): { display: string; spoken: string } {
    // Parse dice expression like "2d20+5", "d20", "4d6"
    const match = expression.match(/(\d+)?d(\d+)([+-]\d+)?/i);
    if (!match) {
      // Default to d20
      const roll = Math.floor(Math.random() * 20) + 1;
      const critText = roll === 20 ? ' Critical!' : roll === 1 ? ' Fumble!' : '';
      return {
        display: `🎲 **d20**: ${roll}${roll === 20 ? ' *(Critical!)*' : roll === 1 ? ' *(Fumble!)*' : ''}`,
        spoken: `Rolled a ${roll}.${critText}`,
      };
    }

    const count = parseInt(match[1] || '1');
    const sides = parseInt(match[2]);
    const modifier = parseInt(match[3] || '0');

    const rolls: number[] = [];
    for (let i = 0; i < count; i++) {
      rolls.push(Math.floor(Math.random() * sides) + 1);
    }

    const total = rolls.reduce((a, b) => a + b, 0) + modifier;
    const modStr = modifier !== 0 ? (modifier > 0 ? `+${modifier}` : `${modifier}`) : '';

    // Check for crits on d20
    let critNote = '';
    let critSpoken = '';
    if (sides === 20 && count === 1) {
      if (rolls[0] === 20) {
        critNote = ' *(Critical!)*';
        critSpoken = ' Critical!';
      } else if (rolls[0] === 1) {
        critNote = ' *(Fumble!)*';
        critSpoken = ' Fumble!';
      }
    }

    // Format spoken text naturally
    let spoken = '';
    if (count === 1) {
      spoken = `Rolled a ${total}.${critSpoken}`;
    } else {
      spoken = `Rolled ${count}d${sides}${modStr ? ` ${modStr.replace('+', 'plus ').replace('-', 'minus ')}` : ''} for a total of ${total}.`;
    }

    return {
      display: `🎲 **${count}d${sides}${modStr}**: [${rolls.join(', ')}]${modStr ? ` → **${total}**` : ` = **${total}**`}${critNote}`,
      spoken,
    };
  }

  /**
   * Search Discord messages across channels in a guild
   * Returns relevant messages that match the search query
   */
  private async searchDiscordMessages(
    guildId: string,
    query: string,
    limit: number = 100
  ): Promise<{ content: string; author: string; channel: string; timestamp: Date; url: string }[]> {
    if (!this.discordClient) {
      console.warn('[VoiceAssistant] No Discord client for message search');
      return [];
    }

    const guild = this.discordClient.guilds.cache.get(guildId);
    if (!guild) {
      console.warn(`[VoiceAssistant] Guild ${guildId} not found`);
      return [];
    }

    const results: { content: string; author: string; channel: string; timestamp: Date; url: string }[] = [];
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2);

    // Get all text channels the bot can read
    const textChannels = guild.channels.cache.filter(
      (ch): ch is TextChannel => ch.isTextBased() && !ch.isVoiceBased() && ch.viewable
    );

    console.log(`[VoiceAssistant] Searching ${textChannels.size} channels for: "${query}"`);

    // Search each channel (limit to 50 messages per channel for performance)
    const perChannelLimit = Math.ceil(limit / Math.min(textChannels.size, 5));

    for (const [, channel] of textChannels) {
      if (results.length >= limit) break;

      try {
        const messages = await channel.messages.fetch({ limit: 100 });

        for (const [, msg] of messages) {
          if (results.length >= limit) break;

          // Skip bot messages and empty messages
          if (msg.author.bot || !msg.content) continue;

          const contentLower = msg.content.toLowerCase();

          // Check if message matches any search terms
          const matches = queryTerms.some(term => contentLower.includes(term));
          if (matches) {
            results.push({
              content: msg.content.slice(0, 500), // Truncate long messages
              author: msg.author.displayName || msg.author.username,
              channel: channel.name,
              timestamp: msg.createdAt,
              url: msg.url,
            });
          }
        }
      } catch (error) {
        console.warn(`[VoiceAssistant] Could not search channel ${channel.name}:`, error);
      }
    }

    // Sort by relevance (more term matches) and recency
    results.sort((a, b) => {
      const aMatches = queryTerms.filter(t => a.content.toLowerCase().includes(t)).length;
      const bMatches = queryTerms.filter(t => b.content.toLowerCase().includes(t)).length;
      if (bMatches !== aMatches) return bMatches - aMatches;
      return b.timestamp.getTime() - a.timestamp.getTime();
    });

    console.log(`[VoiceAssistant] Found ${results.length} matching messages`);
    return results.slice(0, limit);
  }

  /**
   * Find a channel by name in a guild
   */
  private findChannelByName(guildId: string, channelName: string): TextChannel | null {
    if (!this.discordClient) return null;

    const guild = this.discordClient.guilds.cache.get(guildId);
    if (!guild) return null;

    const normalizedName = channelName.toLowerCase().replace(/[^a-z0-9-]/g, '');

    // First try exact match
    const exactMatch = guild.channels.cache.find(
      (ch): ch is TextChannel =>
        ch.isTextBased() &&
        !ch.isVoiceBased() &&
        ch.name.toLowerCase() === normalizedName
    );
    if (exactMatch) return exactMatch;

    // Then try partial match
    const partialMatch = guild.channels.cache.find(
      (ch): ch is TextChannel =>
        ch.isTextBased() &&
        !ch.isVoiceBased() &&
        ch.name.toLowerCase().includes(normalizedName)
    );
    if (partialMatch) return partialMatch;

    return null;
  }

  /**
   * Post content to a specific channel
   */
  private async postToChannel(
    guildId: string,
    channelName: string,
    content: string,
    asEmbed: boolean = true
  ): Promise<{ success: boolean; channelName: string; error?: string }> {
    const channel = this.findChannelByName(guildId, channelName);

    if (!channel) {
      return { success: false, channelName, error: `Channel "${channelName}" not found` };
    }

    try {
      if (asEmbed) {
        const embed = new EmbedBuilder()
          .setDescription(content)
          .setColor(0x7c3aed)
          .setFooter({ text: 'Posted by FumbleBot Voice Assistant' })
          .setTimestamp();

        await channel.send({ embeds: [embed] });
      } else {
        await channel.send(content);
      }

      return { success: true, channelName: channel.name };
    } catch (error) {
      console.error(`[VoiceAssistant] Failed to post to channel ${channel.name}:`, error);
      return { success: false, channelName: channel.name, error: String(error) };
    }
  }

  /**
   * Process search results and generate a summary using AI
   */
  private async summarizeSearchResults(
    query: string,
    results: { content: string; author: string; channel: string; timestamp: Date }[]
  ): Promise<{ display: string; spoken: string }> {
    if (results.length === 0) {
      return {
        display: `🔍 No messages found matching "${query}"`,
        spoken: `I couldn't find any messages about ${query}.`,
      };
    }

    // Build context from search results
    const contextLines = results.slice(0, 10).map(r =>
      `[${r.channel}] ${r.author}: ${r.content}`
    );
    const context = contextLines.join('\n\n');

    try {
      // Use AI to summarize/answer based on found messages
      const summaryResult = await this.aiService.lookup(
        `Based on these Discord messages, answer the user's question: "${query}"

Messages found:
${context}

Provide a concise answer (1-3 sentences). If asking about a name/NPC/item, give the specific name. Reference who said it if relevant.`,
        'You are FumbleBot summarizing Discord messages. Be helpful and specific.',
        { maxTokens: 200 }
      );

      const answer = summaryResult.content;

      // Build display with source links
      const topResult = results[0];
      const display = `🔍 **Search: "${query}"**\n\n${answer}\n\n*Found in #${topResult.channel} (${results.length} matches)*`;

      return {
        display,
        spoken: answer,
      };
    } catch (error) {
      console.error('[VoiceAssistant] Failed to summarize search results:', error);
      // Fallback to simple display
      const topResult = results[0];
      return {
        display: `🔍 **Search: "${query}"**\n\nFound ${results.length} messages. Most recent in #${topResult.channel}:\n> ${topResult.content.slice(0, 200)}`,
        spoken: `I found ${results.length} messages about ${query}. The most recent one from ${topResult.author} says: ${topResult.content.slice(0, 150)}`,
      };
    }
  }

  /**
   * Set the Discord client for voice state tracking
   * This allows us to pause/resume listening based on channel occupancy
   */
  setDiscordClient(client: Client): void {
    if (this.discordClient) {
      console.log('[VoiceAssistant] Discord client already set, removing old listener');
      this.discordClient.removeListener('voiceStateUpdate', this.handleVoiceStateUpdate);
    }

    this.discordClient = client;
    this.discordClient.on('voiceStateUpdate', this.handleVoiceStateUpdate);
    console.log('[VoiceAssistant] Discord client set, listening for voice state updates');
  }

  /**
   * Handle voice state updates (users joining/leaving voice channels)
   */
  private handleVoiceStateUpdate = (oldState: VoiceState, newState: VoiceState): void => {
    const guildId = newState.guild.id;
    const state = this.activeGuilds.get(guildId);

    // Only care about guilds where we're actively listening
    if (!state) return;

    // Check if this update is for our channel
    const isOurChannel =
      oldState.channelId === state.channelId ||
      newState.channelId === state.channelId;

    if (!isOurChannel) return;

    // Get current members in the channel (excluding bots)
    const channel = state.channel;
    const humanMembers = channel.members.filter(member => !member.user.bot);
    const humanCount = humanMembers.size;

    console.log(`[VoiceAssistant] Voice state update in ${channel.name}: ${humanCount} humans present`);

    if (humanCount === 0 && !state.isPaused) {
      // No humans in channel, pause listening
      console.log('[VoiceAssistant] No humans in channel, pausing listener');
      if (state.transcriptionProvider === 'deepgram') {
        deepgramListener.stopListening();
      } else {
        voiceListener.stopListening();
      }
      state.isPaused = true;
      this.emit('paused', { guildId, reason: 'no_humans' });
    } else if (humanCount > 0 && state.isPaused) {
      // Humans returned, resume listening
      console.log('[VoiceAssistant] Humans returned to channel, resuming listener');
      const connection = voiceClient.getConnection(guildId);
      if (connection) {
        if (state.transcriptionProvider === 'deepgram') {
          deepgramListener.startListening(connection, guildId, state.channel);
        } else {
          voiceListener.startListening(connection, guildId, state.whisperPrompt);
        }
        state.isPaused = false;
        this.emit('resumed', { guildId, humanCount });
      }
    }
  };

  private setupListeners(): void {
    // ==========================================
    // Whisper-based listener (fallback)
    // ==========================================
    voiceListener.on('wakeWord', async (userId: string, command: string) => {
      const guildId = voiceListener.currentGuildId;
      await this.handleWakeWord(guildId, userId, command, 'whisper');
    });

    voiceListener.on('transcription', async (userId: string, text: string) => {
      const guildId = voiceListener.currentGuildId;
      await this.handleTranscription(guildId, userId, text, 'whisper');
    });

    voiceListener.on('error', (error: Error) => {
      console.error('[VoiceAssistant] Whisper listener error:', error);
      this.emit('error', error);
    });

    // ==========================================
    // Deepgram-based listener (preferred)
    // ==========================================
    deepgramListener.on('wakeWord', async (userId: string, command: string) => {
      const guildId = deepgramListener.currentGuildId;
      await this.handleWakeWord(guildId, userId, command, 'deepgram');
    });

    deepgramListener.on('transcription', async (userId: string, text: string) => {
      const guildId = deepgramListener.currentGuildId;
      await this.handleTranscription(guildId, userId, text, 'deepgram');
    });

    // Deepgram interim results - for real-time UI updates
    deepgramListener.on('interimTranscription', async (userId: string, text: string) => {
      // We could use this for real-time subtitle updates if desired
      // For now, just log it
      if (this.config.logTranscriptions) {
        console.log(`[VoiceAssistant] Interim from ${userId}: "${text}"`);
      }
    });

    deepgramListener.on('error', (error: Error) => {
      console.error('[VoiceAssistant] Deepgram listener error:', error);
      this.emit('error', error);
    });
  }

  /**
   * Handle wake word detection from either listener
   */
  private async handleWakeWord(
    guildId: string,
    userId: string,
    command: string,
    source: 'deepgram' | 'whisper'
  ): Promise<void> {
    const channelId = voiceClient.getCurrentChannel(guildId);
    const state = this.activeGuilds.get(guildId);

    if (!channelId) {
      console.warn(`[VoiceAssistant] Wake word detected (${source}) but no channel found`);
      return;
    }

    // In transcribe-only mode, don't process AI commands
    if (state?.mode === 'transcribe') {
      console.log(`[VoiceAssistant] Transcribe-only mode, ignoring wake word command: "${command}"`);
      // Still record it in transcript
      await this.addTranscriptionEntry(guildId, userId, `Hey FumbleBot, ${command}`, true);
      return;
    }

    const voiceCommand: VoiceCommand = {
      userId,
      guildId,
      channelId,
      command,
      timestamp: Date.now(),
    };

    this.commandHistory.push(voiceCommand);
    this.emit('command', voiceCommand);

    console.log(`[VoiceAssistant] Processing wake word command from ${userId} (${source}): "${command}"`);

    // Play acknowledgment sound to indicate we heard the wake word
    await this.playAcknowledgmentSound(guildId);

    // Add to transcript as a command
    await this.addTranscriptionEntry(guildId, userId, `Hey FumbleBot, ${command}`, true);

    // Process the command
    await this.processCommand(voiceCommand);
  }

  /**
   * Handle transcription from either listener
   */
  private async handleTranscription(
    guildId: string,
    userId: string,
    text: string,
    source: 'deepgram' | 'whisper'
  ): Promise<void> {
    if (this.config.logTranscriptions) {
      console.log(`[VoiceAssistant] Transcription from ${userId} (${source}): "${text}"`);
      this.emit('transcription', { userId, text, timestamp: Date.now(), source });
    }

    // Add to transcript for final session summary (but don't process for intent)
    await this.addTranscriptionEntry(guildId, userId, text, false);

    // Note: Intent detection is disabled for general transcriptions
    // FumbleBot only responds when explicitly addressed via wake word
    // This prevents interrupting normal player conversation
  }

  /**
   * Handle a detected intent (from fast path or LLM)
   */
  private async handleIntent(
    guildId: string,
    intent: IntentResult,
    state: GuildVoiceState | undefined
  ): Promise<void> {
    let response: string | null = null;
    let spokenResponse: string | null = null;

    // Show typing indicator for slow operations
    let processingMsg: import('discord.js').Message | null = null;
    const needsProcessing = intent.intent === 'lookup_rule' || intent.intent === 'question' ||
                            intent.intent === 'search_messages' || intent.intent === 'post_to_channel';
    if (state?.textChannel && needsProcessing) {
      try {
        await state.textChannel.sendTyping();
        const thinkingEmoji = intent.intent === 'search_messages' ? '🔍' : '🤔';
        const thinkingText = intent.intent === 'search_messages' ? 'Searching messages...' : 'Thinking...';
        const thinkingEmbed = new EmbedBuilder()
          .setDescription(`${thinkingEmoji} *${thinkingText}*`)
          .setColor(0x6366f1);
        processingMsg = await state.textChannel.send({ embeds: [thinkingEmbed] });
      } catch {
        // Ignore typing errors
      }
    }

    // Process the intent
    if (intent.intent === 'roll_dice' && intent.diceExpression) {
      const rollResult = this.rollDice(intent.diceExpression);
      response = rollResult.display;
      spokenResponse = rollResult.spoken;
    } else if (intent.intent === 'goodbye') {
      await this.stopListening(guildId);
      response = '👋 Goodbye! Stopping voice session.';
      spokenResponse = 'Goodbye!';
    } else if (intent.intent === 'greeting') {
      response = intent.suggestedResponse || "Hello! I'm FumbleBot, your TTRPG assistant.";
      spokenResponse = response;
    } else if (intent.intent === 'search_messages' && intent.searchQuery) {
      console.log(`[VoiceAssistant] Searching messages for: "${intent.searchQuery}"`);
      const searchResults = await this.searchDiscordMessages(guildId, intent.searchQuery, 20);
      const summary = await this.summarizeSearchResults(intent.searchQuery, searchResults);
      response = summary.display;
      spokenResponse = summary.spoken;
    } else if (intent.intent === 'post_to_channel' && intent.targetChannel) {
      const contentToPost = intent.contentToPost || intent.request || 'No content specified';
      let actualContent = contentToPost;

      // If posting session summary, generate it
      if (contentToPost.toLowerCase().includes('session') && contentToPost.toLowerCase().includes('summary')) {
        if (state && state.transcript.entries.length > 0) {
          const transcriptText = state.transcript.entries
            .map(e => `${e.username}: ${e.text}`)
            .join('\n');

          try {
            const summaryResult = await this.aiService.lookup(
              `Summarize this TTRPG voice session. Include key events, dice rolls, and decisions made.

Transcript:
${transcriptText.slice(0, 3000)}`,
              'You are FumbleBot summarizing a D&D session.',
              { maxTokens: 300 }
            );
            actualContent = `## Session Summary\n\n${summaryResult.content}`;
          } catch {
            actualContent = `## Session Transcript\n\n${state.transcript.entries.slice(-20).map(e => `**${e.username}**: ${e.text}`).join('\n')}`;
          }
        }
      }

      const postResult = await this.postToChannel(guildId, intent.targetChannel, actualContent);
      if (postResult.success) {
        response = `✅ Posted to #${postResult.channelName}`;
        spokenResponse = `Done! I posted that to ${postResult.channelName}.`;
      } else {
        response = `❌ Couldn't post: ${postResult.error}`;
        spokenResponse = `Sorry, I couldn't post to that channel. ${postResult.error}`;
      }
    } else if (intent.suggestedResponse) {
      response = intent.suggestedResponse;
    } else if (intent.request) {
      response = await this.generateResponse(intent.request);
    }

    // Delete processing message
    if (processingMsg) {
      try {
        await processingMsg.delete();
      } catch {
        // Ignore delete errors
      }
    }

    // Respond with voice (TTS) by default
    if (response) {
      if (this.config.ttsEnabled) {
        const ttsText = spokenResponse || response.replace(/[*_`#\[\]]/g, '');
        await this.speakResponse(guildId, ttsText);
      }

      // Only post to text channel for search results or post confirmations
      const shouldPostText = intent.intent === 'search_messages' || intent.intent === 'post_to_channel';
      if (shouldPostText && state?.textChannel) {
        const embed = new EmbedBuilder()
          .setDescription(response)
          .setColor(0x7c3aed)
          .setFooter({ text: `Voice request from ${state.transcript.entries.at(-1)?.username || 'Unknown'}` });

        await state.textChannel.send({ embeds: [embed] });
      }
    }
  }

  /**
   * Generate a concise AI response for a question/request
   */
  private async generateResponse(request: string): Promise<string> {
    try {
      // Get context-specific MCP tools prompt
      const mcpContext = getMCPPromptForContext(request);

      const result = await this.aiService.lookup(
        `Answer this TTRPG/D&D question concisely (1-2 sentences max). Use markdown formatting. If you cite a rule, include the source.

Question: ${request}`,
        `You are FumbleBot, a helpful D&D 5e assistant. Be brief and accurate.

${mcpContext}`,
        { maxTokens: 200 }
      );
      return result.content;
    } catch (error) {
      console.error('[VoiceAssistant] Failed to generate response:', error);
      return `I heard your request: "${request}" but couldn't process it.`;
    }
  }

  /**
   * Add a transcription entry to the session transcript
   */
  private async addTranscriptionEntry(
    guildId: string,
    userId: string,
    text: string,
    isCommand: boolean
  ): Promise<void> {
    const state = this.activeGuilds.get(guildId);
    if (!state) return;

    // Get username from Discord
    let username = 'Unknown';
    try {
      const member = state.channel.members.get(userId);
      if (member) {
        username = member.displayName || member.user.username;
      }
    } catch {
      console.warn(`[VoiceAssistant] Could not get username for ${userId}`);
    }

    // Add entry to transcript
    state.transcript.entries.push({
      userId,
      username,
      text,
      timestamp: Date.now(),
      isCommand,
    });

    console.log(`[VoiceAssistant] Added transcript entry: ${username}: "${text}"`);

    // Update live subtitles
    if (this.config.liveSubtitlesEnabled) {
      await this.updateLiveSubtitles(guildId, username, text, isCommand);
    }
  }

  /**
   * Update live subtitles (scrolling transcript)
   */
  private async updateLiveSubtitles(
    guildId: string,
    username: string,
    text: string,
    isCommand: boolean
  ): Promise<void> {
    const state = this.activeGuilds.get(guildId);
    if (!state || !state.textChannel) return;

    // Format new line
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const prefix = isCommand ? '🎤 ' : '';
    const newLine = `\`${time}\` ${prefix}**${username}**: ${text}`;

    // Add to lines array
    state.subtitles.lines.push(newLine);

    // Keep only last N lines
    while (state.subtitles.lines.length > this.config.subtitleMaxLines) {
      state.subtitles.lines.shift();
    }

    // Debounce updates to avoid rate limiting
    if (state.subtitleTimer) {
      clearTimeout(state.subtitleTimer);
    }

    state.subtitleTimer = setTimeout(async () => {
      await this.renderSubtitles(guildId);
    }, this.config.subtitleDebounceMs);
  }

  /**
   * Render subtitles to Discord message
   */
  private async renderSubtitles(guildId: string): Promise<void> {
    const state = this.activeGuilds.get(guildId);
    if (!state || !state.textChannel) return;

    const content = state.subtitles.lines.join('\n');
    if (!content) return;

    const embed = new EmbedBuilder()
      .setTitle('🎙️ Live Transcript')
      .setDescription(content)
      .setColor(0x7c3aed)
      .setFooter({ text: 'Voice session active • Updates in real-time' })
      .setTimestamp();

    try {
      if (state.subtitles.message) {
        // Edit existing message
        await state.subtitles.message.edit({ embeds: [embed] });
      } else {
        // Create new message
        state.subtitles.message = await state.textChannel.send({ embeds: [embed] });
      }
      state.subtitles.lastUpdate = Date.now();
    } catch (error) {
      // Message might have been deleted, create new one
      console.warn('[VoiceAssistant] Failed to update subtitles, creating new message');
      try {
        state.subtitles.message = await state.textChannel.send({ embeds: [embed] });
      } catch (e) {
        console.error('[VoiceAssistant] Failed to create subtitle message:', e);
      }
    }
  }

  /**
   * Play a brief acknowledgment sound when wake word is detected
   * This provides immediate feedback that the bot heard "Hey FumbleBot"
   */
  private async playAcknowledgmentSound(guildId: string): Promise<void> {
    const state = this.activeGuilds.get(guildId);
    const ttsProvider = state?.ttsProvider ?? 'openai';

    // Check if any TTS provider is available
    const hasDeepgram = deepgramTTS.isAvailable;
    const hasOpenAI = this.openai !== null;

    if (!hasDeepgram && !hasOpenAI) {
      console.log('[VoiceAssistant] No TTS provider available, skipping acknowledgment sound');
      return;
    }

    try {
      // Use a brief acknowledgment phrase
      const acknowledgment = 'Yes?';

      console.log(`[VoiceAssistant] Playing acknowledgment sound (${ttsProvider})...`);

      let buffer: Buffer;

      if (ttsProvider === 'deepgram' && hasDeepgram) {
        buffer = await deepgramTTS.synthesize(acknowledgment, {
          voice: this.config.deepgramVoice,
        });
      } else if (hasOpenAI && this.openai) {
        const response = await this.openai.audio.speech.create({
          model: 'tts-1',
          voice: 'fable',
          input: acknowledgment,
          speed: 1.1, // Slightly faster for quick acknowledgment
        });
        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      } else {
        console.warn('[VoiceAssistant] No TTS available for acknowledgment sound');
        return;
      }

      await voiceClient.playBuffer(guildId, buffer);
      console.log('[VoiceAssistant] Acknowledgment sound played');
    } catch (error) {
      console.warn('[VoiceAssistant] Failed to play acknowledgment sound:', error);
      // Non-fatal error, continue without the sound
    }
  }

  /**
   * Play a ready chime/sound when joining voice
   * This helps users know the bot is ready and also "primes" the audio system
   */
  private async playReadySound(guildId: string): Promise<void> {
    const state = this.activeGuilds.get(guildId);
    const ttsProvider = state?.ttsProvider ?? 'openai';

    // Check if any TTS provider is available
    const hasDeepgram = deepgramTTS.isAvailable;
    const hasOpenAI = this.openai !== null;

    if (!hasDeepgram && !hasOpenAI) {
      console.log('[VoiceAssistant] No TTS provider available, skipping ready sound');
      return;
    }

    try {
      // Wait for voice connection to be fully ready before speaking
      console.log('[VoiceAssistant] Waiting for voice connection to be ready...');
      const isReady = await voiceClient.waitForReady(guildId, 5000);
      if (!isReady) {
        console.warn('[VoiceAssistant] Voice connection not ready, adding extra delay');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Add a small delay to ensure audio player is initialized
      await new Promise(resolve => setTimeout(resolve, 500));

      // Determine message based on mode
      const mode = state?.mode ?? 'assistant';
      const readyMessage = mode === 'transcribe'
        ? 'Transcription Started'
        : 'Voice Assistant Ready';

      console.log(`[VoiceAssistant] Generating ready sound (${ttsProvider}): "${readyMessage}"...`);

      let buffer: Buffer;

      if (ttsProvider === 'deepgram' && hasDeepgram) {
        buffer = await deepgramTTS.synthesize(readyMessage, {
          voice: this.config.deepgramVoice,
        });
      } else if (hasOpenAI && this.openai) {
        const response = await this.openai.audio.speech.create({
          model: 'tts-1',
          voice: 'fable',
          input: readyMessage,
          speed: 0.9,
        });
        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      } else {
        console.warn('[VoiceAssistant] No TTS available for ready sound');
        return;
      }

      await voiceClient.playBuffer(guildId, buffer);
      console.log('[VoiceAssistant] Ready sound played');
    } catch (error) {
      console.warn('[VoiceAssistant] Failed to play ready sound:', error);
      // Non-fatal error, continue without the sound
    }
  }

  /**
   * Start voice assistant in a channel
   * @param channel Voice channel to join
   * @param textChannel Text channel for live subtitles
   * @param options Configuration options
   */
  async startListening(
    channel: VoiceBasedChannel,
    textChannel?: TextChannel,
    options: { mode?: 'transcribe' | 'assistant'; startedBy?: string } = {}
  ): Promise<void> {
    const { mode = 'assistant', startedBy = '' } = options;
    const guildId = channel.guild.id;

    // Check if this is a test guild restriction
    if (this.config.testGuildId && guildId !== this.config.testGuildId) {
      throw new Error('Voice assistant is only available in the test guild');
    }

    console.log(`[VoiceAssistant] Starting in channel ${channel.name} (${channel.id})`);

    // Join the voice channel
    const connection = await voiceClient.joinChannel(channel);

    // Get bot ID for filtering
    const botId = this.discordClient?.user?.id ?? '';

    // Fetch prompt partials for this channel context
    let whisperPrompt = DEFAULT_WHISPER_PROMPT;
    try {
      const categoryId = channel.parentId ?? undefined;
      const { combinedContent } = await getPromptsForContext({
        guildId,
        channelId: channel.id,
        categoryId,
      });

      if (combinedContent) {
        // Prepend custom prompts to default wake word prompts
        whisperPrompt = `${combinedContent}\n${DEFAULT_WHISPER_PROMPT}`;
        console.log(`[VoiceAssistant] Loaded ${combinedContent.length} chars of custom prompts for voice channel`);
      }
    } catch (error) {
      console.warn('[VoiceAssistant] Failed to fetch prompt partials, using defaults:', error);
    }

    // Check if there are humans in the channel
    const humanMembers = channel.members.filter(member => !member.user.bot);
    const humanCount = humanMembers.size;
    const shouldPause = humanCount === 0;

    console.log(`[VoiceAssistant] Channel has ${humanCount} humans, ${shouldPause ? 'starting paused' : 'starting active'}`);

    // Initialize session transcript
    const transcript: SessionTranscript = {
      guildId,
      channelId: channel.id,
      channelName: channel.name,
      startTime: Date.now(),
      entries: [],
      lastPostedIndex: 0,
    };

    // Initialize subtitle state
    const subtitles: SubtitleState = {
      message: null,
      lines: [],
      lastUpdate: 0,
      maxLines: this.config.subtitleMaxLines,
    };

    // Determine which transcription provider to use
    let transcriptionProvider: 'deepgram' | 'whisper' = 'whisper';
    if (this.config.transcriptionProvider === 'deepgram') {
      transcriptionProvider = 'deepgram';
    } else if (this.config.transcriptionProvider === 'auto') {
      // Auto-select: prefer Deepgram if available
      transcriptionProvider = deepgramListener.isAvailable ? 'deepgram' : 'whisper';
    }

    // Determine which TTS provider to use
    let ttsProvider: 'deepgram' | 'openai' = 'openai';
    if (this.config.ttsProvider === 'deepgram') {
      ttsProvider = 'deepgram';
    } else if (this.config.ttsProvider === 'auto') {
      // Auto-select: prefer Deepgram for speed if available
      ttsProvider = deepgramTTS.isAvailable ? 'deepgram' : 'openai';
    }

    console.log(`[VoiceAssistant] Using transcription: ${transcriptionProvider}, TTS: ${ttsProvider}`);

    // Track this guild
    this.activeGuilds.set(guildId, {
      guildId,
      channelId: channel.id,
      channel,
      isPaused: shouldPause,
      botId,
      whisperPrompt,
      textChannel,
      transcript,
      subtitles,
      transcriptionProvider,
      ttsProvider,
      mode,
      startedBy,
    });

    // Only start listening if there are humans present
    if (!shouldPause) {
      // Play ready sound BEFORE starting to listen
      // This ensures no dead air at the beginning and confirms bot is ready
      await this.playReadySound(guildId);

      // Now start listening after the ready sound has played
      if (transcriptionProvider === 'deepgram') {
        deepgramListener.startListening(connection, guildId, channel);
      } else {
        voiceListener.startListening(connection, guildId, whisperPrompt);
      }
    }

    // Update bot presence to indicate transcription/assistant is active
    if (this.discordClient?.user) {
      const presenceText = mode === 'transcribe'
        ? 'Transcription In Progress'
        : 'Voice Assistant Active';

      this.discordClient.user.setPresence({
        activities: [
          {
            name: presenceText,
            type: ActivityType.Listening,
          },
        ],
        status: 'online',
      });

      console.log(`[VoiceAssistant] Presence updated: ${presenceText}`);
    }

    this.emit('started', { guildId, channelId: channel.id, paused: shouldPause, transcriptionProvider, ttsProvider, mode });
  }

  /**
   * Stop voice assistant in a guild
   */
  async stopListening(guildId: string): Promise<void> {
    console.log(`[VoiceAssistant] Stopping in guild ${guildId}`);

    const state = this.activeGuilds.get(guildId);

    // Clear subtitle timer
    if (state?.subtitleTimer) {
      clearTimeout(state.subtitleTimer);
    }

    // Delete the live subtitle message
    if (state?.subtitles?.message) {
      try {
        await state.subtitles.message.delete();
      } catch {
        // Message might already be deleted
      }
    }

    // Generate and post full session summary with AI
    if (state && state.transcript.entries.length > 0) {
      await this.postSessionSummary(guildId);
    }

    // Stop the appropriate listener
    if (state?.transcriptionProvider === 'deepgram') {
      deepgramListener.stopListening();
    } else {
      voiceListener.stopListening();
    }
    await voiceClient.leaveChannel(guildId);

    this.activeGuilds.delete(guildId);

    // Reset bot presence to default when voice session ends
    if (this.discordClient?.user) {
      this.discordClient.user.setPresence({
        activities: [
          {
            name: 'Crit-Fumble Gaming',
            type: ActivityType.Playing,
          },
        ],
        status: 'online',
      });

      console.log('[VoiceAssistant] Presence reset to default');
    }

    this.emit('stopped', { guildId });
  }

  /**
   * Generate and post session summary with AI analysis
   */
  private async postSessionSummary(guildId: string): Promise<void> {
    const state = this.activeGuilds.get(guildId);
    if (!state || !state.textChannel || state.transcript.entries.length === 0) return;

    // Finalize transcript
    state.transcript.endTime = Date.now();

    // Calculate stats
    const duration = state.transcript.endTime - state.transcript.startTime;
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    const uniqueSpeakers = new Set(state.transcript.entries.map(e => e.userId)).size;
    const commandCount = state.transcript.entries.filter(e => e.isCommand).length;

    // Generate AI summary if there's enough content
    let aiSummary = '';
    if (state.transcript.entries.length >= 3) {
      try {
        const transcriptText = state.transcript.entries
          .map(e => `${e.username}: ${e.text}`)
          .join('\n');

        const summaryResult = await this.aiService.lookup(
          `Summarize this TTRPG voice session in 2-3 sentences. Focus on what was discussed/accomplished. Mention any dice rolls or rules questions asked.

Transcript:
${transcriptText.slice(0, 2000)}`,
          'You are FumbleBot summarizing a D&D session. Be concise and helpful.',
          { maxTokens: 150 }
        );
        aiSummary = summaryResult.content;
      } catch (error) {
        console.error('[VoiceAssistant] Failed to generate AI summary:', error);
      }
    }

    // Generate markdown transcript
    const markdown = this.generateTranscriptMarkdown(state.transcript);

    // Create filename with date
    const date = new Date(state.transcript.startTime);
    const dateStr = date.toISOString().split('T')[0];
    const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
    const filename = `transcript-${state.transcript.channelName}-${dateStr}-${timeStr}.md`;

    // Create attachment
    const attachment = new AttachmentBuilder(Buffer.from(markdown, 'utf-8'), {
      name: filename,
      description: `Voice session transcript from ${state.transcript.channelName}`,
    });

    // Create summary embed
    const embed = new EmbedBuilder()
      .setTitle('📋 Voice Session Ended')
      .setColor(0x22c55e)
      .addFields(
        { name: '⏱️ Duration', value: `${minutes}m ${seconds}s`, inline: true },
        { name: '👥 Speakers', value: `${uniqueSpeakers}`, inline: true },
        { name: '💬 Entries', value: `${state.transcript.entries.length}`, inline: true },
        { name: '🎤 Commands', value: `${commandCount}`, inline: true },
      )
      .setFooter({ text: `Full transcript attached as ${filename}` })
      .setTimestamp();

    // Add AI summary if available
    if (aiSummary) {
      embed.setDescription(`**Session Summary:**\n${aiSummary}`);
    }

    try {
      await state.textChannel.send({ embeds: [embed], files: [attachment] });
      console.log(`[VoiceAssistant] Posted session summary (${state.transcript.entries.length} entries)`);
    } catch (error) {
      console.error('[VoiceAssistant] Failed to post session summary:', error);
    }
  }

  /**
   * Generate and post full session transcript as markdown file
   */
  private async postFullTranscript(guildId: string): Promise<void> {
    const state = this.activeGuilds.get(guildId);
    if (!state || !state.textChannel || state.transcript.entries.length === 0) return;

    // Finalize transcript
    state.transcript.endTime = Date.now();

    // Generate markdown content
    const markdown = this.generateTranscriptMarkdown(state.transcript);

    // Create filename with date
    const date = new Date(state.transcript.startTime);
    const dateStr = date.toISOString().split('T')[0];
    const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
    const filename = `transcript-${state.transcript.channelName}-${dateStr}-${timeStr}.md`;

    // Create attachment
    const attachment = new AttachmentBuilder(Buffer.from(markdown, 'utf-8'), {
      name: filename,
      description: `Voice session transcript from ${state.transcript.channelName}`,
    });

    // Create summary embed
    const duration = state.transcript.endTime - state.transcript.startTime;
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);

    // Count unique speakers
    const uniqueSpeakers = new Set(state.transcript.entries.map(e => e.userId)).size;
    const commandCount = state.transcript.entries.filter(e => e.isCommand).length;

    const embed = new EmbedBuilder()
      .setTitle('📋 Voice Session Ended')
      .setDescription(`Full transcript attached as \`${filename}\``)
      .setColor(0x22c55e)
      .addFields(
        { name: 'Duration', value: `${minutes}m ${seconds}s`, inline: true },
        { name: 'Speakers', value: `${uniqueSpeakers}`, inline: true },
        { name: 'Entries', value: `${state.transcript.entries.length}`, inline: true },
        { name: 'Commands', value: `${commandCount}`, inline: true },
      )
      .setTimestamp();

    try {
      await state.textChannel.send({ embeds: [embed], files: [attachment] });
      console.log(`[VoiceAssistant] Posted full transcript (${state.transcript.entries.length} entries)`);
    } catch (error) {
      console.error('[VoiceAssistant] Failed to post full transcript:', error);
    }
  }

  /**
   * Generate markdown content for transcript
   */
  private generateTranscriptMarkdown(transcript: SessionTranscript): string {
    const startDate = new Date(transcript.startTime);
    const endDate = transcript.endTime ? new Date(transcript.endTime) : new Date();

    const lines: string[] = [
      `# Voice Session Transcript`,
      ``,
      `**Channel:** ${transcript.channelName}`,
      `**Date:** ${startDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
      `**Start Time:** ${startDate.toLocaleTimeString('en-US')}`,
      `**End Time:** ${endDate.toLocaleTimeString('en-US')}`,
      ``,
      `---`,
      ``,
      `## Transcript`,
      ``,
    ];

    // Group entries by time (within 30 second windows)
    let currentSpeaker = '';
    let currentBlock: string[] = [];

    for (const entry of transcript.entries) {
      const time = new Date(entry.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      if (entry.userId !== currentSpeaker) {
        // New speaker - flush current block and start new one
        if (currentBlock.length > 0) {
          lines.push(...currentBlock, '');
        }
        currentSpeaker = entry.userId;
        currentBlock = [];

        // Start new speaker block
        const prefix = entry.isCommand ? '🎤 ' : '';
        currentBlock.push(`### ${prefix}${entry.username} *(${time})*`);
        currentBlock.push('');
        currentBlock.push(`> ${entry.text}`);
      } else {
        // Same speaker - append to block
        currentBlock.push(`> ${entry.text}`);
      }
    }

    // Flush final block
    if (currentBlock.length > 0) {
      lines.push(...currentBlock, '');
    }

    lines.push(
      `---`,
      ``,
      `*Generated by FumbleBot Voice Assistant*`,
    );

    return lines.join('\n');
  }

  /**
   * Process a voice command
   */
  private async processCommand(command: VoiceCommand): Promise<void> {
    const { userId, guildId, command: text } = command;

    // Skip empty commands
    if (!text || text.length < 2) {
      console.log('[VoiceAssistant] Command too short, ignoring');
      return;
    }

    // Parse common commands
    const response = await this.parseAndExecuteCommand(text, userId, guildId);

    // Emit response event
    this.emit('response', {
      command,
      response,
      timestamp: Date.now(),
    });

    // Play TTS response if enabled
    if (this.config.ttsEnabled && response) {
      await this.speakResponse(guildId, response);
    }
  }

  /**
   * Parse and execute a voice command
   */
  private async parseAndExecuteCommand(
    text: string,
    userId: string,
    guildId: string
  ): Promise<string> {
    const normalized = text.toLowerCase().trim();

    // Built-in commands
    // Require explicit wake word for exit to avoid Whisper hallucination false positives
    // Isolated "goodbye" or "bye" are common Whisper hallucinations
    const isExitCommand =
      normalized.includes('goodbye fumblebot') ||
      normalized.includes('bye fumblebot') ||
      normalized.includes('fumblebot goodbye') ||
      normalized.includes('fumblebot bye') ||
      normalized.includes('fumblebot stop') ||
      normalized === 'stop listening' ||
      normalized.includes('stop listening');

    if (isExitCommand) {
      await this.stopListening(guildId);
      return 'Goodbye! I\'ll stop listening now.';
    }

    if (normalized.includes('hello') || normalized.includes('hi there')) {
      return 'Hello! I\'m FumbleBot. How can I help with your game session?';
    }

    if (normalized.includes('roll') || normalized.includes('dice')) {
      // Parse dice roll command
      const diceMatch = normalized.match(/(\d+)?d(\d+)([+-]\d+)?/);
      if (diceMatch) {
        const count = parseInt(diceMatch[1] || '1');
        const sides = parseInt(diceMatch[2]);
        const modifier = parseInt(diceMatch[3] || '0');

        let total = modifier;
        const rolls: number[] = [];

        for (let i = 0; i < count; i++) {
          const roll = Math.floor(Math.random() * sides) + 1;
          rolls.push(roll);
          total += roll;
        }

        return `Rolling ${count}d${sides}${modifier ? (modifier > 0 ? '+' : '') + modifier : ''}: [${rolls.join(', ')}] = ${total}`;
      }

      // Generic roll
      const roll = Math.floor(Math.random() * 20) + 1;
      return `Rolling d20: ${roll}${roll === 20 ? ' - Critical!' : roll === 1 ? ' - Critical fail!' : ''}`;
    }

    if (normalized.includes('initiative')) {
      const roll = Math.floor(Math.random() * 20) + 1;
      return `Initiative roll: ${roll}. Ready to fight!`;
    }

    if (normalized.includes('help')) {
      return 'You can ask me to roll dice, check initiative, or say goodbye to stop listening.';
    }

    // Default: acknowledge but don't process unknown commands
    return `I heard: "${text}". I'm not sure how to handle that command yet.`;
  }

  /**
   * Synthesize and play TTS response
   * Also adds FumbleBot's response to the session transcript
   * Uses Deepgram Aura (faster) or OpenAI TTS based on config/availability
   */
  private async speakResponse(guildId: string, text: string): Promise<void> {
    const state = this.activeGuilds.get(guildId);
    const ttsProvider = state?.ttsProvider ?? 'openai';

    try {
      // Ensure voice is ready before speaking
      await voiceClient.waitForReady(guildId, 3000);

      const startTime = Date.now();
      console.log(`[VoiceAssistant] Generating TTS (${ttsProvider}) for: "${text}"`);

      let buffer: Buffer;

      if (ttsProvider === 'deepgram' && deepgramTTS.isAvailable) {
        // Use Deepgram Aura TTS (faster, lower latency)
        buffer = await deepgramTTS.synthesize(text, {
          voice: this.config.deepgramVoice,
        });
      } else if (this.openai) {
        // Use OpenAI TTS (fallback, more expressive)
        const response = await this.openai.audio.speech.create({
          model: 'tts-1',
          voice: 'fable', // Expressive, dramatic voice for TTRPG
          input: text,
          speed: 0.9, // Slightly slower for dramatic effect
        });

        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      } else {
        console.warn('[VoiceAssistant] No TTS provider available');
        return;
      }

      const ttsLatency = Date.now() - startTime;
      console.log(`[VoiceAssistant] TTS generated in ${ttsLatency}ms (${buffer.length} bytes)`);

      // Play audio
      await voiceClient.playBuffer(guildId, buffer);

      // Add FumbleBot's response to the transcript
      await this.addBotResponseToTranscript(guildId, text);

      console.log('[VoiceAssistant] TTS playback complete');
    } catch (error) {
      console.error('[VoiceAssistant] TTS error:', error);
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Add FumbleBot's response to the session transcript
   */
  private async addBotResponseToTranscript(guildId: string, text: string): Promise<void> {
    const state = this.activeGuilds.get(guildId);
    if (!state) return;

    const botId = state.botId || 'fumblebot';
    const botName = 'FumbleBot';

    // Add entry to transcript
    state.transcript.entries.push({
      userId: botId,
      username: botName,
      text,
      timestamp: Date.now(),
      isCommand: false,
    });

    console.log(`[VoiceAssistant] Added bot response to transcript: "${text}"`);

    // Update live subtitles with bot response
    if (this.config.liveSubtitlesEnabled) {
      await this.updateLiveSubtitles(guildId, botName, text, false);
    }
  }

  /**
   * Check if assistant is active in a guild
   */
  isActive(guildId: string): boolean {
    return this.activeGuilds.has(guildId);
  }

  /**
   * Get all active guilds
   */
  getActiveGuilds(): string[] {
    return Array.from(this.activeGuilds.keys());
  }

  /**
   * Check if listening is paused in a guild
   */
  isPaused(guildId: string): boolean {
    const state = this.activeGuilds.get(guildId);
    return state?.isPaused ?? false;
  }

  /**
   * Get session info for a guild
   */
  getSessionInfo(guildId: string): { mode: 'transcribe' | 'assistant'; startedBy: string } | null {
    const state = this.activeGuilds.get(guildId);
    if (!state) return null;
    return { mode: state.mode, startedBy: state.startedBy };
  }

  /**
   * Enable assistant mode (upgrade from transcribe-only)
   */
  enableAssistantMode(guildId: string, userId?: string): boolean {
    const state = this.activeGuilds.get(guildId);
    if (!state) return false;

    state.mode = 'assistant';
    if (userId) {
      state.startedBy = userId;
    }

    console.log(`[VoiceAssistant] Upgraded to assistant mode in guild ${guildId}`);
    this.emit('modeChanged', { guildId, mode: 'assistant' });
    return true;
  }

  /**
   * Get the transcript for a guild session
   */
  getTranscript(guildId: string): SessionTranscript | null {
    const state = this.activeGuilds.get(guildId);
    return state?.transcript ?? null;
  }

  /**
   * DM session transcript to a user
   */
  async dmSessionTranscript(userId: string, guildId: string): Promise<void> {
    const state = this.activeGuilds.get(guildId);
    if (!state || !this.discordClient) {
      console.warn('[VoiceAssistant] Cannot DM transcript: no state or client');
      return;
    }

    // Finalize transcript
    state.transcript.endTime = Date.now();

    try {
      const user = await this.discordClient.users.fetch(userId);

      // Calculate stats
      const duration = state.transcript.endTime - state.transcript.startTime;
      const minutes = Math.floor(duration / 60000);
      const seconds = Math.floor((duration % 60000) / 1000);
      const uniqueSpeakers = new Set(state.transcript.entries.map(e => e.userId)).size;
      const commandCount = state.transcript.entries.filter(e => e.isCommand).length;

      // Generate AI summary if there's enough content
      let aiSummary = '';
      if (state.transcript.entries.length >= 3) {
        try {
          const transcriptText = state.transcript.entries
            .map(e => `${e.username}: ${e.text}`)
            .join('\n');

          const summaryResult = await this.aiService.lookup(
            `Summarize this TTRPG voice session in 2-3 sentences. Focus on what was discussed/accomplished. Mention any dice rolls or rules questions asked.

Transcript:
${transcriptText.slice(0, 2000)}`,
            'You are FumbleBot summarizing a D&D session. Be concise and helpful.',
            { maxTokens: 150 }
          );
          aiSummary = summaryResult.content;
        } catch (error) {
          console.error('[VoiceAssistant] Failed to generate AI summary:', error);
        }
      }

      // Generate markdown transcript
      const markdown = this.generateTranscriptMarkdown(state.transcript);

      // Create filename with date
      const date = new Date(state.transcript.startTime);
      const dateStr = date.toISOString().split('T')[0];
      const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
      const filename = `transcript-${state.transcript.channelName}-${dateStr}-${timeStr}.md`;

      // Create attachment
      const attachment = new AttachmentBuilder(Buffer.from(markdown, 'utf-8'), {
        name: filename,
        description: `Voice session transcript from ${state.transcript.channelName}`,
      });

      // Create summary embed
      const embed = new EmbedBuilder()
        .setTitle('Voice Session Transcript')
        .setColor(0x22c55e)
        .addFields(
          { name: 'Channel', value: state.transcript.channelName, inline: true },
          { name: 'Duration', value: `${minutes}m ${seconds}s`, inline: true },
          { name: 'Speakers', value: `${uniqueSpeakers}`, inline: true },
          { name: 'Entries', value: `${state.transcript.entries.length}`, inline: true },
          { name: 'Commands', value: `${commandCount}`, inline: true },
        )
        .setFooter({ text: `Full transcript attached as ${filename}` })
        .setTimestamp();

      // Add AI summary if available
      if (aiSummary) {
        embed.setDescription(`**Session Summary:**\n${aiSummary}`);
      }

      await user.send({ embeds: [embed], files: [attachment] });
      console.log(`[VoiceAssistant] DM'd transcript to user ${userId}`);
    } catch (error) {
      console.error('[VoiceAssistant] Failed to DM transcript:', error);
      throw error;
    }
  }

  /**
   * Get recent command history
   */
  getCommandHistory(limit: number = 10): VoiceCommand[] {
    return this.commandHistory.slice(-limit);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<VoiceAssistantConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): VoiceAssistantConfig {
    return { ...this.config };
  }
}

// Singleton instance with test guild from centralized config
export const voiceAssistant = new VoiceAssistant({
  testGuildId: getVoiceConfig().testGuildId,
  ttsEnabled: true, // TTS enabled for audible responses
});
