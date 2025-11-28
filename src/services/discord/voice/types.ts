/**
 * Voice Integration Types
 */

export interface SoundEffectRequest {
  guildId: string;
  assetId: string;
  assetUrl: string;
  volume?: number; // 0.0 to 1.0
}

export interface VoiceStatus {
  connected: boolean;
  channelId: string | null;
  channelName?: string;
  isPlaying: boolean;
  currentTrack?: {
    assetId: string;
    name: string;
    startedAt: number;
  };
}

export interface RpgSoundAsset {
  id: string;
  name: string;
  url: string;
  assetType: 'sound' | 'music' | 'ambient';
  tags: string[];
  duration?: number; // in seconds
  volume?: number; // default volume 0.0 to 1.0
}
