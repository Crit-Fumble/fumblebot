/**
 * Deepgram Voice Listener for FumbleBot
 * Real-time streaming transcription with built-in endpointing and keyword boosting
 *
 * Advantages over Whisper:
 * - Real-time streaming (transcripts as you speak)
 * - Built-in voice activity detection and endpointing
 * - Keyword boosting for wake words and TTRPG terms
 * - Lower latency, fewer hallucinations
 */

import {
  EndBehaviorType,
  type VoiceConnection,
  type VoiceReceiver,
} from '@discordjs/voice';
import { EventEmitter } from 'events';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import type { LiveClient } from '@deepgram/sdk';
// @ts-ignore - prism-media doesn't have types
import prism from 'prism-media';
import { getVoiceConfig } from '../../../config.js';

// Deepgram expects 16kHz mono linear16 PCM
// Discord receiver provides raw Opus packets - we decode to 48kHz stereo 16-bit PCM
const DISCORD_SAMPLE_RATE = 48000;
const DEEPGRAM_SAMPLE_RATE = 16000;
const MIN_AUDIO_DURATION_MS = 200; // Minimum audio to process

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

// Keywords to boost for better recognition
const KEYWORDS = [
  'FumbleBot:2',      // Strong boost for wake word
  'fumble:1.5',
  'd20:1.5',
  'd12:1.5',
  'd10:1.5',
  'd8:1.5',
  'd6:1.5',
  'd4:1.5',
  'd100:1.5',
  'initiative:1.3',
  'attack:1.2',
  'damage:1.2',
  'saving throw:1.2',
  'roll:1.3',
  'dice:1.3',
];

export interface DeepgramListenerEvents {
  wakeWord: (userId: string, command: string) => void;
  transcription: (userId: string, text: string) => void;
  interimTranscription: (userId: string, text: string) => void;
  error: (error: Error) => void;
  listening: (userId: string) => void;
  stopped: (userId: string) => void;
}

export interface UserStreamState {
  userId: string;
  deepgramClient: LiveClient | null;
  audioStream?: ReturnType<VoiceReceiver['subscribe']>;
  decoder?: any;
  isActive: boolean;
  lastTranscript: string;
  lastTranscriptTime: number;
}

export class DeepgramListener extends EventEmitter {
  private deepgram: ReturnType<typeof createClient> | null = null;
  private userStates: Map<string, UserStreamState> = new Map();
  private isListening: boolean = false;
  private receiver: VoiceReceiver | null = null;
  private connection: VoiceConnection | null = null;
  private guildId: string = '';

  constructor() {
    super();
    this.initDeepgram();
  }

  private initDeepgram(): void {
    const voiceConfig = getVoiceConfig();
    if (voiceConfig.deepgramApiKey) {
      this.deepgram = createClient(voiceConfig.deepgramApiKey);
      console.log('[DeepgramListener] Deepgram client initialized');
    } else {
      console.warn('[DeepgramListener] No Deepgram API key found - transcription disabled');
    }
  }

  /**
   * Start listening to a voice connection
   */
  startListening(connection: VoiceConnection, guildId: string): void {
    if (this.isListening) {
      console.log('[DeepgramListener] Already listening, stopping previous session');
      this.stopListening();
    }

    this.connection = connection;
    this.guildId = guildId;
    this.receiver = connection.receiver;
    this.isListening = true;

    console.log(`[DeepgramListener] Started listening on guild ${guildId}`);

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

    console.log(`[DeepgramListener] Stopping listener on guild ${this.guildId}`);

    // Remove speaking event listeners
    if (this.receiver) {
      this.receiver.speaking.removeAllListeners('start');
      this.receiver.speaking.removeAllListeners('end');
    }

    // Clean up all user states
    for (const [userId] of this.userStates) {
      this.cleanupUserState(userId);
    }
    this.userStates.clear();

    this.receiver = null;
    this.connection = null;
    this.isListening = false;
  }

