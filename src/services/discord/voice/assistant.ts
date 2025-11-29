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
import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import type { VoiceBasedChannel, GuildMember, TextChannel, Client, VoiceState } from 'discord.js';
import { voiceClient, VoiceClient } from './client.js';
import { voiceListener, VoiceListener } from './listener.js';
import { getPromptsForContext } from '../../../controllers/prompts.js';
import OpenAI from 'openai';

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

export interface VoiceAssistantConfig {
  /** Enable/disable TTS responses */
  ttsEnabled: boolean;
  /** Guild ID for test mode */
  testGuildId?: string;
  /** Text channel to send transcriptions to */
  transcriptChannelId?: string;
  /** Whether to log all transcriptions */
  logTranscriptions: boolean;
  /** Enable batch transcription posting to text channel */
  batchTranscriptionEnabled: boolean;
  /** Pause duration (ms) before posting batch transcription */
  batchPauseThreshold: number;
  /** Max entries before forcing a batch post */
  batchMaxEntries: number;
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
  batchTranscriptionEnabled: true,
  batchPauseThreshold: 10000, // 10 seconds of silence before posting
  batchMaxEntries: 20, // Force post after 20 entries
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
  /** Timer for batch posting on pause */
  batchTimer?: NodeJS.Timeout;
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

      // Add to transcript as a command
      await this.addTranscriptionEntry(guildId, userId, `Hey FumbleBot, ${command}`, true);

