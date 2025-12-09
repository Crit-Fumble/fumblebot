/**
 * Audio Player Service
 * Manages audio playback in Discord voice channels
 */

import {
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  type AudioPlayer,
  type AudioResource,
  type VoiceConnection,
} from '@discordjs/voice';
import { Readable } from 'stream';

interface QueueItem {
  url: string;
  name: string;
  requestedBy: string;
  duration?: number;
}

interface GuildAudioState {
  player: AudioPlayer;
  connection: VoiceConnection | null;
  queue: QueueItem[];
  currentItem: QueueItem | null;
  isPlaying: boolean;
  isPaused: boolean;
  volume: number;
}

class AudioPlayerService {
  private static instance: AudioPlayerService;
  private guildStates: Map<string, GuildAudioState> = new Map();

  private constructor() {}

  static getInstance(): AudioPlayerService {
    if (!AudioPlayerService.instance) {
      AudioPlayerService.instance = new AudioPlayerService();
    }
    return AudioPlayerService.instance;
  }

  /**
   * Get or create audio state for a guild
   */
  private getGuildState(guildId: string): GuildAudioState {
    let state = this.guildStates.get(guildId);
    if (!state) {
      const player = createAudioPlayer({
        behaviors: {
          noSubscriber: NoSubscriberBehavior.Pause,
        },
      });

      state = {
        player,
        connection: null,
        queue: [],
        currentItem: null,
        isPlaying: false,
        isPaused: false,
        volume: 1.0,
      };

      // Set up event listeners
      player.on(AudioPlayerStatus.Idle, () => {
        this.handleTrackEnd(guildId);
      });

      player.on('error', (error) => {
        console.error(`[AudioPlayer] Error in guild ${guildId}:`, error);
        this.handleTrackEnd(guildId);
      });

      this.guildStates.set(guildId, state);
    }
    return state;
  }

  /**
   * Connect to a voice connection
   */
  connect(guildId: string, connection: VoiceConnection): void {
    const state = this.getGuildState(guildId);
    state.connection = connection;
    connection.subscribe(state.player);
    console.log(`[AudioPlayer] Connected to voice in guild ${guildId}`);
  }

  /**
   * Disconnect from voice
   */
  disconnect(guildId: string): void {
    const state = this.guildStates.get(guildId);
    if (state) {
      state.player.stop();
      state.connection?.destroy();
      state.connection = null;
      state.queue = [];
      state.currentItem = null;
      state.isPlaying = false;
      state.isPaused = false;
      console.log(`[AudioPlayer] Disconnected from voice in guild ${guildId}`);
    }
  }

  /**
   * Add audio to the queue and play if not currently playing
   */
  async play(
    guildId: string,
    url: string,
    name: string,
    requestedBy: string
  ): Promise<{ position: number; isPlaying: boolean }> {
    const state = this.getGuildState(guildId);

    const item: QueueItem = {
      url,
      name,
      requestedBy,
    };

    state.queue.push(item);
    const position = state.queue.length;

    // If not currently playing, start playback
    if (!state.isPlaying) {
      await this.playNext(guildId);
      return { position: 0, isPlaying: true };
    }

    return { position, isPlaying: false };
  }

  /**
   * Play the next item in the queue
   */
  private async playNext(guildId: string): Promise<void> {
    const state = this.guildStates.get(guildId);
    if (!state || state.queue.length === 0) {
      if (state) {
        state.isPlaying = false;
        state.currentItem = null;
      }
      return;
    }

    const item = state.queue.shift()!;
    state.currentItem = item;
    state.isPlaying = true;
    state.isPaused = false;

    try {
      console.log(`[AudioPlayer] Playing: ${item.name} in guild ${guildId}`);

      // Create audio resource from URL
      const resource = createAudioResource(item.url, {
        inlineVolume: true,
      });

      if (resource.volume) {
        resource.volume.setVolume(state.volume);
      }

      state.player.play(resource);
    } catch (error) {
      console.error(`[AudioPlayer] Error playing ${item.name}:`, error);
      // Try next item
      await this.playNext(guildId);
    }
  }