  /**
   * Handle user starting to speak
   */
  private handleSpeakingStart(userId: string): void {
    if (!this.receiver || !this.isListening || !this.deepgram) return;

    let state = this.userStates.get(userId);

    // If we have an active stream, just mark it active
    if (state?.deepgramClient && state?.audioStream) {
      state.isActive = true;
      console.log(`[DeepgramListener] User ${userId} resumed speaking`);
      return;
    }

    // Clean up any partial state
    if (state) {
      this.cleanupUserState(userId);
    }

    console.log(`[DeepgramListener] User ${userId} started speaking (creating stream)`);
    this.emit('listening', userId);

    // Create new state
    state = {
      userId,
      deepgramClient: null,
      isActive: true,
      lastTranscript: '',
      lastTranscriptTime: Date.now(),
    };
    this.userStates.set(userId, state);

    // Create Deepgram live transcription client
    const dgClient = this.deepgram.listen.live({
      model: 'nova-2',
      language: 'en',
      smart_format: true,
      punctuate: true,
      // Endpointing: detect end of utterance after silence
      endpointing: 500, // 500ms silence = end of utterance
      utterance_end_ms: 1000, // Final utterance boundary
      // Interim results for real-time feedback
      interim_results: true,
      // Keywords for better recognition
      keywords: KEYWORDS,
      // Audio encoding
      encoding: 'linear16',
      sample_rate: DEEPGRAM_SAMPLE_RATE,
      channels: 1,
    });

    state.deepgramClient = dgClient;

    // Handle transcription events
    dgClient.on(LiveTranscriptionEvents.Open, () => {
      console.log(`[DeepgramListener] Deepgram connection opened for ${userId}`);
    });

    dgClient.on(LiveTranscriptionEvents.Transcript, (data) => {
      const transcript = data.channel?.alternatives?.[0]?.transcript;
      if (!transcript) return;

      const isFinal = data.is_final;
      const text = transcript.trim().toLowerCase();

      if (!text) return;

      const currentState = this.userStates.get(userId);
      if (!currentState) return;

      if (isFinal) {
        console.log(`[DeepgramListener] Final transcript from ${userId}: "${text}"`);
        currentState.lastTranscript = text;
        currentState.lastTranscriptTime = Date.now();

        // Emit transcription event
        this.emit('transcription', userId, text);

        // Check for wake word
        const wakeWordMatch = this.checkWakeWord(text);
        if (wakeWordMatch) {
          const command = text.slice(wakeWordMatch.length).trim();
          console.log(`[DeepgramListener] Wake word detected! Command: "${command}"`);
          this.emit('wakeWord', userId, command);
        }
      } else {
        // Interim result - for real-time UI updates
        this.emit('interimTranscription', userId, text);
      }
    });

    dgClient.on(LiveTranscriptionEvents.UtteranceEnd, () => {
      console.log(`[DeepgramListener] Utterance ended for ${userId}`);
      this.emit('stopped', userId);

      // Finalize the stream to get final transcription
      const currentState = this.userStates.get(userId);
      if (currentState?.deepgramClient && currentState.isActive === false) {
        console.log(`[DeepgramListener] Finalizing stream for ${userId} to get final transcript`);
        try {
          currentState.deepgramClient.finish();
        } catch (err) {
          console.error(`[DeepgramListener] Error finalizing stream:`, err);
        }
      }
    });

    dgClient.on(LiveTranscriptionEvents.Error, (error) => {
      console.error(`[DeepgramListener] Deepgram error for ${userId}:`, error);
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    });

    dgClient.on(LiveTranscriptionEvents.Close, () => {
      console.log(`[DeepgramListener] Deepgram connection closed for ${userId}`);
      // Don't cleanup immediately - let pending transcripts come through
      setTimeout(() => {
        this.cleanupUserState(userId);
      }, 500);
    });

    // Subscribe to user's audio stream
    const opusStream = this.receiver.subscribe(userId, {
      end: { behavior: EndBehaviorType.Manual },
    });
    opusStream.setMaxListeners(20);
    state.audioStream = opusStream;

    // Decode Opus to PCM
    const decoder = new prism.opus.Decoder({
      rate: DISCORD_SAMPLE_RATE,
      channels: 2,
      frameSize: 960,
    });
    state.decoder = decoder;

    // Buffer for downsampling
    let pcmBuffer = Buffer.alloc(0);

    decoder.on('data', (chunk: Buffer) => {
      const currentState = this.userStates.get(userId);
      if (!currentState?.isActive || !currentState.deepgramClient) return;

      // Accumulate PCM data
      pcmBuffer = Buffer.concat([pcmBuffer, chunk]);

      // Process in chunks (downsample and send to Deepgram)
      // Process every ~100ms of audio (4800 samples at 48kHz stereo = 19200 bytes)
      const chunkSize = 19200;
      while (pcmBuffer.length >= chunkSize) {
        const toProcess = pcmBuffer.subarray(0, chunkSize);
        pcmBuffer = pcmBuffer.subarray(chunkSize);

        // Downsample from 48kHz stereo to 16kHz mono
        const downsampled = this.downsampleAudio(toProcess);

        // Send to Deepgram (convert Buffer to ArrayBuffer for SDK compatibility)
        try {
          const arrayBuffer = downsampled.buffer.slice(
            downsampled.byteOffset,
            downsampled.byteOffset + downsampled.byteLength
          );
          currentState.deepgramClient.send(arrayBuffer);
        } catch (err) {
          console.error(`[DeepgramListener] Error sending audio:`, err);
        }
      }
    });

    // Pipe opus stream to decoder
    opusStream.pipe(decoder);

    opusStream.on('end', () => {
      console.log(`[DeepgramListener] Audio stream ended for ${userId}`);
      this.cleanupUserState(userId);
    });

    opusStream.on('error', (error) => {
      console.error(`[DeepgramListener] Audio stream error for ${userId}:`, error);
      this.cleanupUserState(userId);
      this.emit('error', error);
    });

    decoder.on('error', (error: Error) => {
      console.error(`[DeepgramListener] Opus decoder error for ${userId}:`, error);
      this.emit('error', error);
    });
  }

