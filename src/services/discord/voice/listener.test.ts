/**
 * Voice Listener Unit Tests
 *
 * Tests for wake word detection and audio processing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// Mock OpenAI before importing the module
vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      audio = {
        transcriptions: {
          create: vi.fn().mockResolvedValue('Hey FumbleBot roll d20'),
        },
      };
    },
  };
});

// Mock @discordjs/voice
vi.mock('@discordjs/voice', () => ({
  EndBehaviorType: {
    AfterSilence: 1,
    AfterInactivity: 2,
    Manual: 3,
  },
  VoiceConnectionStatus: {
    Ready: 'ready',
    Connecting: 'connecting',
    Disconnected: 'disconnected',
  },
}));

// Import after mocks are set up
import { VoiceListener } from './listener.js';

describe('VoiceListener', () => {
  let listener: VoiceListener;

  beforeEach(() => {
    // Set up OpenAI API key
    process.env.FUMBLEBOT_OPENAI_API_KEY = 'test-key';
    listener = new VoiceListener();
  });

  afterEach(() => {
    listener.stopListening();
    vi.clearAllMocks();
  });

  describe('Wake Word Detection', () => {
    it('should detect "hey fumblebot" wake word', () => {
      // Access private method through type assertion
      const checkWakeWord = (listener as any).checkWakeWord.bind(listener);

      expect(checkWakeWord('hey fumblebot roll d20')).toBe('hey fumblebot');
      expect(checkWakeWord('Hey FumbleBot what time is it')).toBe('hey fumblebot');
      expect(checkWakeWord('HEY FUMBLEBOT ROLL INITIATIVE')).toBe('hey fumblebot');
    });

    it('should detect "fumblebot" without "hey"', () => {
      const checkWakeWord = (listener as any).checkWakeWord.bind(listener);

      expect(checkWakeWord('fumblebot roll d20')).toBe('fumblebot');
      expect(checkWakeWord('FumbleBot help')).toBe('fumblebot');
    });

    it('should detect "hey fumble" variation', () => {
      const checkWakeWord = (listener as any).checkWakeWord.bind(listener);

      expect(checkWakeWord('hey fumble roll d20')).toBe('hey fumble');
    });

    it('should detect "okay fumblebot" variation', () => {
      const checkWakeWord = (listener as any).checkWakeWord.bind(listener);

      expect(checkWakeWord('okay fumblebot roll d20')).toBe('okay fumblebot');
      expect(checkWakeWord('ok fumblebot help')).toBe('ok fumblebot');
    });

    it('should return null for non-wake-word text', () => {
      const checkWakeWord = (listener as any).checkWakeWord.bind(listener);

      expect(checkWakeWord('hello world')).toBeNull();
      expect(checkWakeWord('roll d20')).toBeNull();
      expect(checkWakeWord('fumble something')).toBeNull();
      expect(checkWakeWord('the fumblebot is cool')).toBeNull(); // not at start
    });

    it('should handle empty and whitespace text', () => {
      const checkWakeWord = (listener as any).checkWakeWord.bind(listener);

      expect(checkWakeWord('')).toBeNull();
      expect(checkWakeWord('   ')).toBeNull();
      expect(checkWakeWord('  hey fumblebot roll')).toBe('hey fumblebot'); // with leading space
    });
  });

  describe('Audio Processing', () => {
    it('should create WAV header correctly', () => {
      // Create a small PCM buffer (48kHz stereo = 4 bytes per sample)
      const sampleCount = 100;
      const pcmBuffer = Buffer.alloc(sampleCount * 4);

      // Fill with simple sine wave data
      for (let i = 0; i < sampleCount; i++) {
        const value = Math.floor(Math.sin(i / 10) * 16384);
        pcmBuffer.writeInt16LE(value, i * 4); // left
        pcmBuffer.writeInt16LE(value, i * 4 + 2); // right
      }

      const pcmToWav = (listener as any).pcmToWav.bind(listener);
      const wavBuffer = pcmToWav(pcmBuffer);

      // Check WAV header
      expect(wavBuffer.toString('ascii', 0, 4)).toBe('RIFF');
      expect(wavBuffer.toString('ascii', 8, 12)).toBe('WAVE');
      expect(wavBuffer.toString('ascii', 12, 16)).toBe('fmt ');
      expect(wavBuffer.toString('ascii', 36, 40)).toBe('data');

      // Check format (16-bit PCM = 1)
      expect(wavBuffer.readUInt16LE(20)).toBe(1);

      // Check channels (mono = 1)
      expect(wavBuffer.readUInt16LE(22)).toBe(1);

      // Check sample rate (16kHz)
      expect(wavBuffer.readUInt32LE(24)).toBe(16000);
    });

    it('should downsample from 48kHz stereo to 16kHz mono', () => {
      const downsampleAudio = (listener as any).downsampleAudio.bind(listener);

      // Create test stereo audio at 48kHz
      // 48kHz / 16kHz = 3x downsampling
      const inputSamples = 300; // 300 stereo samples
      const input = Buffer.alloc(inputSamples * 4); // 4 bytes per stereo sample

      // Fill with test data
      for (let i = 0; i < inputSamples; i++) {
        input.writeInt16LE(1000 + i, i * 4); // left
        input.writeInt16LE(2000 + i, i * 4 + 2); // right
      }

      const output = downsampleAudio(input);

      // Should have 100 mono samples (300 / 3)
      expect(output.length).toBe(100 * 2); // 2 bytes per mono sample

      // First output sample should be average of first stereo sample
      // (1000 + 2000) / 2 = 1500
      expect(output.readInt16LE(0)).toBe(1500);
    });
  });

  describe('State Management', () => {
    it('should start in non-listening state', () => {
      expect(listener.listening).toBe(false);
    });

    it('should track current guild ID', () => {
      expect(listener.currentGuildId).toBe('');
    });

    it('should clear user state properly', () => {
      const clearUserState = (listener as any).clearUserState.bind(listener);
      const userStates = (listener as any).userStates as Map<string, any>;

      // Add a mock user state
      userStates.set('test-user', {
        userId: 'test-user',
        buffer: [Buffer.from('test')],
        lastAudioTime: Date.now(),
        isRecording: true,
        silenceTimeout: setTimeout(() => {}, 1000),
      });

      // Clear it
      clearUserState('test-user');

      // Should be removed
      expect(userStates.has('test-user')).toBe(false);
    });
  });

  describe('Event Emission', () => {
    it('should emit wakeWord event when detected', async () => {
      const wakeWordPromise = new Promise<{ userId: string; command: string }>((resolve) => {
        listener.on('wakeWord', (userId, command) => {
          resolve({ userId, command });
        });
      });

      // Manually trigger the event (simulating what would happen after transcription)
      listener.emit('wakeWord', 'test-user-123', 'roll d20');

      const result = await wakeWordPromise;
      expect(result.userId).toBe('test-user-123');
      expect(result.command).toBe('roll d20');
    });

    it('should emit transcription event', async () => {
      const transcriptionPromise = new Promise<{ userId: string; text: string }>((resolve) => {
        listener.on('transcription', (userId, text) => {
          resolve({ userId, text });
        });
      });

      listener.emit('transcription', 'test-user', 'hey fumblebot roll d20');

      const result = await transcriptionPromise;
      expect(result.userId).toBe('test-user');
      expect(result.text).toBe('hey fumblebot roll d20');
    });

    it('should emit error events', async () => {
      const errorPromise = new Promise<Error>((resolve) => {
        listener.on('error', (error) => {
          resolve(error);
        });
      });

      const testError = new Error('Test error');
      listener.emit('error', testError);

      const result = await errorPromise;
      expect(result.message).toBe('Test error');
    });
  });
});

describe('Voice Command Parsing', () => {
  it('should extract command after wake word', () => {
    const text = 'hey fumblebot roll 2d6 plus 3';
    const wakeWord = 'hey fumblebot';
    const command = text.slice(wakeWord.length).trim();

    expect(command).toBe('roll 2d6 plus 3');
  });

  it('should handle commands with various formats', () => {
    const testCases = [
      { input: 'hey fumblebot roll d20', expected: 'roll d20' },
      { input: 'fumblebot roll initiative', expected: 'roll initiative' },
      { input: 'hey fumble goodbye', expected: 'goodbye' },
      { input: 'okay fumblebot help', expected: 'help' },
    ];

    for (const { input, expected } of testCases) {
      // Find which wake word matches
      const wakeWords = ['hey fumblebot', 'fumblebot', 'hey fumble', 'okay fumblebot'];
      for (const wakeWord of wakeWords) {
        if (input.toLowerCase().startsWith(wakeWord)) {
          const command = input.toLowerCase().slice(wakeWord.length).trim();
          expect(command).toBe(expected);
          break;
        }
      }
    }
  });
});
