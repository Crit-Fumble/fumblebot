/**
 * Unit Tests for Deepgram TTS
 * Tests text-to-speech synthesis functionality
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Create hoisted mocks
const { mockCreateClient, mockSpeak, mockGetStream } = vi.hoisted(() => {
  const mockGetStream = vi.fn()
  const mockSpeak = {
    request: vi.fn().mockResolvedValue({
      getStream: mockGetStream,
    }),
  }
  const mockCreateClient = vi.fn().mockReturnValue({
    speak: mockSpeak,
  })
  return { mockCreateClient, mockSpeak, mockGetStream }
})

// Mock Deepgram SDK
vi.mock('@deepgram/sdk', () => ({
  createClient: mockCreateClient,
}))

// Mock config
vi.mock('../../../src/config.js', () => ({
  getVoiceConfig: vi.fn().mockReturnValue({
    deepgramApiKey: 'test-api-key',
  }),
}))

import { DeepgramTTS } from '../../../src/services/discord/voice/deepgram-tts.js'
import { getVoiceConfig } from '../../../src/config.js'

describe('DeepgramTTS', () => {
  let tts: DeepgramTTS

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock to return API key by default
    ;(getVoiceConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      deepgramApiKey: 'test-api-key',
    })
    tts = new DeepgramTTS({
      voice: 'aura-orion-en',
      encoding: 'mp3',
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('configuration', () => {
    it('should initialize with default TTRPG voice', () => {
      const defaultTTS = new DeepgramTTS()
      expect(defaultTTS.getVoice()).toBe('aura-orion-en')
    })

    it('should allow custom voice selection', () => {
      const customTTS = new DeepgramTTS({ voice: 'aura-luna-en' })
      expect(customTTS.getVoice()).toBe('aura-luna-en')
    })

    it('should change voice dynamically', () => {
      tts.setVoice('aura-zeus-en')
      expect(tts.getVoice()).toBe('aura-zeus-en')
    })
  })

  describe('available voices', () => {
    it('should list all available voices', () => {
      const voices = DeepgramTTS.getAvailableVoices()

      expect(voices).toHaveLength(12)
      expect(voices).toContainEqual({
        id: 'aura-orion-en',
        description: 'Male, American (recommended for TTRPG)',
      })
    })

    it('should include both male and female voices', () => {
      const voices = DeepgramTTS.getAvailableVoices()

      const maleVoices = voices.filter(v => v.description.includes('Male'))
      const femaleVoices = voices.filter(v => v.description.includes('Female'))

      expect(maleVoices.length).toBeGreaterThan(0)
      expect(femaleVoices.length).toBeGreaterThan(0)
    })
  })

  describe('initialization', () => {
    it('should be available when API key is provided', () => {
      expect(tts.isAvailable).toBe(true)
      expect(mockCreateClient).toHaveBeenCalledWith('test-api-key')
    })

    it('should not be available when no API key is provided', () => {
      ;(getVoiceConfig as ReturnType<typeof vi.fn>).mockReturnValue({
        deepgramApiKey: undefined,
      })

      const noKeyTTS = new DeepgramTTS()
      expect(noKeyTTS.isAvailable).toBe(false)
    })

    it('should log warning when no API key is provided', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      ;(getVoiceConfig as ReturnType<typeof vi.fn>).mockReturnValue({
        deepgramApiKey: undefined,
      })

      new DeepgramTTS()

      expect(warnSpy).toHaveBeenCalledWith('[DeepgramTTS] No Deepgram API key found - TTS disabled')
      warnSpy.mockRestore()
    })
  })

  describe('synthesize', () => {
    it('should throw error when not initialized', async () => {
      ;(getVoiceConfig as ReturnType<typeof vi.fn>).mockReturnValue({
        deepgramApiKey: undefined,
      })

      const noKeyTTS = new DeepgramTTS()

      await expect(noKeyTTS.synthesize('Hello world')).rejects.toThrow(
        'Deepgram TTS not initialized'
      )
    })

    it('should call Deepgram API with correct parameters', async () => {
      // Create a mock readable stream
      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({ done: false, value: new Uint8Array([1, 2, 3]) })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      }
      mockGetStream.mockResolvedValue({
        getReader: () => mockReader,
      })

      await tts.synthesize('Hello world')

      expect(mockSpeak.request).toHaveBeenCalledWith(
        { text: 'Hello world' },
        { model: 'aura-orion-en', encoding: 'mp3' }
      )
    })

    it('should return audio buffer from synthesis', async () => {
      const mockAudioData = new Uint8Array([1, 2, 3, 4, 5])
      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({ done: false, value: mockAudioData })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      }
      mockGetStream.mockResolvedValue({
        getReader: () => mockReader,
      })

      const result = await tts.synthesize('Test text')

      expect(Buffer.isBuffer(result)).toBe(true)
      expect(result.length).toBe(5)
    })

    it('should use custom voice from options', async () => {
      const mockReader = {
        read: vi.fn().mockResolvedValueOnce({ done: true, value: undefined }),
      }
      mockGetStream.mockResolvedValue({
        getReader: () => mockReader,
      })

      await tts.synthesize('Hello', { voice: 'aura-luna-en' })

      expect(mockSpeak.request).toHaveBeenCalledWith(
        { text: 'Hello' },
        { model: 'aura-luna-en', encoding: 'mp3' }
      )
    })

    it('should include container for non-mp3 encodings', async () => {
      const mockReader = {
        read: vi.fn().mockResolvedValueOnce({ done: true, value: undefined }),
      }
      mockGetStream.mockResolvedValue({
        getReader: () => mockReader,
      })

      await tts.synthesize('Hello', { encoding: 'linear16', container: 'wav' })

      expect(mockSpeak.request).toHaveBeenCalledWith(
        { text: 'Hello' },
        { model: 'aura-orion-en', encoding: 'linear16', container: 'wav' }
      )
    })

    it('should throw error when no stream is returned', async () => {
      mockGetStream.mockResolvedValue(null)

      await expect(tts.synthesize('Test')).rejects.toThrow(
        'No audio stream returned from Deepgram'
      )
    })

    it('should re-throw errors from Deepgram API', async () => {
      mockSpeak.request.mockRejectedValueOnce(new Error('API Error'))

      await expect(tts.synthesize('Test')).rejects.toThrow('API Error')
    })

    it('should log synthesis information', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({ done: false, value: new Uint8Array([1, 2, 3]) })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      }
      mockGetStream.mockResolvedValue({
        getReader: () => mockReader,
      })

      await tts.synthesize('Hello world')

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DeepgramTTS] Synthesizing:')
      )
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DeepgramTTS] Generated')
      )

      logSpy.mockRestore()
    })
  })

  describe('synthesizeStream', () => {
    it('should throw error when not initialized', async () => {
      ;(getVoiceConfig as ReturnType<typeof vi.fn>).mockReturnValue({
        deepgramApiKey: undefined,
      })

      const noKeyTTS = new DeepgramTTS()
      const generator = noKeyTTS.synthesizeStream('Hello world')

      await expect(generator.next()).rejects.toThrow('Deepgram TTS not initialized')
    })

    it('should yield audio chunks as Buffer', async () => {
      const chunk1 = new Uint8Array([1, 2, 3])
      const chunk2 = new Uint8Array([4, 5, 6])

      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({ done: false, value: chunk1 })
          .mockResolvedValueOnce({ done: false, value: chunk2 })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      }
      mockGetStream.mockResolvedValue({
        getReader: () => mockReader,
      })

      const chunks: Buffer[] = []
      for await (const chunk of tts.synthesizeStream('Test text')) {
        chunks.push(chunk)
      }

      expect(chunks).toHaveLength(2)
      expect(Buffer.isBuffer(chunks[0])).toBe(true)
      expect(Buffer.isBuffer(chunks[1])).toBe(true)
    })

    it('should use custom options', async () => {
      const mockReader = {
        read: vi.fn().mockResolvedValueOnce({ done: true, value: undefined }),
      }
      mockGetStream.mockResolvedValue({
        getReader: () => mockReader,
      })

      const chunks: Buffer[] = []
      for await (const chunk of tts.synthesizeStream('Hello', {
        voice: 'aura-zeus-en',
        encoding: 'opus',
        container: 'ogg',
      })) {
        chunks.push(chunk)
      }

      expect(mockSpeak.request).toHaveBeenCalledWith(
        { text: 'Hello' },
        { model: 'aura-zeus-en', encoding: 'opus', container: 'ogg' }
      )
    })

    it('should throw error when no stream is returned', async () => {
      mockGetStream.mockResolvedValue(null)

      const generator = tts.synthesizeStream('Test')

      await expect(generator.next()).rejects.toThrow(
        'No audio stream returned from Deepgram'
      )
    })

    it('should re-throw errors from Deepgram API', async () => {
      mockSpeak.request.mockRejectedValueOnce(new Error('Stream Error'))

      const generator = tts.synthesizeStream('Test')

      await expect(generator.next()).rejects.toThrow('Stream Error')
    })

    it('should log first chunk latency', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({ done: false, value: new Uint8Array([1, 2]) })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      }
      mockGetStream.mockResolvedValue({
        getReader: () => mockReader,
      })

      for await (const _ of tts.synthesizeStream('Test')) {
        // consume chunks
      }

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DeepgramTTS] First chunk received')
      )
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DeepgramTTS] Stream complete')
      )

      logSpy.mockRestore()
    })
  })

  describe('request options', () => {
    it('should not include container parameter for mp3 encoding', async () => {
      const mockReader = {
        read: vi.fn().mockResolvedValueOnce({ done: true, value: undefined }),
      }
      mockGetStream.mockResolvedValue({
        getReader: () => mockReader,
      })

      await tts.synthesize('Test', { encoding: 'mp3' })

      // Should NOT include container for mp3
      expect(mockSpeak.request).toHaveBeenCalledWith({ text: 'Test' }, { model: 'aura-orion-en', encoding: 'mp3' })

      // Verify container is not in the call
      const callArgs = mockSpeak.request.mock.calls[0][1]
      expect(callArgs).not.toHaveProperty('container')
    })

    it('should support different audio encodings', () => {
      const encodings = ['linear16', 'mp3', 'opus', 'flac', 'aac'] as const

      encodings.forEach(encoding => {
        const ttsWithEncoding = new DeepgramTTS({ encoding })
        expect(ttsWithEncoding).toBeDefined()
      })
    })
  })
})
