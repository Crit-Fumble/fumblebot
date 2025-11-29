/**
 * Voice Assistant for FumbleBot
 * Handles voice commands after wake word detection
 *
 * Flow:
 * 1. User says "Hey FumbleBot, roll initiative"
 * 2. VoiceListener detects wake word and extracts command
 * 3. VoiceAssistant processes command via AI
 * 4. Response is synthesized and played back (optional TTS)
 */

import { EventEmitter } from 'events';
import type { VoiceBasedChannel, GuildMember, TextChannel, Client, VoiceState } from 'discord.js';
import { voiceClient, VoiceClient } from './client.js';
import { voiceListener, VoiceListener } from './listener.js';
import { getPromptsForContext } from '../../../controllers/prompts.js';
import OpenAI from 'openai';

export interface VoiceAssistantConfig {
  /** Enable/disable TTS responses */
  ttsEnabled: boolean;
  /** Guild ID for test mode */
  testGuildId?: string;
  /** Text channel to send transcriptions to */
  transcriptChannelId?: string;
  /** Whether to log all transcriptions */
  logTranscriptions: boolean;
}

export interface VoiceCommand {
  userId: string;
  guildId: string;
  channelId: string;
  command: string;
  timestamp: number;
}

const DEFAULT_CONFIG: VoiceAssistantConfig = {
  ttsEnabled: false, // Start with TTS disabled to save costs
  logTranscriptions: true,
};

interface GuildVoiceState {
  guildId: string;
  channelId: string;
  channel: VoiceBasedChannel;
  isPaused: boolean;
  botId: string;
  whisperPrompt: string;
}

// Default whisper prompt for wake word detection
const DEFAULT_WHISPER_PROMPT = 'Hey FumbleBot, roll d20, roll initiative, fumblebot, goodbye';

export class VoiceAssistant extends EventEmitter {
  private config: VoiceAssistantConfig;
  private openai: OpenAI | null = null;
  private activeGuilds: Map<string, GuildVoiceState> = new Map();
  private commandHistory: VoiceCommand[] = [];
  private discordClient: Client | null = null;

  constructor(config: Partial<VoiceAssistantConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initOpenAI();
    this.setupListeners();
  }

  private initOpenAI(): void {
    const apiKey = process.env.FUMBLEBOT_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
      console.log('[VoiceAssistant] OpenAI client initialized for TTS');
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
      voiceListener.stopListening();
      state.isPaused = true;
      this.emit('paused', { guildId, reason: 'no_humans' });
    } else if (humanCount > 0 && state.isPaused) {
      // Humans returned, resume listening
      console.log('[VoiceAssistant] Humans returned to channel, resuming listener');
      const connection = voiceClient.getConnection(guildId);
      if (connection) {
        voiceListener.startListening(connection, guildId, state.whisperPrompt);
        state.isPaused = false;
        this.emit('resumed', { guildId, humanCount });
      }
    }
  };

  private setupListeners(): void {
    // Handle wake word detection
    voiceListener.on('wakeWord', async (userId: string, command: string) => {
      const guildId = voiceListener.currentGuildId;
      const channelId = voiceClient.getCurrentChannel(guildId);

      if (!channelId) {
        console.warn('[VoiceAssistant] Wake word detected but no channel found');
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

      console.log(`[VoiceAssistant] Processing command from ${userId}: "${command}"`);

      // Process the command
      await this.processCommand(voiceCommand);
    });

    // Log all transcriptions if enabled
    voiceListener.on('transcription', (userId: string, text: string) => {
      if (this.config.logTranscriptions) {
        console.log(`[VoiceAssistant] Transcription from ${userId}: "${text}"`);
        this.emit('transcription', { userId, text, timestamp: Date.now() });
      }
    });

    // Handle errors
    voiceListener.on('error', (error: Error) => {
      console.error('[VoiceAssistant] Listener error:', error);
      this.emit('error', error);
    });
  }

  /**
   * Start voice assistant in a channel
   */
  async startListening(channel: VoiceBasedChannel): Promise<void> {
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

    // Track this guild
    this.activeGuilds.set(guildId, {
      guildId,
      channelId: channel.id,
      channel,
      isPaused: shouldPause,
      botId,
      whisperPrompt,
    });

    // Only start listening if there are humans present
    if (!shouldPause) {
      voiceListener.startListening(connection, guildId, whisperPrompt);
    }

    this.emit('started', { guildId, channelId: channel.id, paused: shouldPause });
  }

  /**
   * Stop voice assistant in a guild
   */
  async stopListening(guildId: string): Promise<void> {
    console.log(`[VoiceAssistant] Stopping in guild ${guildId}`);

    voiceListener.stopListening();
    await voiceClient.leaveChannel(guildId);

    this.activeGuilds.delete(guildId);
    this.emit('stopped', { guildId });
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
    if (normalized.includes('stop listening') || normalized.includes('goodbye')) {
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
   */
  private async speakResponse(guildId: string, text: string): Promise<void> {
    if (!this.openai) {
      console.warn('[VoiceAssistant] OpenAI not available for TTS');
      return;
    }

    try {
      console.log(`[VoiceAssistant] Generating TTS for: "${text}"`);

      const response = await this.openai.audio.speech.create({
        model: 'tts-1',
        voice: 'nova', // Options: alloy, echo, fable, onyx, nova, shimmer
        input: text,
        speed: 1.0,
      });

      // Get audio buffer
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Play audio
      await voiceClient.playBuffer(guildId, buffer);

      console.log('[VoiceAssistant] TTS playback complete');
    } catch (error) {
      console.error('[VoiceAssistant] TTS error:', error);
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
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

// Singleton instance with test guild from env
export const voiceAssistant = new VoiceAssistant({
  testGuildId: process.env.FUMBLEBOT_DISCORD_TEST_GUILD_ID,
  ttsEnabled: false, // Start disabled to save costs
});
