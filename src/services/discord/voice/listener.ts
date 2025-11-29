/**
 * Voice Listener for FumbleBot
 * Handles receiving audio from Discord voice channels for wake word detection
 *
 * Uses OpenAI Whisper API for transcription with "Hey FumbleBot" keyword spotting
 */

import {
  EndBehaviorType,
  type VoiceConnection,
  type VoiceReceiver,
} from '@discordjs/voice';
import { Transform, Readable, pipeline } from 'stream';
import { EventEmitter } from 'events';
import OpenAI from 'openai';
// @ts-ignore - prism-media doesn't have types
import prism from 'prism-media';

// Whisper expects 16kHz, mono, 16-bit PCM
// Discord receiver provides raw Opus packets - we decode to 48kHz stereo 16-bit PCM
const DISCORD_SAMPLE_RATE = 48000;
const WHISPER_SAMPLE_RATE = 16000;
const SILENCE_THRESHOLD_MS = 1500; // 1.5 seconds of silence = end of utterance
const MIN_AUDIO_DURATION_MS = 500; // Minimum 0.5 second for short commands like "roll d20"
const MAX_AUDIO_DURATION_MS = 10000; // Maximum audio buffer (10 seconds)

// Default Whisper prompt to improve transcription accuracy
// NOTE: Do NOT include wake words in the prompt - Whisper hallucinates the prompt when there's silence
const DEFAULT_WHISPER_PROMPT = 'TTRPG game session, dice rolls, initiative, attack, damage, saving throw';

// Wake words to detect
const WAKE_WORDS = [
  'hey fumblebot',
  'hey fumble bot',
  'hey fumble',
  'fumblebot',
  'fumble bot',
  'okay fumblebot',
  'ok fumblebot',
];

export interface VoiceListenerEvents {
  wakeWord: (userId: string, command: string) => void;
  transcription: (userId: string, text: string) => void;
  error: (error: Error) => void;
  listening: (userId: string) => void;
  stopped: (userId: string) => void;
}

export interface UserAudioState {
  userId: string;
  buffer: Buffer[];
  lastAudioTime: number;
  isRecording: boolean;
  silenceTimeout?: NodeJS.Timeout;
  /** Active audio stream subscription - must be cleaned up */
  audioStream?: ReturnType<VoiceReceiver['subscribe']>;
  /** Opus decoder - must be cleaned up with audio stream */
  decoder?: any;
}

export class VoiceListener extends EventEmitter {
  private openai: OpenAI | null = null;
  private userStates: Map<string, UserAudioState> = new Map();
  private isListening: boolean = false;
  private receiver: VoiceReceiver | null = null;
  private connection: VoiceConnection | null = null;
  private guildId: string = '';
  private whisperPrompt: string = DEFAULT_WHISPER_PROMPT;

  constructor() {
    super();
    this.initOpenAI();
  }