      // Process the command
      await this.processCommand(voiceCommand);
    });

    // Log all transcriptions if enabled
    voiceListener.on('transcription', (userId: string, text: string) => {
      const guildId = voiceListener.currentGuildId;

      if (this.config.logTranscriptions) {
        console.log(`[VoiceAssistant] Transcription from ${userId}: "${text}"`);
        this.emit('transcription', { userId, text, timestamp: Date.now() });
      }

      // Add to transcript (non-command speech)
      // Only add if it's not a wake word (those are handled above)
      const isWakeWord = text.toLowerCase().includes('fumblebot') ||
                         text.toLowerCase().includes('hey fumble');
      if (!isWakeWord) {
        this.addTranscriptionEntry(guildId, userId, text, false);
      }
    });

    // Handle errors
    voiceListener.on('error', (error: Error) => {
      console.error('[VoiceAssistant] Listener error:', error);
      this.emit('error', error);
    });
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

    // Reset batch timer on new speech
    this.resetBatchTimer(guildId);

    // Check if we should force a batch post (max entries reached)
    const unpostedCount = state.transcript.entries.length - state.transcript.lastPostedIndex;
    if (unpostedCount >= this.config.batchMaxEntries) {
      console.log(`[VoiceAssistant] Max entries reached (${unpostedCount}), posting batch`);
      await this.postBatchTranscription(guildId);
    }
  }

  /**
   * Reset the batch timer (called on new speech)
   */
  private resetBatchTimer(guildId: string): void {
    const state = this.activeGuilds.get(guildId);
    if (!state || !this.config.batchTranscriptionEnabled) return;

    // Clear existing timer
    if (state.batchTimer) {
      clearTimeout(state.batchTimer);
    }

    // Set new timer for pause detection
    state.batchTimer = setTimeout(async () => {
      console.log(`[VoiceAssistant] Pause detected after ${this.config.batchPauseThreshold}ms`);
      await this.postBatchTranscription(guildId);
    }, this.config.batchPauseThreshold);
  }

  /**
   * Post batch transcription to text channel
   */
  private async postBatchTranscription(guildId: string): Promise<void> {
    const state = this.activeGuilds.get(guildId);
    if (!state || !state.textChannel) return;

    // Get unposted entries
    const unpostedEntries = state.transcript.entries.slice(state.transcript.lastPostedIndex);
    if (unpostedEntries.length === 0) return;

    // Format entries for embed
    const lines = unpostedEntries.map(entry => {
      const time = new Date(entry.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const prefix = entry.isCommand ? '🎤 ' : '';
      return `\`${time}\` ${prefix}**${entry.username}**: ${entry.text}`;
    });

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle('📝 Voice Transcript')
      .setDescription(lines.join('\n').slice(0, 4000)) // Discord limit
      .setColor(0x7c3aed)
      .setFooter({ text: `${unpostedEntries.length} entries` })
      .setTimestamp();

    try {
      await state.textChannel.send({ embeds: [embed] });
      state.transcript.lastPostedIndex = state.transcript.entries.length;
      console.log(`[VoiceAssistant] Posted ${unpostedEntries.length} transcript entries to text channel`);
    } catch (error) {
      console.error('[VoiceAssistant] Failed to post batch transcription:', error);
    }
  }

  /**
   * Play a ready chime/sound when joining voice
   * This helps users know the bot is ready and also "primes" the audio system
   */
  private async playReadySound(guildId: string): Promise<void> {
    if (!this.openai) {
      console.log('[VoiceAssistant] No OpenAI client, skipping ready sound');
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

      console.log('[VoiceAssistant] Generating ready sound...');
      const response = await this.openai.audio.speech.create({
        model: 'tts-1',
        voice: 'onyx', // Deeper voice
        input: 'Ready!',
        speed: 0.9, // Slightly slower
      });

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      await voiceClient.playBuffer(guildId, buffer);
      console.log('[VoiceAssistant] Ready sound played');
    } catch (error) {
      console.warn('[VoiceAssistant] Failed to play ready sound:', error);
      // Non-fatal error, continue without the sound
    }
  }

  /**
   * Start voice assistant in a channel
   */
  async startListening(channel: VoiceBasedChannel, textChannel?: TextChannel): Promise<void> {
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
    });

    // Only start listening if there are humans present
    if (!shouldPause) {
      voiceListener.startListening(connection, guildId, whisperPrompt);

      // Play ready sound to indicate the assistant is active
      // This also helps "prime" the audio system
      await this.playReadySound(guildId);
    }

    this.emit('started', { guildId, channelId: channel.id, paused: shouldPause });
  }

  /**
   * Stop voice assistant in a guild
   */
  async stopListening(guildId: string): Promise<void> {
    console.log(`[VoiceAssistant] Stopping in guild ${guildId}`);

    const state = this.activeGuilds.get(guildId);

    // Clear batch timer
    if (state?.batchTimer) {
      clearTimeout(state.batchTimer);
    }

    // Post any remaining transcription entries
    if (state && state.transcript.entries.length > state.transcript.lastPostedIndex) {
      await this.postBatchTranscription(guildId);
    }

    // Generate and post full session transcript
    if (state && state.transcript.entries.length > 0) {
      await this.postFullTranscript(guildId);
    }

    voiceListener.stopListening();
    await voiceClient.leaveChannel(guildId);

    this.activeGuilds.delete(guildId);
    this.emit('stopped', { guildId });
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
    // Only exit on explicit stop commands - "goodbye" must be the primary intent, not part of other text
    const isExitCommand =
      normalized === 'goodbye' ||
      normalized === 'bye' ||
      normalized === 'stop listening' ||
      normalized === 'stop' ||
      normalized.startsWith('goodbye fumblebot') ||
      normalized.startsWith('bye fumblebot') ||
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
   */
  private async speakResponse(guildId: string, text: string): Promise<void> {
    if (!this.openai) {
      console.warn('[VoiceAssistant] OpenAI not available for TTS');
      return;
    }

    try {
      // Ensure voice is ready before speaking
      await voiceClient.waitForReady(guildId, 3000);

      console.log(`[VoiceAssistant] Generating TTS for: "${text}"`);

      const response = await this.openai.audio.speech.create({
        model: 'tts-1',
        voice: 'onyx', // Deeper voice - Options: alloy, echo, fable, onyx, nova, shimmer
        input: text,
        speed: 0.9, // Slightly slower for clarity
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
