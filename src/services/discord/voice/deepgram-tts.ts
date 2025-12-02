/**
 * Deepgram Aura TTS for FumbleBot
 * Real-time streaming text-to-speech with low latency
 *
 * Advantages over OpenAI TTS:
 * - Streaming output (start playing before full generation)
 * - ~3x faster than ElevenLabs Turbo
 * - Same price as OpenAI ($15/1M chars)
 * - 70% lower LLM-to-TTS latency with token streaming
 */

import { createClient } from '@deepgram/sdk';
import { getVoiceConfig } from '../../../config.js';

// Available Deepgram Aura voices
export type DeepgramVoice =
  | 'aura-asteria-en'    // Default, female, American
  | 'aura-luna-en'       // Female, American, soft
  | 'aura-stella-en'     // Female, American
  | 'aura-athena-en'     // Female, British
  | 'aura-hera-en'       // Female, American
  | 'aura-orion-en'      // Male, American
  | 'aura-arcas-en'      // Male, American
  | 'aura-perseus-en'    // Male, American
  | 'aura-angus-en'      // Male, Irish
  | 'aura-orpheus-en'    // Male, American
  | 'aura-helios-en'     // Male, British
  | 'aura-zeus-en';      // Male, American, deep

export interface DeepgramTTSConfig {
  /** Voice model to use (default: aura-orion-en for male narrator) */
  voice: DeepgramVoice;
  /** Audio encoding (default: mp3) */
  encoding: 'linear16' | 'mp3' | 'opus' | 'flac' | 'aac';
  /** Sample rate for linear16 encoding */
  sampleRate?: number;
  /** Container format */
  container?: 'wav' | 'ogg' | 'none';
}

const DEFAULT_CONFIG: DeepgramTTSConfig = {
  voice: 'aura-orion-en', // Male voice, good for dramatic TTRPG narration
  encoding: 'mp3',
};

export class DeepgramTTS {
  private deepgram: ReturnType<typeof createClient> | null = null;
  private config: DeepgramTTSConfig;

  constructor(config: Partial<DeepgramTTSConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initDeepgram();
  }

  private initDeepgram(): void {
    const voiceConfig = getVoiceConfig();
    if (voiceConfig.deepgramApiKey) {
      this.deepgram = createClient(voiceConfig.deepgramApiKey);
      console.log('[DeepgramTTS] Initialized with voice:', this.config.voice);
    } else {
      console.warn('[DeepgramTTS] No Deepgram API key found - TTS disabled');
    }
  }

  /**
   * Check if Deepgram TTS is available
   */
  get isAvailable(): boolean {
    return this.deepgram !== null;
  }

  /**
   * Synthesize text to speech and return audio buffer
   * Uses REST API for simple request/response pattern
   */
  async synthesize(text: string, options?: Partial<DeepgramTTSConfig>): Promise<Buffer> {
    if (!this.deepgram) {
      throw new Error('Deepgram TTS not initialized');
    }

    const voice = options?.voice ?? this.config.voice;
    const encoding = options?.encoding ?? this.config.encoding;

    console.log(`[DeepgramTTS] Synthesizing: "${text.slice(0, 50)}${text.length > 50 ? '...' : ''}" with voice ${voice}`);
    const startTime = Date.now();

    try {
      // Build request options - don't send container param for mp3 encoding
      const requestOptions: any = {
        model: voice,
        encoding: encoding,
      };

      // Only include container for non-mp3 encodings
      if (encoding !== 'mp3') {
        requestOptions.container = options?.container ?? 'none';
      }

      const response = await this.deepgram.speak.request(
        { text },
        requestOptions
      );

      // Get the audio stream from the response
      const stream = await response.getStream();
      if (!stream) {
        throw new Error('No audio stream returned from Deepgram');
      }

      // Collect chunks into buffer
      const chunks: Uint8Array[] = [];
      const reader = stream.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
        }
      }

      const buffer = Buffer.concat(chunks);
      const latency = Date.now() - startTime;
      console.log(`[DeepgramTTS] Generated ${buffer.length} bytes in ${latency}ms`);

      return buffer;
    } catch (error) {
      console.error('[DeepgramTTS] Synthesis error:', error);
      throw error;
    }
  }

  /**
   * Synthesize and stream audio chunks as they become available
   * Returns an async generator that yields audio chunks
   */
  async *synthesizeStream(
    text: string,
    options?: Partial<DeepgramTTSConfig>
  ): AsyncGenerator<Buffer, void, unknown> {
    if (!this.deepgram) {
      throw new Error('Deepgram TTS not initialized');
    }

    const voice = options?.voice ?? this.config.voice;
    const encoding = options?.encoding ?? this.config.encoding;

    console.log(`[DeepgramTTS] Streaming synthesis: "${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"`);
    const startTime = Date.now();
    let firstChunkTime: number | null = null;

    try {
      // Build request options - don't send container param for mp3 encoding
      const requestOptions: any = {
        model: voice,
        encoding: encoding,
      };

      // Only include container for non-mp3 encodings
      if (encoding !== 'mp3') {
        requestOptions.container = options?.container ?? 'none';
      }

      const response = await this.deepgram.speak.request(
        { text },
        requestOptions
      );

      const stream = await response.getStream();
      if (!stream) {
        throw new Error('No audio stream returned from Deepgram');
      }

      const reader = stream.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (value) {
          if (!firstChunkTime) {
            firstChunkTime = Date.now();
            console.log(`[DeepgramTTS] First chunk received in ${firstChunkTime - startTime}ms`);
          }
          yield Buffer.from(value);
        }
      }

      const totalTime = Date.now() - startTime;
      console.log(`[DeepgramTTS] Stream complete in ${totalTime}ms (first chunk: ${firstChunkTime ? firstChunkTime - startTime : 'N/A'}ms)`);
    } catch (error) {
      console.error('[DeepgramTTS] Stream synthesis error:', error);
      throw error;
    }
  }

  /**
   * Update the default voice
   */
  setVoice(voice: DeepgramVoice): void {
    this.config.voice = voice;
    console.log(`[DeepgramTTS] Voice changed to: ${voice}`);
  }

  /**
   * Get current voice
   */
  getVoice(): DeepgramVoice {
    return this.config.voice;
  }

  /**
   * Get available voices with descriptions
   */
  static getAvailableVoices(): Array<{ id: DeepgramVoice; description: string }> {
    return [
      { id: 'aura-asteria-en', description: 'Female, American (default)' },
      { id: 'aura-luna-en', description: 'Female, American, soft' },
      { id: 'aura-stella-en', description: 'Female, American' },
      { id: 'aura-athena-en', description: 'Female, British' },
      { id: 'aura-hera-en', description: 'Female, American' },
      { id: 'aura-orion-en', description: 'Male, American (recommended for TTRPG)' },
      { id: 'aura-arcas-en', description: 'Male, American' },
      { id: 'aura-perseus-en', description: 'Male, American' },
      { id: 'aura-angus-en', description: 'Male, Irish' },
      { id: 'aura-orpheus-en', description: 'Male, American' },
      { id: 'aura-helios-en', description: 'Male, British' },
      { id: 'aura-zeus-en', description: 'Male, American, deep' },
    ];
  }
}

// Singleton instance with default TTRPG-friendly voice
export const deepgramTTS = new DeepgramTTS({
  voice: 'aura-orion-en', // Male narrator voice
});