  private initOpenAI(): void {
    const apiKey = process.env.FUMBLEBOT_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
      console.log('[VoiceListener] OpenAI client initialized for Whisper transcription');
    } else {
      console.warn('[VoiceListener] No OpenAI API key found - transcription disabled');
    }
  }

  /**
   * Start listening to a voice connection for wake words
   * @param connection - The voice connection to listen on
   * @param guildId - The guild ID
   * @param whisperPrompt - Optional custom Whisper prompt for transcription context
   */
  startListening(connection: VoiceConnection, guildId: string, whisperPrompt?: string): void {
    if (this.isListening) {
      console.log('[VoiceListener] Already listening, stopping previous session');
      this.stopListening();
    }

    this.connection = connection;
    this.guildId = guildId;
    this.receiver = connection.receiver;
    this.isListening = true;
    this.whisperPrompt = whisperPrompt || DEFAULT_WHISPER_PROMPT;

    console.log(`[VoiceListener] Started listening on guild ${guildId}`);
    console.log(`[VoiceListener] Using Whisper prompt: "${this.whisperPrompt.substring(0, 100)}..."`);

    // Listen for speaking events
    this.receiver.speaking.on('start', (userId) => {
      this.handleSpeakingStart(userId);
    });

    this.receiver.speaking.on('end', (userId) => {
      this.handleSpeakingEnd(userId);
    });
  }

  /**
   * Stop listening
   */
  stopListening(): void {
    if (!this.isListening) return;

    console.log(`[VoiceListener] Stopping listener on guild ${this.guildId}`);

    // Remove speaking event listeners to prevent new subscriptions
    if (this.receiver) {
      this.receiver.speaking.removeAllListeners('start');
      this.receiver.speaking.removeAllListeners('end');
    }

    // Clean up all user states including audio streams
    for (const [userId] of this.userStates) {
      this.clearUserState(userId);
    }
    this.userStates.clear();

    // Clear references
    this.receiver = null;
    this.connection = null;
    this.isListening = false;
  }

  /**
   * Handle user starting to speak
   * Key insight: Discord can fire rapid start/stop events for short pauses.
   * We accumulate audio across these events until we get a proper silence.
   */
  private handleSpeakingStart(userId: string): void {
    if (!this.receiver || !this.isListening) return;

    // Get existing state to check if we're already subscribed
    let state = this.userStates.get(userId);

    // Clear any pending silence timeout since user is speaking again
    if (state?.silenceTimeout) {
      clearTimeout(state.silenceTimeout);
      state.silenceTimeout = undefined;
    }

    // If we already have an active stream for this user, just continue accumulating
    if (state?.audioStream) {
      state.isRecording = true;
      state.lastAudioTime = Date.now();
      console.log(`[VoiceListener] User ${userId} resumed speaking (continuing accumulation)`);
      return;
    }

    console.log(`[VoiceListener] User ${userId} started speaking (new session)`);
    this.emit('listening', userId);

    // Create new state
    state = {
      userId,
      buffer: [],
      lastAudioTime: Date.now(),
      isRecording: true,
    };
    this.userStates.set(userId, state);

    // Subscribe to user's audio stream with Manual end behavior
    // We'll handle the end logic ourselves based on silence timeouts
    const opusStream = this.receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.Manual,
      },
    });

    // Increase max listeners to avoid warning
    opusStream.setMaxListeners(20);

    // Create Opus decoder to convert Opus packets to PCM
    // Discord sends 48kHz stereo Opus - decode to 48kHz stereo s16le PCM
    const decoder = new prism.opus.Decoder({
      rate: DISCORD_SAMPLE_RATE,
      channels: 2,
      frameSize: 960, // 20ms at 48kHz
    });

    // Store references for cleanup
    state.audioStream = opusStream;
    state.decoder = decoder;

    // Track data events for debugging
    let dataEventCount = 0;

    // Important: Use the state reference from the map lookup each time
    // to ensure we're writing to the current state, not a stale reference
    decoder.on('data', (chunk: Buffer) => {
      // Always look up the current state from the map
      const currentState = this.userStates.get(userId);
      if (!currentState || !currentState.isRecording) return;

      dataEventCount++;
      if (dataEventCount === 1) {
        console.log(`[VoiceListener] First PCM chunk received for ${userId}, size: ${chunk.length} bytes`);
      }

      currentState.lastAudioTime = Date.now();
      currentState.buffer.push(chunk);

      // Check if buffer is getting too large
      const totalSize = currentState.buffer.reduce((sum, b) => sum + b.length, 0);
      if (totalSize > (MAX_AUDIO_DURATION_MS / 1000) * DISCORD_SAMPLE_RATE * 2 * 2) {
        // Buffer too large, process what we have
        console.log(`[VoiceListener] Buffer full for ${userId}, processing`);
        this.processAudioBuffer(currentState);
      }
    });

    // Pipe opus stream to decoder
    opusStream.pipe(decoder);

    opusStream.on('end', () => {
      console.log(`[VoiceListener] Audio stream ended for user ${userId}`);
      // Clean up stream reference
      const currentState = this.userStates.get(userId);
      if (currentState) {
        currentState.audioStream = undefined;
      }
    });

    opusStream.on('error', (error) => {
      console.error(`[VoiceListener] Audio stream error for user ${userId}:`, error);
      // Clean up on error
      const currentState = this.userStates.get(userId);
      if (currentState) {
        currentState.audioStream?.destroy();
        currentState.audioStream = undefined;
      }
      this.emit('error', error);
    });

    decoder.on('error', (error: Error) => {
      console.error(`[VoiceListener] Opus decoder error for user ${userId}:`, error);
      this.emit('error', error);
    });
  }

  /**
   * Handle user stopping speaking
   * We use a longer timeout to accumulate audio across short pauses
   */
  private handleSpeakingEnd(userId: string): void {
    const state = this.userStates.get(userId);
    if (!state || !state.isRecording) return;

    console.log(`[VoiceListener] User ${userId} stopped speaking, waiting for continuation...`);

    // Don't emit 'stopped' yet - wait for the silence timeout
    // This allows accumulation across short pauses

    // Set timeout to process audio after extended silence
    // Use SILENCE_THRESHOLD_MS for proper utterance detection
    state.silenceTimeout = setTimeout(() => {
      console.log(`[VoiceListener] Silence timeout for ${userId}, processing audio`);
      this.emit('stopped', userId);
      this.processAudioBuffer(state);
    }, SILENCE_THRESHOLD_MS);
  }

  /**
   * Process collected audio buffer through Whisper
   */
  private async processAudioBuffer(state: UserAudioState): Promise<void> {
    const userId = state.userId;
    const bufferLength = state.buffer.length;

    // Copy buffer data before clearing state - this allows new audio to accumulate
    // while we process the previous utterance
    const bufferCopy = bufferLength > 0 ? [...state.buffer] : [];

    // Clear state FIRST to allow fresh audio accumulation
    // This is critical - we need to release the audio stream so a new one can be created
    this.clearUserState(userId);

    console.log(`[VoiceListener] processAudioBuffer called for ${userId}, buffer chunks: ${bufferLength}`);

    if (!this.openai) {
      console.warn('[VoiceListener] OpenAI not initialized, skipping transcription');
      return;
    }

    if (bufferCopy.length === 0) {
      console.log(`[VoiceListener] Empty buffer for ${userId}, skipping`);
      return;
    }

    // Calculate audio duration
    const totalBytes = bufferCopy.reduce((sum, b) => sum + b.length, 0);
    const durationMs = (totalBytes / (DISCORD_SAMPLE_RATE * 2 * 2)) * 1000; // stereo, 16-bit

    if (durationMs < MIN_AUDIO_DURATION_MS) {
      console.log(`[VoiceListener] Audio too short (${durationMs}ms), skipping`);
      return;
    }

    console.log(`[VoiceListener] Processing ${durationMs.toFixed(0)}ms of audio for user ${userId}`);

    try {
      // Combine buffers
      const combinedBuffer = Buffer.concat(bufferCopy);

      // Convert to WAV format for Whisper
      const wavBuffer = this.pcmToWav(combinedBuffer);

      // Create a File-like object for OpenAI
      // Convert Buffer to Uint8Array to satisfy TypeScript's BlobPart type
      const audioBlob = new Blob([new Uint8Array(wavBuffer)], { type: 'audio/wav' });
      const audioFile = new File([audioBlob], 'audio.wav', { type: 'audio/wav' });

      // Transcribe with Whisper
      // The prompt helps Whisper understand context and reduces hallucinations
      const transcription = await this.openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'en',
        response_format: 'text',
        prompt: this.whisperPrompt,
      });

      const text = transcription.trim().toLowerCase();
      console.log(`[VoiceListener] Transcription: "${text}"`);

      // Detect hallucinations - Whisper outputs empty strings or repeats when there's silence
      if (this.isHallucination(text)) {
        console.log(`[VoiceListener] Detected hallucination, ignoring: "${text}"`);
        return;
      }

      // Emit transcription event
      this.emit('transcription', userId, text);

      // Check for wake word
      const wakeWordMatch = this.checkWakeWord(text);
      if (wakeWordMatch) {
        const command = text.slice(wakeWordMatch.length).trim();
        console.log(`[VoiceListener] Wake word detected! Command: "${command}"`);
        this.emit('wakeWord', userId, command);
      }
    } catch (error) {
      console.error('[VoiceListener] Transcription error:', error);
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
    // Note: state was already cleared at start of this function
  }

  /**
   * Detect Whisper hallucinations
   * Whisper commonly outputs empty strings, repeated phrases, or prompt text when given silence
   */
  private isHallucination(text: string): boolean {
    // Empty or very short transcriptions
    if (!text || text.length < 3) {
      return true;
    }

    // Common Whisper hallucination patterns
    const hallucinationPatterns = [
      /^\.+$/,                          // Just dots
      /^[\s.,-]+$/,                     // Just punctuation
      /^(thank you|thanks)\.?$/i,       // Common hallucination
      /^you\.?$/i,                      // Common hallucination
      /^(bye|goodbye)\.?$/i,            // Isolated goodbye (no wake word)
      /^music$/i,                       // Common hallucination
      /^silence$/i,                     // Describing silence
      /^\[.*\]$/,                       // Bracketed descriptions like [MUSIC]
      /^(um|uh|hmm)+$/i,                // Just filler words
    ];

    for (const pattern of hallucinationPatterns) {
      if (pattern.test(text)) {
        return true;
      }
    }

    // Check for repeated phrases (another hallucination sign)
    const words = text.split(/\s+/);
    if (words.length >= 4) {
      const firstHalf = words.slice(0, Math.floor(words.length / 2)).join(' ');
      const secondHalf = words.slice(Math.floor(words.length / 2)).join(' ');
      if (firstHalf === secondHalf) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if transcription contains a wake word
   * Returns the matched wake word or null
   */
  private checkWakeWord(text: string): string | null {
    const normalized = text.toLowerCase().trim();

    for (const wakeWord of WAKE_WORDS) {
      if (normalized.startsWith(wakeWord)) {
        return wakeWord;
      }
    }

    return null;
  }

  /**
   * Convert raw PCM to WAV format
   * Discord provides 48kHz stereo 16-bit PCM (from Opus)
   */
  private pcmToWav(pcmBuffer: Buffer): Buffer {
    // Downsample from 48kHz stereo to 16kHz mono for Whisper
    const downsampled = this.downsampleAudio(pcmBuffer);

    const numChannels = 1;
    const sampleRate = WHISPER_SAMPLE_RATE;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = downsampled.length;
    const headerSize = 44;

    const wavBuffer = Buffer.alloc(headerSize + dataSize);

    // RIFF header
    wavBuffer.write('RIFF', 0);
    wavBuffer.writeUInt32LE(36 + dataSize, 4);
    wavBuffer.write('WAVE', 8);

    // fmt chunk
    wavBuffer.write('fmt ', 12);
    wavBuffer.writeUInt32LE(16, 16); // Subchunk1Size
    wavBuffer.writeUInt16LE(1, 20); // AudioFormat (PCM)
    wavBuffer.writeUInt16LE(numChannels, 22);
    wavBuffer.writeUInt32LE(sampleRate, 24);
    wavBuffer.writeUInt32LE(byteRate, 28);
    wavBuffer.writeUInt16LE(blockAlign, 32);
    wavBuffer.writeUInt16LE(bitsPerSample, 34);

    // data chunk
    wavBuffer.write('data', 36);
    wavBuffer.writeUInt32LE(dataSize, 40);
    downsampled.copy(wavBuffer, 44);

    return wavBuffer;
  }

  /**
   * Downsample from 48kHz stereo to 16kHz mono
   */
  private downsampleAudio(input: Buffer): Buffer {
    const ratio = DISCORD_SAMPLE_RATE / WHISPER_SAMPLE_RATE; // 3x
    const inputSamples = input.length / 4; // 2 bytes per sample, 2 channels
    const outputSamples = Math.floor(inputSamples / ratio);
    const output = Buffer.alloc(outputSamples * 2); // mono, 16-bit

    for (let i = 0; i < outputSamples; i++) {
      const inputIndex = Math.floor(i * ratio) * 4;

      // Average left and right channels
      const left = input.readInt16LE(inputIndex);
      const right = input.readInt16LE(inputIndex + 2);
      const mono = Math.round((left + right) / 2);

      output.writeInt16LE(mono, i * 2);
    }

    return output;
  }

  /**
   * Clear user state and clean up audio stream and decoder
   *
   * Important: Set references to undefined BEFORE destroying to prevent
   * race conditions where handleSpeakingStart checks state.audioStream
   * while the stream is being destroyed.
   */
  private clearUserState(userId: string): void {
    const state = this.userStates.get(userId);
    if (state) {
      if (state.silenceTimeout) {
        clearTimeout(state.silenceTimeout);
        state.silenceTimeout = undefined;
      }

      // Capture references before clearing
      const decoder = state.decoder;
      const audioStream = state.audioStream;

      // Clear references FIRST to prevent race conditions
      // This ensures handleSpeakingStart won't see stale references
      state.decoder = undefined;
      state.audioStream = undefined;
      state.buffer = [];
      state.isRecording = false;

      // Now safely destroy the streams
      if (decoder) {
        decoder.removeAllListeners();
        decoder.destroy();
      }
      if (audioStream) {
        audioStream.removeAllListeners();
        audioStream.destroy();
      }
    }
    this.userStates.delete(userId);
  }

  /**
   * Check if currently listening
   */
  get listening(): boolean {
    return this.isListening;
  }

  /**
   * Get guild ID being listened to
   */
  get currentGuildId(): string {
    return this.guildId;
  }
}

// Singleton instance
export const voiceListener = new VoiceListener();