  /**
   * Handle track ending
   */
  private handleTrackEnd(guildId: string): void {
    const state = this.guildStates.get(guildId);
    if (state) {
      state.currentItem = null;
      this.playNext(guildId);
    }
  }

  /**
   * Pause playback
   */
  pause(guildId: string): boolean {
    const state = this.guildStates.get(guildId);
    if (state && state.isPlaying && !state.isPaused) {
      state.player.pause();
      state.isPaused = true;
      console.log(`[AudioPlayer] Paused in guild ${guildId}`);
      return true;
    }
    return false;
  }

  /**
   * Resume playback
   */
  resume(guildId: string): boolean {
    const state = this.guildStates.get(guildId);
    if (state && state.isPaused) {
      state.player.unpause();
      state.isPaused = false;
      console.log(`[AudioPlayer] Resumed in guild ${guildId}`);
      return true;
    }
    return false;
  }

  /**
   * Stop playback and clear queue
   */
  stop(guildId: string): boolean {
    const state = this.guildStates.get(guildId);
    if (state) {
      state.player.stop();
      state.queue = [];
      state.currentItem = null;
      state.isPlaying = false;
      state.isPaused = false;
      console.log(`[AudioPlayer] Stopped in guild ${guildId}`);
      return true;
    }
    return false;
  }

  /**
   * Skip current track
   */
  skip(guildId: string): QueueItem | null {
    const state = this.guildStates.get(guildId);
    if (state && state.currentItem) {
      const skipped = state.currentItem;
      state.player.stop(); // This will trigger playNext via Idle event
      console.log(`[AudioPlayer] Skipped: ${skipped.name} in guild ${guildId}`);
      return skipped;
    }
    return null;
  }

  /**
   * Set volume (0.0 to 2.0)
   */
  setVolume(guildId: string, volume: number): boolean {
    const state = this.guildStates.get(guildId);
    if (state) {
      state.volume = Math.max(0, Math.min(2, volume));
      // Try to set volume on current resource
      const resource = (state.player.state as any).resource as AudioResource | undefined;
      if (resource?.volume) {
        resource.volume.setVolume(state.volume);
      }
      console.log(`[AudioPlayer] Volume set to ${state.volume} in guild ${guildId}`);
      return true;
    }
    return false;
  }

  /**
   * Get current queue
   */
  getQueue(guildId: string): { current: QueueItem | null; queue: QueueItem[] } {
    const state = this.guildStates.get(guildId);
    if (!state) {
      return { current: null, queue: [] };
    }
    return {
      current: state.currentItem,
      queue: [...state.queue],
    };
  }

  /**
   * Get playback status
   */
  getStatus(guildId: string): {
    isPlaying: boolean;
    isPaused: boolean;
    currentItem: QueueItem | null;
    queueLength: number;
    volume: number;
  } {
    const state = this.guildStates.get(guildId);
    if (!state) {
      return {
        isPlaying: false,
        isPaused: false,
        currentItem: null,
        queueLength: 0,
        volume: 1.0,
      };
    }
    return {
      isPlaying: state.isPlaying,
      isPaused: state.isPaused,
      currentItem: state.currentItem,
      queueLength: state.queue.length,
      volume: state.volume,
    };
  }

  /**
   * Clear the queue (without stopping current track)
   */
  clearQueue(guildId: string): number {
    const state = this.guildStates.get(guildId);
    if (state) {
      const cleared = state.queue.length;
      state.queue = [];
      console.log(`[AudioPlayer] Cleared ${cleared} items from queue in guild ${guildId}`);
      return cleared;
    }
    return 0;
  }

  /**
   * Check if connected to voice in a guild
   */
  isConnected(guildId: string): boolean {
    const state = this.guildStates.get(guildId);
    return state?.connection !== null && state?.connection !== undefined;
  }
}

export default AudioPlayerService.getInstance();
export { AudioPlayerService, QueueItem };
