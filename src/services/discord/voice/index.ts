/**
 * Voice Module - Discord Voice Integration
 *
 * Exports:
 * - VoiceClient: Join/leave channels, play audio
 * - VoiceListener: Receive audio, detect wake words
 * - VoiceAssistant: Process voice commands, respond with TTS
 */

export { VoiceClient, voiceClient } from './client.js';
export { VoiceListener, voiceListener } from './listener.js';
export {
  VoiceAssistant,
  voiceAssistant,
  type VoiceAssistantConfig,
  type VoiceCommand,
} from './assistant.js';
export type { SoundEffectRequest, VoiceStatus, RpgSoundAsset } from './types.js';
