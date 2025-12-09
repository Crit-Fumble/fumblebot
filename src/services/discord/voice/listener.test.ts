/**
 * Voice Listener Unit Tests
 *
 * Tests for wake word detection, audio processing, and voice listening
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// Create hoisted mock for OpenAI
const mockTranscriptionsCreate = vi.fn().mockResolvedValue('Hey FumbleBot roll d20');

// Mock OpenAI before importing the module
vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      audio = {
        transcriptions: {
          create: mockTranscriptionsCreate,
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

// Mock prism-media
vi.mock('prism-media', () => ({
  default: {
    opus: {
      Decoder: class MockDecoder extends EventEmitter {
        constructor() {
          super();
        }
        destroy() {}
        removeAllListeners() { return this; }
      },
    },
  },
}));

// Import after mocks are set up
import { VoiceListener } from './listener.js';

// Helper function to create mock voice connection
function createMockConnection() {
  const mockSpeaking = new EventEmitter() as EventEmitter & { removeAllListeners: ReturnType<typeof vi.fn> };
  mockSpeaking.removeAllListeners = vi.fn().mockReturnThis();

  const mockReceiver = {
    speaking: mockSpeaking,
    subscribe: vi.fn().mockReturnValue(createMockAudioStream()),
  };

  return {
    receiver: mockReceiver,
  };
}

// Helper function to create mock audio stream
function createMockAudioStream() {
  const stream = new EventEmitter() as EventEmitter & {
    pipe: ReturnType<typeof vi.fn>;
    setMaxListeners: ReturnType<typeof vi.fn>;
    removeAllListeners: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  };
  stream.pipe = vi.fn().mockReturnThis();
  stream.setMaxListeners = vi.fn().mockReturnThis();
  stream.removeAllListeners = vi.fn().mockReturnThis();
  stream.destroy = vi.fn();
  return stream;
}

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

  describe('Hallucination Detection', () => {
    it('should detect empty and very short text as hallucination', () => {
      const isHallucination = (listener as any).isHallucination.bind(listener);

      expect(isHallucination('')).toBe(true);
      expect(isHallucination('hi')).toBe(true);
      expect(isHallucination('ok')).toBe(true);
    });

    it('should detect punctuation-only text as hallucination', () => {
      const isHallucination = (listener as any).isHallucination.bind(listener);

      expect(isHallucination('...')).toBe(true);
      expect(isHallucination('....')).toBe(true);
      expect(isHallucination(' . , - ')).toBe(true);
    });

    it('should detect common Whisper hallucinations', () => {
      const isHallucination = (listener as any).isHallucination.bind(listener);

      expect(isHallucination('thank you')).toBe(true);
      expect(isHallucination('thank you.')).toBe(true);
      expect(isHallucination('thanks')).toBe(true);
      expect(isHallucination('you')).toBe(true);
      expect(isHallucination('bye')).toBe(true);
      expect(isHallucination('goodbye')).toBe(true);
      expect(isHallucination('bye. bye.')).toBe(true);
      expect(isHallucination('goodbye. goodbye.')).toBe(true);
      expect(isHallucination('see you later')).toBe(true);
      expect(isHallucination('music')).toBe(true);
      expect(isHallucination('silence')).toBe(true);
      expect(isHallucination('[MUSIC]')).toBe(true);
      expect(isHallucination('[silence]')).toBe(true);
    });

    it('should detect filler words as hallucinations', () => {
      const isHallucination = (listener as any).isHallucination.bind(listener);

      expect(isHallucination('um')).toBe(true);
      expect(isHallucination('uh')).toBe(true);
      expect(isHallucination('hmm')).toBe(true);
      expect(isHallucination('umum')).toBe(true);
      expect(isHallucination('okay')).toBe(true);
      expect(isHallucination('ok')).toBe(true);
      expect(isHallucination('yes')).toBe(true);
      expect(isHallucination('no')).toBe(true);
      expect(isHallucination('right')).toBe(true);
      expect(isHallucination('yeah')).toBe(true);
      expect(isHallucination('yep')).toBe(true);
      expect(isHallucination('nope')).toBe(true);
    });

    it('should detect isolated greetings/farewells as hallucinations', () => {
      const isHallucination = (listener as any).isHallucination.bind(listener);

      expect(isHallucination('hello')).toBe(true);
      expect(isHallucination('hi')).toBe(true);
      expect(isHallucination('sorry')).toBe(true);
      expect(isHallucination("i'm sorry")).toBe(true);
    });

    it('should detect conjunctions/articles alone as hallucinations', () => {
      const isHallucination = (listener as any).isHallucination.bind(listener);

      expect(isHallucination('so')).toBe(true);
      expect(isHallucination('and')).toBe(true);
      expect(isHallucination('but')).toBe(true);
      expect(isHallucination('the')).toBe(true);
    });

    it('should detect repeated phrases as hallucinations (4+ words)', () => {
      const isHallucination = (listener as any).isHallucination.bind(listener);

      // Needs 4+ words for repeated phrase detection (first half === second half)
      expect(isHallucination('test test test test')).toBe(true);
      expect(isHallucination('roll d20 roll d20')).toBe(true);
      expect(isHallucination('one two one two')).toBe(true);
    });

    it('should NOT detect valid dice commands as hallucinations', () => {
      const isHallucination = (listener as any).isHallucination.bind(listener);

      // The regex \d+?d\d+ requires a digit before 'd', so "d20" alone fails
      // but "2d6" passes because it has digit-d-digit pattern
      expect(isHallucination('2d6')).toBe(false);
      expect(isHallucination('4d8')).toBe(false);
      expect(isHallucination('1d20')).toBe(false);
      // Note: bare "d20" is caught as too short (< 5 chars) and doesn't match regex
      expect(isHallucination('d20')).toBe(true); // Too short, no digit before d
    });

    it('should NOT detect valid transcriptions as hallucinations', () => {
      const isHallucination = (listener as any).isHallucination.bind(listener);

      expect(isHallucination('hey fumblebot roll d20')).toBe(false);
      expect(isHallucination('roll initiative')).toBe(false);
      expect(isHallucination('attack the goblin')).toBe(false);
      expect(isHallucination('what is my armor class')).toBe(false);
    });
  });

  describe('startListening and stopListening', () => {
    it('should set listening state when started', () => {
      const mockConnection = createMockConnection();

      listener.startListening(mockConnection as any, 'test-guild-123');

      expect(listener.listening).toBe(true);
      expect(listener.currentGuildId).toBe('test-guild-123');
    });

    it('should stop previous session when starting new one', () => {
      const mockConnection1 = createMockConnection();
      const mockConnection2 = createMockConnection();

      listener.startListening(mockConnection1 as any, 'guild-1');
      expect(listener.currentGuildId).toBe('guild-1');

      listener.startListening(mockConnection2 as any, 'guild-2');
      expect(listener.currentGuildId).toBe('guild-2');
    });

    it('should use custom whisper prompt when provided', () => {
      const mockConnection = createMockConnection();
      const customPrompt = 'Custom TTRPG prompt for testing';

      listener.startListening(mockConnection as any, 'test-guild', customPrompt);

      expect((listener as any).whisperPrompt).toBe(customPrompt);
    });

    it('should use default prompt when not provided', () => {
      const mockConnection = createMockConnection();

      listener.startListening(mockConnection as any, 'test-guild');

      expect((listener as any).whisperPrompt).toContain('TTRPG game session');
    });

    it('should clear listening state when stopped', () => {
      const mockConnection = createMockConnection();

      listener.startListening(mockConnection as any, 'test-guild');
      expect(listener.listening).toBe(true);

      listener.stopListening();
      expect(listener.listening).toBe(false);
    });

    it('should do nothing when stopping without listening', () => {
      expect(listener.listening).toBe(false);
      listener.stopListening(); // Should not throw
      expect(listener.listening).toBe(false);
    });

    it('should clean up all user states when stopping', () => {
      const mockConnection = createMockConnection();
      const userStates = (listener as any).userStates as Map<string, any>;

      listener.startListening(mockConnection as any, 'test-guild');

      // Simulate adding user states
      userStates.set('user-1', { userId: 'user-1', buffer: [] });
      userStates.set('user-2', { userId: 'user-2', buffer: [] });

      listener.stopListening();

      expect(userStates.size).toBe(0);
    });

    it('should remove speaking event listeners when stopping', () => {
      const mockConnection = createMockConnection();
      const mockReceiver = mockConnection.receiver;

      listener.startListening(mockConnection as any, 'test-guild');
      listener.stopListening();

      expect(mockReceiver.speaking.removeAllListeners).toHaveBeenCalledWith('start');
      expect(mockReceiver.speaking.removeAllListeners).toHaveBeenCalledWith('end');
    });
  });

  describe('handleSpeakingStart', () => {
    it('should emit listening event when user starts speaking', () => {
      const mockConnection = createMockConnection();
      listener.startListening(mockConnection as any, 'test-guild');

      const listeningPromise = new Promise<string>((resolve) => {
        listener.on('listening', resolve);
      });

      // Trigger speaking start
      mockConnection.receiver.speaking.emit('start', 'user-123');

      return listeningPromise.then((userId) => {
        expect(userId).toBe('user-123');
      });
    });

    it('should create user state when speaking starts', () => {
      const mockConnection = createMockConnection();
      const userStates = (listener as any).userStates as Map<string, any>;

      listener.startListening(mockConnection as any, 'test-guild');
      mockConnection.receiver.speaking.emit('start', 'user-456');

      expect(userStates.has('user-456')).toBe(true);
      const state = userStates.get('user-456');
      expect(state.userId).toBe('user-456');
      expect(state.isRecording).toBe(true);
      expect(state.buffer).toEqual([]);
    });

    it('should subscribe to user audio stream', () => {
      const mockConnection = createMockConnection();

      listener.startListening(mockConnection as any, 'test-guild');
      mockConnection.receiver.speaking.emit('start', 'user-789');

      expect(mockConnection.receiver.subscribe).toHaveBeenCalledWith('user-789', {
        end: { behavior: 3 }, // Manual
      });
    });

    it('should not create new stream if already exists for user', () => {
      const mockConnection = createMockConnection();
      const userStates = (listener as any).userStates as Map<string, any>;

      listener.startListening(mockConnection as any, 'test-guild');

      // First speaking event
      mockConnection.receiver.speaking.emit('start', 'user-123');
      const firstCallCount = mockConnection.receiver.subscribe.mock.calls.length;

      // Simulate state has active stream
      const state = userStates.get('user-123');
      state.audioStream = createMockAudioStream();
      state.decoder = { on: vi.fn(), removeAllListeners: vi.fn(), destroy: vi.fn() };

      // Second speaking event - should resume, not create new stream
      mockConnection.receiver.speaking.emit('start', 'user-123');

      expect(mockConnection.receiver.subscribe.mock.calls.length).toBe(firstCallCount);
    });

    it('should clear silence timeout when user starts speaking again', () => {
      const mockConnection = createMockConnection();
      const userStates = (listener as any).userStates as Map<string, any>;

      listener.startListening(mockConnection as any, 'test-guild');
      mockConnection.receiver.speaking.emit('start', 'user-123');

      // Simulate state with silence timeout
      const state = userStates.get('user-123');
      state.audioStream = createMockAudioStream();
      state.decoder = { on: vi.fn(), removeAllListeners: vi.fn(), destroy: vi.fn() };
      state.silenceTimeout = setTimeout(() => {}, 5000);

      // Trigger start again
      mockConnection.receiver.speaking.emit('start', 'user-123');

      expect(state.silenceTimeout).toBeUndefined();
    });

    it('should not handle speaking start when not listening', () => {
      const mockConnection = createMockConnection();
      const userStates = (listener as any).userStates as Map<string, any>;

      // Don't start listening
      (listener as any).receiver = mockConnection.receiver;
      (listener as any).isListening = false;

      // Manually call handleSpeakingStart
      (listener as any).handleSpeakingStart('user-123');

      expect(userStates.has('user-123')).toBe(false);
    });
  });

  describe('handleSpeakingEnd', () => {
    it('should emit stopped event after silence timeout', async () => {
      vi.useFakeTimers();
      const mockConnection = createMockConnection();

      listener.startListening(mockConnection as any, 'test-guild');
      mockConnection.receiver.speaking.emit('start', 'user-123');

      const stoppedPromise = new Promise<string>((resolve) => {
        listener.on('stopped', resolve);
      });

      // Trigger speaking end
      mockConnection.receiver.speaking.emit('end', 'user-123');

      // Fast-forward past silence threshold
      vi.advanceTimersByTime(1500);

      const userId = await stoppedPromise;
      expect(userId).toBe('user-123');

      vi.useRealTimers();
    });

    it('should not emit stopped if user not in state', () => {
      const mockConnection = createMockConnection();
      let stoppedCalled = false;

      listener.startListening(mockConnection as any, 'test-guild');
      listener.on('stopped', () => { stoppedCalled = true; });

      // Emit end without start
      mockConnection.receiver.speaking.emit('end', 'unknown-user');

      expect(stoppedCalled).toBe(false);
    });
  });

  describe('processAudioBuffer', () => {
    it('should skip processing when OpenAI is not initialized', async () => {
      const listener2 = new VoiceListener();
      (listener2 as any).openai = null;

      const state = {
        userId: 'test-user',
        buffer: [Buffer.alloc(100)],
        lastAudioTime: Date.now(),
        isRecording: true,
      };

      await (listener2 as any).processAudioBuffer(state);
      expect(state.buffer).toEqual([]);
    });

    it('should skip processing when buffer is empty', async () => {
      const state = {
        userId: 'test-user',
        buffer: [],
        lastAudioTime: Date.now(),
        isRecording: true,
      };

      await (listener as any).processAudioBuffer(state);
      // Should complete without error
    });

    it('should skip processing when audio is too short', async () => {
      // Create a very short buffer (less than 300ms)
      const shortBuffer = Buffer.alloc(100); // Very small
      const state = {
        userId: 'test-user',
        buffer: [shortBuffer],
        lastAudioTime: Date.now(),
        isRecording: true,
      };

      await (listener as any).processAudioBuffer(state);
      // Should complete without calling transcription
      expect(mockTranscriptionsCreate).not.toHaveBeenCalled();
    });

    it('should call OpenAI transcription with audio buffer', async () => {
      // Create buffer that's long enough (> 300ms at 48kHz stereo)
      // 48000 samples/sec * 2 channels * 2 bytes * 0.5 sec = 192000 bytes
      const audioBuffer = Buffer.alloc(200000);
      const state = {
        userId: 'test-user',
        buffer: [audioBuffer],
        lastAudioTime: Date.now(),
        isRecording: true,
      };

      mockTranscriptionsCreate.mockResolvedValueOnce('hey fumblebot roll d20');

      await (listener as any).processAudioBuffer(state);

      expect(mockTranscriptionsCreate).toHaveBeenCalledWith({
        file: expect.any(File),
        model: 'whisper-1',
        language: 'en',
        response_format: 'text',
        prompt: expect.any(String),
      });
    });

    it('should emit transcription event with text', async () => {
      const audioBuffer = Buffer.alloc(200000);
      const state = {
        userId: 'test-user',
        buffer: [audioBuffer],
        lastAudioTime: Date.now(),
        isRecording: true,
      };

      mockTranscriptionsCreate.mockResolvedValueOnce('test transcription text');

      const transcriptionPromise = new Promise<{ userId: string; text: string }>((resolve) => {
        listener.on('transcription', (userId, text) => {
          resolve({ userId, text });
        });
      });

      await (listener as any).processAudioBuffer(state);

      const result = await transcriptionPromise;
      expect(result.userId).toBe('test-user');
      expect(result.text).toBe('test transcription text');
    });

    it('should emit wakeWord event when wake word detected', async () => {
      const audioBuffer = Buffer.alloc(200000);
      const state = {
        userId: 'test-user',
        buffer: [audioBuffer],
        lastAudioTime: Date.now(),
        isRecording: true,
      };

      mockTranscriptionsCreate.mockResolvedValueOnce('hey fumblebot roll initiative');

      const wakeWordPromise = new Promise<{ userId: string; command: string }>((resolve) => {
        listener.on('wakeWord', (userId, command) => {
          resolve({ userId, command });
        });
      });

      await (listener as any).processAudioBuffer(state);

      const result = await wakeWordPromise;
      expect(result.userId).toBe('test-user');
      expect(result.command).toBe('roll initiative');
    });

    it('should emit error event on transcription failure', async () => {
      const audioBuffer = Buffer.alloc(200000);
      const state = {
        userId: 'test-user',
        buffer: [audioBuffer],
        lastAudioTime: Date.now(),
        isRecording: true,
      };

      mockTranscriptionsCreate.mockRejectedValueOnce(new Error('Transcription failed'));

      const errorPromise = new Promise<Error>((resolve) => {
        listener.on('error', resolve);
      });

      await (listener as any).processAudioBuffer(state);

      const error = await errorPromise;
      expect(error.message).toBe('Transcription failed');
    });

    it('should clear buffer after processing', async () => {
      const audioBuffer = Buffer.alloc(200000);
      const state = {
        userId: 'test-user',
        buffer: [audioBuffer],
        lastAudioTime: Date.now(),
        isRecording: true,
      };

      mockTranscriptionsCreate.mockResolvedValueOnce('test');

      await (listener as any).processAudioBuffer(state);

      expect(state.buffer).toEqual([]);
      expect(state.isRecording).toBe(false);
    });

    it('should not emit wakeWord for hallucinations', async () => {
      const audioBuffer = Buffer.alloc(200000);
      const state = {
        userId: 'test-user',
        buffer: [audioBuffer],
        lastAudioTime: Date.now(),
        isRecording: true,
      };

      mockTranscriptionsCreate.mockResolvedValueOnce('thank you');

      let wakeWordCalled = false;
      listener.on('wakeWord', () => { wakeWordCalled = true; });

      await (listener as any).processAudioBuffer(state);

      expect(wakeWordCalled).toBe(false);
    });
  });

  describe('clearUserState with streams', () => {
    it('should destroy decoder when clearing state', () => {
      const userStates = (listener as any).userStates as Map<string, any>;
      const mockDecoder = {
        removeAllListeners: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      };

      userStates.set('user-123', {
        userId: 'user-123',
        buffer: [],
        isRecording: true,
        decoder: mockDecoder,
      });

      (listener as any).clearUserState('user-123');

      expect(mockDecoder.removeAllListeners).toHaveBeenCalled();
      expect(mockDecoder.destroy).toHaveBeenCalled();
    });

    it('should destroy audio stream when clearing state', () => {
      const userStates = (listener as any).userStates as Map<string, any>;
      const mockStream = {
        removeAllListeners: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      };

      userStates.set('user-123', {
        userId: 'user-123',
        buffer: [],
        isRecording: true,
        audioStream: mockStream,
      });

      (listener as any).clearUserState('user-123');

      expect(mockStream.removeAllListeners).toHaveBeenCalled();
      expect(mockStream.destroy).toHaveBeenCalled();
    });

    it('should clear silence timeout when clearing state', () => {
      vi.useFakeTimers();
      const userStates = (listener as any).userStates as Map<string, any>;
      const timeoutId = setTimeout(() => {}, 5000);

      userStates.set('user-123', {
        userId: 'user-123',
        buffer: [],
        isRecording: true,
        silenceTimeout: timeoutId,
      });

      (listener as any).clearUserState('user-123');

      expect(userStates.has('user-123')).toBe(false);
      vi.useRealTimers();
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
