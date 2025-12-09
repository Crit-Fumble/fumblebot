/**
 * Character Cache Tests
 *
 * Tests for the in-memory active character cache.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Character } from '@crit-fumble/core/types/campaign';
import CharacterCache from './character-cache.js';

describe('CharacterCache', () => {
  // Mock character data
  const mockCharacter: Character = {
    id: 'char_123',
    campaignId: 'camp_456',
    name: 'Gandalf',
    type: 'pc',
    avatarUrl: 'https://example.com/gandalf.png',
    ownerId: 'user_789',
    foundryActorId: null,
    lastSyncedAt: null,
    sheetData: {},
    isActive: true,
    isRetired: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    // Clear cache before each test
    CharacterCache.clearAll();
  });

  afterEach(() => {
    // Restore real timers
    vi.useRealTimers();
  });

  describe('set and get', () => {
    it('should store and retrieve active character', () => {
      CharacterCache.set({
        userId: 'user_123',
        channelId: 'channel_456',
        campaignId: 'camp_789',
        characterId: 'char_123',
        character: mockCharacter,
      });

      const entry = CharacterCache.get({
        userId: 'user_123',
        channelId: 'channel_456',
      });

      expect(entry).toBeDefined();
      expect(entry?.characterId).toBe('char_123');
      expect(entry?.character.name).toBe('Gandalf');
    });

    it('should return null for non-existent entry', () => {
      const entry = CharacterCache.get({
        userId: 'nonexistent',
        channelId: 'nonexistent',
      });

      expect(entry).toBeNull();
    });

    it('should use different keys for different channels', () => {
      CharacterCache.set({
        userId: 'user_123',
        channelId: 'channel_1',
        campaignId: 'camp_789',
        characterId: 'char_1',
        character: mockCharacter,
      });

      CharacterCache.set({
        userId: 'user_123',
        channelId: 'channel_2',
        campaignId: 'camp_789',
        characterId: 'char_2',
        character: { ...mockCharacter, id: 'char_2', name: 'Frodo' },
      });

      const entry1 = CharacterCache.get({ userId: 'user_123', channelId: 'channel_1' });
      const entry2 = CharacterCache.get({ userId: 'user_123', channelId: 'channel_2' });

      expect(entry1?.characterId).toBe('char_1');
      expect(entry2?.characterId).toBe('char_2');
      expect(entry2?.character.name).toBe('Frodo');
    });

    it('should overwrite existing entry for same user/channel', () => {
      CharacterCache.set({
        userId: 'user_123',
        channelId: 'channel_456',
        campaignId: 'camp_789',
        characterId: 'char_1',
        character: mockCharacter,
      });

      CharacterCache.set({
        userId: 'user_123',
        channelId: 'channel_456',
        campaignId: 'camp_789',
        characterId: 'char_2',
        character: { ...mockCharacter, id: 'char_2', name: 'Aragorn' },
      });

      const entry = CharacterCache.get({ userId: 'user_123', channelId: 'channel_456' });

      expect(entry?.characterId).toBe('char_2');
      expect(entry?.character.name).toBe('Aragorn');
    });
  });

  describe('expiration', () => {
    it('should set expiration 24h in future by default', () => {
      const now = new Date('2024-01-01T12:00:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(now);

      CharacterCache.set({
        userId: 'user_123',
        channelId: 'channel_456',
        campaignId: 'camp_789',
        characterId: 'char_123',
        character: mockCharacter,
      });

      const entry = CharacterCache.get({
        userId: 'user_123',
        channelId: 'channel_456',
        refreshIfStale: false,
      });

      expect(entry?.expiresAt.getTime()).toBe(
        now.getTime() + 24 * 60 * 60 * 1000
      );
    });

    it('should respect custom TTL', () => {
      const now = new Date('2024-01-01T12:00:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(now);

      const customTTL = 60 * 60 * 1000; // 1 hour

      CharacterCache.set({
        userId: 'user_123',
        channelId: 'channel_456',
        campaignId: 'camp_789',
        characterId: 'char_123',
        character: mockCharacter,
        ttl: customTTL,
      });

      const entry = CharacterCache.get({
        userId: 'user_123',
        channelId: 'channel_456',
        refreshIfStale: false,
      });

      expect(entry?.expiresAt.getTime()).toBe(now.getTime() + customTTL);
    });

    it('should return null for expired entry when refreshIfStale=true', () => {
      const now = new Date('2024-01-01T12:00:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(now);

      CharacterCache.set({
        userId: 'user_123',
        channelId: 'channel_456',
        campaignId: 'camp_789',
        characterId: 'char_123',
        character: mockCharacter,
        ttl: 60 * 1000, // 1 minute
      });

      // Advance time past expiration
      vi.setSystemTime(new Date('2024-01-01T12:02:00Z'));

      const entry = CharacterCache.get({
        userId: 'user_123',
        channelId: 'channel_456',
        refreshIfStale: true,
      });

      expect(entry).toBeNull();
    });

    it('should return expired entry when refreshIfStale=false', () => {
      const now = new Date('2024-01-01T12:00:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(now);

      CharacterCache.set({
        userId: 'user_123',
        channelId: 'channel_456',
        campaignId: 'camp_789',
        characterId: 'char_123',
        character: mockCharacter,
        ttl: 60 * 1000, // 1 minute
      });

      // Advance time past expiration
      vi.setSystemTime(new Date('2024-01-01T12:02:00Z'));

      const entry = CharacterCache.get({
        userId: 'user_123',
        channelId: 'channel_456',
        refreshIfStale: false,
      });

      expect(entry).toBeDefined();
      expect(entry?.characterId).toBe('char_123');
    });
  });

  describe('clear operations', () => {
    beforeEach(() => {
      // Set up multiple cache entries
      CharacterCache.set({
        userId: 'user_1',
        channelId: 'channel_1',
        campaignId: 'camp_1',
        characterId: 'char_1',
        character: mockCharacter,
      });

      CharacterCache.set({
        userId: 'user_1',
        channelId: 'channel_2',
        campaignId: 'camp_1',
        characterId: 'char_2',
        character: { ...mockCharacter, id: 'char_2' },
      });

      CharacterCache.set({
        userId: 'user_2',
        channelId: 'channel_1',
        campaignId: 'camp_2',
        characterId: 'char_3',
        character: { ...mockCharacter, id: 'char_3' },
      });
    });

    it('should clear specific user/channel entry', () => {
      CharacterCache.clear({ userId: 'user_1', channelId: 'channel_1' });

      const entry1 = CharacterCache.get({ userId: 'user_1', channelId: 'channel_1' });
      const entry2 = CharacterCache.get({ userId: 'user_1', channelId: 'channel_2' });
      const entry3 = CharacterCache.get({ userId: 'user_2', channelId: 'channel_1' });

      expect(entry1).toBeNull();
      expect(entry2).toBeDefined();
      expect(entry3).toBeDefined();
    });

    it('should clear all entries for a user', () => {
      CharacterCache.clearUser('user_1');

      const entry1 = CharacterCache.get({ userId: 'user_1', channelId: 'channel_1' });
      const entry2 = CharacterCache.get({ userId: 'user_1', channelId: 'channel_2' });
      const entry3 = CharacterCache.get({ userId: 'user_2', channelId: 'channel_1' });

      expect(entry1).toBeNull();
      expect(entry2).toBeNull();
      expect(entry3).toBeDefined();
    });

    it('should clear all entries for a channel', () => {
      CharacterCache.clearChannel('channel_1');

      const entry1 = CharacterCache.get({ userId: 'user_1', channelId: 'channel_1' });
      const entry2 = CharacterCache.get({ userId: 'user_1', channelId: 'channel_2' });
      const entry3 = CharacterCache.get({ userId: 'user_2', channelId: 'channel_1' });

      expect(entry1).toBeNull();
      expect(entry2).toBeDefined();
      expect(entry3).toBeNull();
    });

    it('should clear all entries for a campaign', () => {
      CharacterCache.clearCampaign('camp_1');

      const entry1 = CharacterCache.get({ userId: 'user_1', channelId: 'channel_1' });
      const entry2 = CharacterCache.get({ userId: 'user_1', channelId: 'channel_2' });
      const entry3 = CharacterCache.get({ userId: 'user_2', channelId: 'channel_1' });

      expect(entry1).toBeNull();
      expect(entry2).toBeNull();
      expect(entry3).toBeDefined();
    });

    it('should clear all entries', () => {
      CharacterCache.clearAll();

      const entry1 = CharacterCache.get({ userId: 'user_1', channelId: 'channel_1' });
      const entry2 = CharacterCache.get({ userId: 'user_1', channelId: 'channel_2' });
      const entry3 = CharacterCache.get({ userId: 'user_2', channelId: 'channel_1' });

      expect(entry1).toBeNull();
      expect(entry2).toBeNull();
      expect(entry3).toBeNull();
    });
  });

  describe('getUserCharacters', () => {
    it('should return all active characters for a user', () => {
      CharacterCache.set({
        userId: 'user_123',
        channelId: 'channel_1',
        campaignId: 'camp_1',
        characterId: 'char_1',
        character: mockCharacter,
      });

      CharacterCache.set({
        userId: 'user_123',
        channelId: 'channel_2',
        campaignId: 'camp_1',
        characterId: 'char_2',
        character: { ...mockCharacter, id: 'char_2' },
      });

      CharacterCache.set({
        userId: 'user_456',
        channelId: 'channel_1',
        campaignId: 'camp_2',
        characterId: 'char_3',
        character: { ...mockCharacter, id: 'char_3' },
      });

      const userChars = CharacterCache.getUserCharacters('user_123');

      expect(userChars).toHaveLength(2);
      expect(userChars.map((e) => e.characterId).sort()).toEqual(['char_1', 'char_2']);
    });

    it('should exclude expired entries', () => {
      const now = new Date('2024-01-01T12:00:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(now);

      CharacterCache.set({
        userId: 'user_123',
        channelId: 'channel_1',
        campaignId: 'camp_1',
        characterId: 'char_1',
        character: mockCharacter,
        ttl: 60 * 1000, // 1 minute
      });

      CharacterCache.set({
        userId: 'user_123',
        channelId: 'channel_2',
        campaignId: 'camp_1',
        characterId: 'char_2',
        character: { ...mockCharacter, id: 'char_2' },
        ttl: 120 * 1000, // 2 minutes
      });

      // Advance time to expire first entry
      vi.setSystemTime(new Date('2024-01-01T12:01:30Z'));

      const userChars = CharacterCache.getUserCharacters('user_123');

      expect(userChars).toHaveLength(1);
      expect(userChars[0].characterId).toBe('char_2');
    });

    it('should return empty array for user with no characters', () => {
      const userChars = CharacterCache.getUserCharacters('nonexistent');

      expect(userChars).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      CharacterCache.set({
        userId: 'user_1',
        channelId: 'channel_1',
        campaignId: 'camp_1',
        characterId: 'char_1',
        character: mockCharacter,
      });

      CharacterCache.set({
        userId: 'user_2',
        channelId: 'channel_2',
        campaignId: 'camp_1',
        characterId: 'char_2',
        character: { ...mockCharacter, id: 'char_2' },
      });

      const stats = CharacterCache.getStats();

      expect(stats.total).toBe(2);
      expect(stats.active).toBe(2);
      expect(stats.expired).toBe(0);
    });

    it('should count expired entries', () => {
      const now = new Date('2024-01-01T12:00:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(now);

      CharacterCache.set({
        userId: 'user_1',
        channelId: 'channel_1',
        campaignId: 'camp_1',
        characterId: 'char_1',
        character: mockCharacter,
        ttl: 60 * 1000, // 1 minute
      });

      CharacterCache.set({
        userId: 'user_2',
        channelId: 'channel_2',
        campaignId: 'camp_1',
        characterId: 'char_2',
        character: { ...mockCharacter, id: 'char_2' },
        ttl: 120 * 1000, // 2 minutes
      });

      // Advance time to expire first entry
      vi.setSystemTime(new Date('2024-01-01T12:01:30Z'));

      const stats = CharacterCache.getStats();

      expect(stats.total).toBe(2);
      expect(stats.active).toBe(1);
      expect(stats.expired).toBe(1);
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries', () => {
      const now = new Date('2024-01-01T12:00:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(now);

      CharacterCache.set({
        userId: 'user_1',
        channelId: 'channel_1',
        campaignId: 'camp_1',
        characterId: 'char_1',
        character: mockCharacter,
        ttl: 60 * 1000, // 1 minute
      });

      CharacterCache.set({
        userId: 'user_2',
        channelId: 'channel_2',
        campaignId: 'camp_1',
        characterId: 'char_2',
        character: { ...mockCharacter, id: 'char_2' },
        ttl: 120 * 1000, // 2 minutes
      });

      // Advance time to expire first entry
      vi.setSystemTime(new Date('2024-01-01T12:01:30Z'));

      const removed = CharacterCache.cleanup();

      expect(removed).toBe(1);

      const stats = CharacterCache.getStats();
      expect(stats.total).toBe(1);
      expect(stats.active).toBe(1);
    });

    it('should return 0 when no expired entries', () => {
      CharacterCache.set({
        userId: 'user_1',
        channelId: 'channel_1',
        campaignId: 'camp_1',
        characterId: 'char_1',
        character: mockCharacter,
      });

      const removed = CharacterCache.cleanup();

      expect(removed).toBe(0);
    });
  });
});
