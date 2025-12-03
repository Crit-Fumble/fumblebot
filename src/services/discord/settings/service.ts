/**
 * User Settings Service
 * Manages user preferences stored in local database
 * Will migrate to Core once user settings API is available
 */

import { prisma } from '../../db/index.js';

/**
 * User settings interface
 */
export interface UserSettings {
  userId: string;
  defaultVoice: string;
  defaultGameSystem: string;
  worldAnvil?: {
    connected: boolean;
    username?: string;
    defaultWorldId?: string;
    defaultWorldName?: string;
  };
  notifications: {
    sessionReminders: boolean;
    transcriptReady: boolean;
  };
}

/**
 * Get user settings from database
 */
export async function getUserSettings(discordId: string): Promise<UserSettings> {
  try {
    const settings = await prisma.userSettings.findUnique({
      where: { discordId },
    });

    if (!settings) {
      // Return defaults
      return {
        userId: discordId,
        defaultVoice: 'orion',
        defaultGameSystem: '5e',
        notifications: {
          sessionReminders: true,
          transcriptReady: true,
        },
      };
    }

    return {
      userId: discordId,
      defaultVoice: settings.defaultVoice,
      defaultGameSystem: settings.defaultGameSystem,
      worldAnvil: settings.worldAnvilConnected
        ? {
            connected: true,
            username: settings.worldAnvilUsername || undefined,
            defaultWorldId: settings.worldAnvilDefaultWorld || undefined,
            defaultWorldName: settings.worldAnvilWorldName || undefined,
          }
        : undefined,
      notifications: {
        sessionReminders: settings.notifySessionReminders,
        transcriptReady: settings.notifyTranscriptReady,
      },
    };
  } catch (error) {
    console.error('[Settings] Failed to get settings:', error);
    // Return defaults on error
    return {
      userId: discordId,
      defaultVoice: 'orion',
      defaultGameSystem: '5e',
      notifications: {
        sessionReminders: true,
        transcriptReady: true,
      },
    };
  }
}

/**
 * Save user settings to database
 */
export async function saveUserSettings(
  discordId: string,
  updates: Partial<UserSettings>
): Promise<void> {
  try {
    // Build update data
    const data: Record<string, unknown> = {};

    if (updates.defaultVoice !== undefined) {
      data.defaultVoice = updates.defaultVoice;
    }

    if (updates.defaultGameSystem !== undefined) {
      data.defaultGameSystem = updates.defaultGameSystem;
    }

    if (updates.worldAnvil !== undefined) {
      data.worldAnvilConnected = updates.worldAnvil.connected;
      data.worldAnvilUsername = updates.worldAnvil.username || null;
      data.worldAnvilDefaultWorld = updates.worldAnvil.defaultWorldId || null;
      data.worldAnvilWorldName = updates.worldAnvil.defaultWorldName || null;
    }

    if (updates.notifications !== undefined) {
      data.notifySessionReminders = updates.notifications.sessionReminders;
      data.notifyTranscriptReady = updates.notifications.transcriptReady;
    }

    await prisma.userSettings.upsert({
      where: { discordId },
      update: data,
      create: {
        discordId,
        ...data,
      },
    });
  } catch (error) {
    console.error('[Settings] Failed to save settings:', error);
    throw new Error('Failed to save settings. Please try again.');
  }
}

/**
 * Disconnect World Anvil for a user
 */
export async function disconnectWorldAnvil(discordId: string): Promise<void> {
  try {
    await prisma.userSettings.update({
      where: { discordId },
      data: {
        worldAnvilConnected: false,
        worldAnvilUsername: null,
        worldAnvilDefaultWorld: null,
        worldAnvilWorldName: null,
      },
    });
  } catch (error) {
    console.error('[Settings] Failed to disconnect World Anvil:', error);
    throw new Error('Failed to disconnect World Anvil. Please try again.');
  }
}