  /**
   * Handle user stopping speaking
   */
  private handleSpeakingEnd(userId: string): void {
    const state = this.userStates.get(userId);
    if (!state) return;

    console.log(`[DeepgramListener] User ${userId} stopped speaking`);
    // Don't clean up immediately - Deepgram's endpointing will handle utterance detection
    // Just mark as inactive so we don't send more audio
    state.isActive = false;

    // Give Deepgram time to finalize transcription before closing connection
    // This allows final transcriptions to come through for wake word detection
    setTimeout(() => {
      const currentState = this.userStates.get(userId);
      if (currentState && !currentState.isActive && currentState.deepgramClient) {
        console.log(`[DeepgramListener] Finalizing Deepgram connection for ${userId}`);
        try {
          currentState.deepgramClient.requestClose();
        } catch (err) {
          // Ignore
        }
      }
    }, 2000); // Wait 2 seconds for final transcription
  }

  /**
   * Downsample from 48kHz stereo to 16kHz mono
   */
  private downsampleAudio(input: Buffer): Buffer {
    const ratio = DISCORD_SAMPLE_RATE / DEEPGRAM_SAMPLE_RATE; // 3x
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
   * Check if transcription contains a wake word
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
   * Clean up user state
   */
  private cleanupUserState(userId: string): void {
    const state = this.userStates.get(userId);
    if (!state) return;

    // Close Deepgram connection
    if (state.deepgramClient) {
      try {
        state.deepgramClient.requestClose();
      } catch (err) {
        // Ignore close errors
      }
      state.deepgramClient = null;
    }

    // Clean up audio streams
    if (state.decoder) {
      state.decoder.removeAllListeners();
      state.decoder.destroy();
      state.decoder = undefined;
    }

    if (state.audioStream) {
      state.audioStream.removeAllListeners();
      state.audioStream.destroy();
      state.audioStream = undefined;
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

  /**
   * Check if Deepgram is available
   */
  get isAvailable(): boolean {
    return this.deepgram !== null;
  }
}

// Singleton instance
export const deepgramListener = new DeepgramListener();
