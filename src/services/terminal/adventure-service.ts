/**
 * Adventure Service
 * Manages MUD-style text adventure sessions via Core Adventure API
 *
 * Uses the new @crit-fumble/core Adventure API for:
 * - Creating and managing adventure sessions
 * - Player join/leave
 * - Sending actions, dialogue, emotes, and narratives
 * - Message history
 */

import { getCoreClient } from '../../lib/core-client.js';
import type {
  Adventure,
  AdventureSummary,
  AdventureMessage,
  AdventurePlayer,
  AdventureRole,
  AdventureStatus,
  AdventureMessageType,
} from '@crit-fumble/core';

export interface AdventureSession {
  id: string;
  guildId: string;
  channelId: string;
  name: string;
  description?: string;
  status: AdventureStatus;
  players: AdventurePlayer[];
  playerCount: number;
  createdAt: string;
  startedAt?: string;
}

export interface SendMessageResult {
  success: boolean;
  message: AdventureMessage;
}

class AdventureService {
  private static instance: AdventureService;

  private constructor() {}

  static getInstance(): AdventureService {
    if (!AdventureService.instance) {
      AdventureService.instance = new AdventureService();
    }
    return AdventureService.instance;
  }

  /**
   * Create a new adventure session for a channel
   */
  async create(
    guildId: string,
    channelId: string,
    name: string,
    description?: string
  ): Promise<AdventureSession> {
    console.log(`[Adventure] Creating adventure "${name}" for guild ${guildId}, channel ${channelId}`);

    const client = getCoreClient();
    const response = await client.adventure.create({
      guildId,
      channelId,
      name,
      description,
    });

    console.log(`[Adventure] Created adventure: ${response.adventure.id}`);

    return {
      id: response.adventure.id,
      guildId: response.adventure.guildId,
      channelId: response.adventure.channelId,
      name: response.adventure.name,
      description: response.adventure.description,
      status: response.adventure.status,
      players: [],
      playerCount: response.adventure.playerCount,
      createdAt: response.adventure.createdAt,
      startedAt: response.adventure.startedAt,
    };
  }

  /**
   * Get adventure by ID
   */
  async get(adventureId: string): Promise<Adventure> {
    const client = getCoreClient();
    const response = await client.adventure.get(adventureId);
    return response.adventure;
  }

  /**
   * Get adventure for a channel (if one exists)
   */
  async getByChannel(guildId: string, channelId: string): Promise<Adventure | null> {
    try {
      const client = getCoreClient();
      const response = await client.adventure.getByChannel(guildId, channelId);
      return response.adventure;
    } catch (error: any) {
      // 404 means no adventure exists for this channel
      if (error?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * List all active adventures
   */
  async list(): Promise<AdventureSummary[]> {
    const client = getCoreClient();
    const response = await client.adventure.list();
    return response.adventures;
  }

  /**
   * Join an adventure session
   */
  async join(
    adventureId: string,
    playerId: string,
    playerName: string,
    role: AdventureRole = 'player'
  ): Promise<{ success: boolean; status: AdventureStatus; playerCount: number }> {
    console.log(`[Adventure] Player ${playerName} (${playerId}) joining adventure ${adventureId} as ${role}`);

    const client = getCoreClient();
    const response = await client.adventure.join(adventureId, {
      playerId,
      playerName,
      role,
    });

    console.log(`[Adventure] Joined: status=${response.adventure.status}, players=${response.adventure.playerCount}`);

    return {
      success: response.success,
      status: response.adventure.status,
      playerCount: response.adventure.playerCount,
    };
  }

  /**
   * Leave an adventure session
   */
  async leave(
    adventureId: string,
    playerId: string,
    playerName: string
  ): Promise<boolean> {
    console.log(`[Adventure] Player ${playerName} (${playerId}) leaving adventure ${adventureId}`);

    const client = getCoreClient();
    const response = await client.adventure.leave(adventureId, {
      playerId,
      playerName,
    });

    return response.success;
  }

  /**
   * Send an action (e.g., "opens the door")
   */
  async sendAction(
    adventureId: string,
    playerId: string,
    content: string
  ): Promise<SendMessageResult> {
    console.log(`[Adventure] Action from ${playerId}: ${content.slice(0, 50)}...`);

    const client = getCoreClient();
    const response = await client.adventure.sendAction(adventureId, {
      playerId,
      type: 'action',
      content,
    });

    return {
      success: response.success,
      message: response.message,
    };
  }

  /**
   * Say dialogue (e.g., "Hello there!")
   */
  async say(
    adventureId: string,
    playerId: string,
    content: string
  ): Promise<SendMessageResult> {
    console.log(`[Adventure] Say from ${playerId}: ${content.slice(0, 50)}...`);

    const client = getCoreClient();
    const response = await client.adventure.sendAction(adventureId, {
      playerId,
      type: 'say',
      content,
    });

    return {
      success: response.success,
      message: response.message,
    };
  }

  /**
   * Emote (e.g., "smiles warmly")
   */
  async emote(
    adventureId: string,
    playerId: string,
    content: string
  ): Promise<SendMessageResult> {
    console.log(`[Adventure] Emote from ${playerId}: ${content.slice(0, 50)}...`);

    const client = getCoreClient();
    const response = await client.adventure.sendAction(adventureId, {
      playerId,
      type: 'emote',
      content,
    });

    return {
      success: response.success,
      message: response.message,
    };
  }

  /**
   * Send narrative (DM/bot only)
   */
  async sendNarrative(
    adventureId: string,
    playerId: string,
    content: string
  ): Promise<SendMessageResult> {
    console.log(`[Adventure] Narrative from ${playerId}: ${content.slice(0, 50)}...`);

    const client = getCoreClient();
    const response = await client.adventure.sendNarrative(adventureId, {
      playerId,
      content,
    });

    return {
      success: response.success,
      message: response.message,
    };
  }

  /**
   * Get message history
   */
  async getHistory(
    adventureId: string,
    limit: number = 50,
    before?: string
  ): Promise<AdventureMessage[]> {
    const client = getCoreClient();
    const response = await client.adventure.getHistory(adventureId, limit, before);
    return response.messages;
  }

  /**
   * End an adventure session
   */
  async end(adventureId: string): Promise<boolean> {
    console.log(`[Adventure] Ending adventure ${adventureId}`);

    const client = getCoreClient();
    const response = await client.adventure.end(adventureId);

    console.log(`[Adventure] Ended: ${response.success}`);

    return response.success;
  }

  /**
   * Check if an adventure exists for a channel
   */
  async hasAdventure(guildId: string, channelId: string): Promise<boolean> {
    const adventure = await this.getByChannel(guildId, channelId);
    return adventure !== null && adventure.status !== 'ended';
  }

  /**
   * Join FumbleBot as a bot player
   */
  async joinAsBot(adventureId: string): Promise<boolean> {
    const result = await this.join(adventureId, 'fumblebot', 'FumbleBot', 'bot');
    return result.success;
  }
}

export default AdventureService.getInstance();
export { AdventureService };
export type {
  Adventure,
  AdventureSummary,
  AdventureMessage,
  AdventurePlayer,
  AdventureRole,
  AdventureStatus,
  AdventureMessageType,
};
