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
import { Transform, Readable } from 'stream';
import { EventEmitter } from 'events';
import OpenAI from 'openai';

// Whisper expects 16kHz, mono, 16-bit PCM
// Discord provides 48kHz, stereo, 16-bit PCM (Opus decoded)
const DISCORD_SAMPLE_RATE = 48000;
const WHISPER_SAMPLE_RATE = 16000;
const SILENCE_THRESHOLD_MS = 1500; // 1.5 seconds of silence = end of utterance
const MIN_AUDIO_DURATION_MS = 1000; // Minimum 1 second to avoid hallucinations
const MAX_AUDIO_DURATION_MS = 10000; // Maximum audio buffer (10 seconds)

// Default Whisper prompt to improve transcription accuracy and reduce hallucinations
const DEFAULT_WHISPER_PROMPT = 'Hey FumbleBot, roll d20, roll initiative, fumblebot, goodbye';

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

    // Clean up all user states
    for (const state of this.userStates.values()) {
      if (state.silenceTimeout) {
        clearTimeout(state.silenceTimeout);
      }
    }
    this.userStates.clear();

    // Clear references
    this.receiver = null;
    this.connection = null;
    this.isListening = false;
  }

  /**
   * Handle user starting to speak
   */
  private handleSpeakingStart(userId: string): void {
    if (!this.receiver || !this.isListening) return;

    console.log(`[VoiceListener] User ${userId} started speaking`);
    this.emit('listening', userId);

    // Get or create user state
    let state = this.userStates.get(userId);
    if (!state) {
      state = {
        userId,
        buffer: [],
        lastAudioTime: Date.now(),
        isRecording: true,
      };
      this.userStates.set(userId, state);
    }

    // Clear any pending silence timeout
    if (state.silenceTimeout) {
      clearTimeout(state.silenceTimeout);
      state.silenceTimeout = undefined;
    }

    state.isRecording = true;
    state.lastAudioTime = Date.now();

    // Subscribe to user's audio stream
    const audioStream = this.receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.AfterSilence,
        duration: SILENCE_THRESHOLD_MS,
      },
    });

    // Collect audio data
    audioStream.on('data', (chunk: Buffer) => {
      if (!state) return;

      state.lastAudioTime = Date.now();
      state.buffer.push(chunk);

      // Check if buffer is getting too large
      const totalSize = state.buffer.reduce((sum, b) => sum + b.length, 0);
      if (totalSize > (MAX_AUDIO_DURATION_MS / 1000) * DISCORD_SAMPLE_RATE * 2 * 2) {
        // Buffer too large, process what we have
        this.processAudioBuffer(state);
      }
    });

    audioStream.on('end', () => {
      console.log(`[VoiceListener] Audio stream ended for user ${userId}`);
      this.handleSpeakingEnd(userId);
    });

    audioStream.on('error', (error) => {
      console.error(`[VoiceListener] Audio stream error for user ${userId}:`, error);
      this.emit('error', error);
    });
  }

  /**
   * Handle user stopping speaking
   */
  private handleSpeakingEnd(userId: string): void {
    const state = this.userStates.get(userId);
    if (!state || !state.isRecording) return;

    console.log(`[VoiceListener] User ${userId} stopped speaking`);
    this.emit('stopped', userId);

    // Set timeout to process audio after brief silence
    state.silenceTimeout = setTimeout(() => {
      this.processAudioBuffer(state);
    }, 200); // Small delay to ensure stream is fully closed
  }

  /**
   * Process collected audio buffer through Whisper
   */
  private async processAudioBuffer(state: UserAudioState): Promise<void> {
    if (!this.openai) {
      console.warn('[VoiceListener] OpenAI not initialized, skipping transcription');
      this.clearUserState(state.userId);
      return;
    }

    if (state.buffer.length === 0) {
      this.clearUserState(state.userId);
      return;
    }

    // Calculate audio duration
    const totalBytes = state.buffer.reduce((sum, b) => sum + b.length, 0);
    const durationMs = (totalBytes / (DISCORD_SAMPLE_RATE * 2 * 2)) * 1000; // stereo, 16-bit

    if (durationMs < MIN_AUDIO_DURATION_MS) {
      console.log(`[VoiceListener] Audio too short (${durationMs}ms), skipping`);
      this.clearUserState(state.userId);
      return;
    }

    console.log(`[VoiceListener] Processing ${durationMs.toFixed(0)}ms of audio for user ${state.userId}`);

    try {
      // Combine buffers
      const combinedBuffer = Buffer.concat(state.buffer);

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

      // Emit transcription event
      this.emit('transcription', state.userId, text);

      // Check for wake word
      const wakeWordMatch = this.checkWakeWord(text);
      if (wakeWordMatch) {
        const command = text.slice(wakeWordMatch.length).trim();
        console.log(`[VoiceListener] Wake word detected! Command: "${command}"`);
        this.emit('wakeWord', state.userId, command);
      }
    } catch (error) {
      console.error('[VoiceListener] Transcription error:', error);
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.clearUserState(state.userId);
    }
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
   * Clear user state
   */
  private clearUserState(userId: string): void {
    const state = this.userStates.get(userId);
    if (state) {
      if (state.silenceTimeout) {
        clearTimeout(state.silenceTimeout);
      }
      state.buffer = [];
      state.isRecording = false;
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
