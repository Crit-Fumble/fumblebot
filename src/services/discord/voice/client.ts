/**
 * Voice Client for FumbleBot
 * Handles Discord voice channel connections and audio playback
 */

import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  entersState,
  VoiceConnectionStatus,
  AudioPlayerStatus,
  type VoiceConnection,
  type AudioPlayer,
} from '@discordjs/voice';
import type { VoiceBasedChannel } from 'discord.js';
import { createReadStream } from 'fs';
import { Readable } from 'stream';

interface VoiceSession {
  connection: VoiceConnection;
  player: AudioPlayer;
  channelId: string;
  guildId: string;
}

export class VoiceClient {
  private sessions: Map<string, VoiceSession> = new Map();

  /**
   * Join a voice channel
   */
  async joinChannel(channel: VoiceBasedChannel): Promise<VoiceConnection> {
    const guildId = channel.guild.id;
    const channelId = channel.id;

    // Check if already in this channel
    const existing = this.sessions.get(guildId);
    if (existing && existing.channelId === channelId) {
      console.log(`[Voice] Already in channel ${channelId}`);
      return existing.connection;
    }

    // Leave current channel if in a different one
    if (existing) {
      await this.leaveChannel(guildId);
    }

    console.log(`[Voice] Joining channel ${channelId} in guild ${guildId}`);

    // Create connection
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator as any,
    });

    // Create audio player
    const player = createAudioPlayer();

    // Subscribe connection to player
    connection.subscribe(player);

    // Wait for connection to be ready
    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
      console.log(`[Voice] Successfully joined channel ${channelId}`);
    } catch (error) {
      connection.destroy();
      throw new Error(`Failed to join voice channel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Store session
    this.sessions.set(guildId, {
      connection,
      player,
      channelId,
      guildId,
    });

    // Handle disconnections
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      console.log(`[Voice] Disconnected from channel ${channelId}`);
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
        // Reconnected
      } catch (error) {
        // Failed to reconnect, clean up
        connection.destroy();
        this.sessions.delete(guildId);
      }
    });

    return connection;
  }

  /**
   * Leave a voice channel
   */
  async leaveChannel(guildId: string): Promise<void> {
    const session = this.sessions.get(guildId);
    if (!session) {
      console.log(`[Voice] Not in any channel in guild ${guildId}`);
      return;
    }

    console.log(`[Voice] Leaving channel ${session.channelId}`);

    session.player.stop();
    session.connection.destroy();
    this.sessions.delete(guildId);
  }

  /**
   * Play audio from a file path
   */
  async playFile(guildId: string, filePath: string): Promise<void> {
    const session = this.sessions.get(guildId);
    if (!session) {
      throw new Error('Not connected to a voice channel in this guild');
    }

    console.log(`[Voice] Playing audio file: ${filePath}`);

    const resource = createAudioResource(createReadStream(filePath));
    session.player.play(resource);

    // Wait for playback to finish
    return new Promise((resolve, reject) => {
      const onIdle = () => {
        cleanup();
        resolve();
      };

      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };

      const cleanup = () => {
        session.player.removeListener(AudioPlayerStatus.Idle, onIdle);
        session.player.removeListener('error', onError);
      };

      session.player.once(AudioPlayerStatus.Idle, onIdle);
      session.player.once('error', onError);
    });
  }

  /**
   * Play audio from a URL
   */
  async playUrl(guildId: string, url: string): Promise<void> {
    const session = this.sessions.get(guildId);
    if (!session) {
      throw new Error('Not connected to a voice channel in this guild');
    }

    console.log(`[Voice] Playing audio from URL: ${url}`);

    // Fetch audio stream from URL
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('No response body from audio URL');
    }

    // Convert web ReadableStream to Node.js Readable
    const stream = Readable.fromWeb(response.body as any);
    const resource = createAudioResource(stream);

    session.player.play(resource);

    // Wait for playback to finish
    return new Promise((resolve, reject) => {
      const onIdle = () => {
        cleanup();
        resolve();
      };

      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };

      const cleanup = () => {
        session.player.removeListener(AudioPlayerStatus.Idle, onIdle);
        session.player.removeListener('error', onError);
      };

      session.player.once(AudioPlayerStatus.Idle, onIdle);
      session.player.once('error', onError);
    });
  }

  /**
   * Play audio from a buffer
   */
  async playBuffer(guildId: string, buffer: Buffer): Promise<void> {
    const session = this.sessions.get(guildId);
    if (!session) {
      throw new Error('Not connected to a voice channel in this guild');
    }

    console.log(`[Voice] Playing audio from buffer (${buffer.length} bytes)`);

    const stream = Readable.from(buffer);
    const resource = createAudioResource(stream);

    session.player.play(resource);

    // Wait for playback to finish
    return new Promise((resolve, reject) => {
      const onIdle = () => {
        cleanup();
        resolve();
      };

      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };

      const cleanup = () => {
        session.player.removeListener(AudioPlayerStatus.Idle, onIdle);
        session.player.removeListener('error', onError);
      };

      session.player.once(AudioPlayerStatus.Idle, onIdle);
      session.player.once('error', onError);
    });
  }

  /**
   * Stop current playback
   */
  stop(guildId: string): void {
    const session = this.sessions.get(guildId);
    if (!session) {
      throw new Error('Not connected to a voice channel in this guild');
    }

    session.player.stop();
  }

  /**
   * Check if bot is in a voice channel
   */
  isConnected(guildId: string): boolean {
    return this.sessions.has(guildId);
  }

  /**
   * Get current voice channel ID
   */
  getCurrentChannel(guildId: string): string | null {
    const session = this.sessions.get(guildId);
    return session?.channelId ?? null;
  }

  /**
   * Get all active voice sessions
   */
  getActiveSessions(): Array<{ guildId: string; channelId: string }> {
    return Array.from(this.sessions.values()).map(session => ({
      guildId: session.guildId,
      channelId: session.channelId,
    }));
  }
}

// Singleton instance
export const voiceClient = new VoiceClient();
