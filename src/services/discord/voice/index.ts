/**
 * Voice Module - Discord Voice Integration
 *
 * Exports:
 * - VoiceClient: Join/leave channels, play audio
 * - VoiceListener: Receive audio, detect wake words (Whisper-based)
 * - DeepgramListener: Receive audio, detect wake words (Deepgram-based, preferred)
 * - VoiceAssistant: Process voice commands, respond with TTS
 */

export { VoiceClient, voiceClient } from './client.js';
export { VoiceListener, voiceListener } from './listener.js';
export { DeepgramListener, deepgramListener } from './deepgram-listener.js';
export { DeepgramTTS, deepgramTTS, type DeepgramVoice } from './deepgram-tts.js';
export {
  VoiceAssistant,
  voiceAssistant,
  type VoiceAssistantConfig,
  type VoiceCommand,
  type TranscriptionEntry,
  type SessionTranscript,
} from './assistant.js';
export type { SoundEffectRequest, VoiceStatus, RpgSoundAsset } from './types.js';
