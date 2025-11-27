/**
 * Sound Service
 * Manages sound effect playback from RPG assets
 */

import { voiceClient } from './client.js';
import type { RpgSoundAsset, SoundEffectRequest } from './types.js';

/**
 * Sound Service for managing RPG asset playback
 */
export class SoundService {
  /**
   * Play a sound effect in a voice channel
   *
   * @param request Sound effect request with guild and asset info
   */
  async playSoundEffect(request: SoundEffectRequest): Promise<void> {
    const { guildId, assetUrl, volume = 0.5 } = request;

    // Check if bot is in voice channel
    if (!voiceClient.isConnected(guildId)) {
      throw new Error('Bot is not connected to a voice channel in this guild');
    }

    // TODO: Implement volume control
    // For now, just play at default volume

    // Play the audio
    await voiceClient.playUrl(guildId, assetUrl);
  }

  /**
   * Lookup RPG asset by ID or name
   *
   * TODO: Implement database lookup
   * - Query RpgAsset table
   * - Filter by tag="sound"
   * - Search by ID or name
   * - Return asset with URL
   */
  async lookupAsset(idOrName: string): Promise<RpgSoundAsset | null> {
    // STUB: Return null for now
    console.log(`[Sound] Looking up asset: ${idOrName}`);

    // TODO: Implement actual database query
    // const asset = await prisma.rpgAsset.findFirst({
    //   where: {
    //     OR: [
    //       { id: idOrName },
    //       { name: { contains: idOrName, mode: 'insensitive' } }
    //     ],
    //     tags: { has: 'sound' },
    //     deletedAt: null
    //   }
    // });
    //
    // if (!asset) return null;
    //
    // return {
    //   id: asset.id,
    //   name: asset.name,
    //   url: asset.url,
    //   assetType: determineAssetType(asset.tags),
    //   tags: asset.tags,
    //   duration: asset.metadata?.duration,
    //   volume: asset.metadata?.volume ?? 0.5
    // };

    return null;
  }

  /**
   * Search RPG assets by query
   *
   * TODO: Implement database search
   * - Full-text search on name and description
   * - Filter by tags
   * - Return matching assets
   */
  async searchAssets(query: string, limit = 25): Promise<RpgSoundAsset[]> {
    // STUB: Return example assets
    console.log(`[Sound] Searching assets: ${query}`);

    // TODO: Implement actual database query
    // const assets = await prisma.rpgAsset.findMany({
    //   where: {
    //     name: { contains: query, mode: 'insensitive' },
    //     tags: { has: 'sound' },
    //     deletedAt: null
    //   },
    //   take: limit,
    //   orderBy: { name: 'asc' }
    // });
    //
    // return assets.map(asset => ({
    //   id: asset.id,
    //   name: asset.name,
    //   url: asset.url,
    //   assetType: determineAssetType(asset.tags),
    //   tags: asset.tags,
    //   duration: asset.metadata?.duration,
    //   volume: asset.metadata?.volume ?? 0.5
    // }));

    return [
      {
        id: 'asset-sword-swing',
        name: 'Sword Swing',
        url: 'https://example.com/sounds/sword-swing.mp3',
        assetType: 'sound',
        tags: ['sound', 'combat', 'melee'],
        duration: 1.5,
        volume: 0.7,
      },
      {
        id: 'asset-magic-cast',
        name: 'Magic Spell Cast',
        url: 'https://example.com/sounds/magic-cast.mp3',
        assetType: 'sound',
        tags: ['sound', 'magic', 'spell'],
        duration: 2.0,
        volume: 0.6,
      },
    ];
  }

  /**
   * Get random sound effect by tag
   *
   * TODO: Implement random selection from database
   */
  async getRandomSound(tag: string): Promise<RpgSoundAsset | null> {
    // STUB: Return null
    console.log(`[Sound] Getting random sound with tag: ${tag}`);

    // TODO: Implement actual database query
    // const count = await prisma.rpgAsset.count({
    //   where: {
    //     tags: { has: tag },
    //     deletedAt: null
    //   }
    // });
    //
    // if (count === 0) return null;
    //
    // const skip = Math.floor(Math.random() * count);
    // const asset = await prisma.rpgAsset.findFirst({
    //   where: {
    //     tags: { has: tag },
    //     deletedAt: null
    //   },
    //   skip
    // });
    //
    // if (!asset) return null;
    //
    // return {
    //   id: asset.id,
    //   name: asset.name,
    //   url: asset.url,
    //   assetType: determineAssetType(asset.tags),
    //   tags: asset.tags,
    //   duration: asset.metadata?.duration,
    //   volume: asset.metadata?.volume ?? 0.5
    // };

    return null;
  }
}

/**
 * Determine asset type from tags
 */
function determineAssetType(tags: string[]): 'sound' | 'music' | 'ambient' {
  if (tags.includes('music')) return 'music';
  if (tags.includes('ambient')) return 'ambient';
  return 'sound';
}

// Singleton instance
export const soundService = new SoundService();
