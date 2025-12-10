/**
 * Terminal Output Formatter Tests
 * Tests for Discord embed formatting of terminal output
 */

import { describe, it, expect } from 'vitest';
import {
  formatTerminalOutput,
  formatTerminalStatus,
  formatSessionList,
} from '../../../../src/services/terminal/output-formatter.js';
import type { TerminalExecResult, TerminalSession } from '../../../../src/services/terminal/terminal-service.js';

describe('Terminal Output Formatter', () => {
  describe('formatTerminalOutput', () => {
    it('should format successful command output', () => {
      const result: TerminalExecResult = {
        success: true,
        stdout: 'Hello, World!',
        stderr: '',
        exitCode: 0,
        executionTime: 100,
      };

      const embed = formatTerminalOutput(result);

      expect(embed.data.color).toBe(0x57F287); // Green
      expect(embed.data.description).toContain('Hello, World!');
      expect(embed.data.footer?.text).toContain('Exit: 0');
      expect(embed.data.footer?.text).toContain('100ms');
    });

    it('should format failed command output in red', () => {
      const result: TerminalExecResult = {
        success: false,
        stdout: '',
        stderr: 'Command not found',
        exitCode: 127,
        executionTime: 50,
      };

      const embed = formatTerminalOutput(result);

      expect(embed.data.color).toBe(0xED4245); // Red
      expect(embed.data.footer?.text).toContain('Exit: 127');
    });

    it('should include stderr as a field', () => {
      const result: TerminalExecResult = {
        success: false,
        stdout: 'Some output',
        stderr: 'Error: something went wrong',
        exitCode: 1,
      };

      const embed = formatTerminalOutput(result);

      const errorField = embed.data.fields?.find((f) => f.name === 'Errors');
      expect(errorField).toBeDefined();
      expect(errorField?.value).toContain('something went wrong');
    });

    it('should show "No output" when both stdout and stderr are empty', () => {
      const result: TerminalExecResult = {
        success: true,
        stdout: '',
        stderr: '',
        exitCode: 0,
      };

      const embed = formatTerminalOutput(result);

      expect(embed.data.description).toBe('*No output*');
    });

    it('should truncate long output', () => {
      const longOutput = 'x'.repeat(5000);
      const result: TerminalExecResult = {
        success: true,
        stdout: longOutput,
        stderr: '',
        exitCode: 0,
      };

      const embed = formatTerminalOutput(result);

      expect(embed.data.description?.length).toBeLessThan(5000);
      expect(embed.data.description).toContain('...');
    });

    it('should wrap output in code block', () => {
      const result: TerminalExecResult = {
        success: true,
        stdout: 'ls output',
        stderr: '',
        exitCode: 0,
      };

      const embed = formatTerminalOutput(result);

      expect(embed.data.description).toContain('```');
      expect(embed.data.description).toContain('ls output');
    });

    it('should handle missing executionTime', () => {
      const result: TerminalExecResult = {
        success: true,
        stdout: 'output',
        stderr: '',
        exitCode: 0,
        executionTime: undefined,
      };

      const embed = formatTerminalOutput(result);

      expect(embed.data.footer?.text).toBe('Exit: 0');
      expect(embed.data.footer?.text).not.toContain('ms');
    });
  });

  describe('formatTerminalStatus', () => {
    it('should show inactive status when no session', () => {
      const embed = formatTerminalStatus(null);

      expect(embed.data.color).toBe(0x95A5A6); // Gray
      expect(embed.data.description).toContain('No terminal session');
      expect(embed.data.fields?.some((f) => f.value.includes('/adventure start'))).toBe(true);
    });

    it('should show active status with session info', () => {
      const session: TerminalSession = {
        containerId: 'abc123def456',
        guildId: '123456',
        channelId: '789012',
        startedBy: '111222333',
        startedAt: new Date(),
        status: 'running',
      };

      const embed = formatTerminalStatus(session);

      expect(embed.data.color).toBe(0x57F287); // Green
      expect(embed.data.fields?.some((f) => f.value.includes('abc123def456'))).toBe(true);
      expect(embed.data.fields?.some((f) => f.value.includes('<@111222333>'))).toBe(true);
    });

    it('should include uptime when provided from core', () => {
      const session: TerminalSession = {
        containerId: 'abc123',
        guildId: '123',
        channelId: '456',
        startedBy: '789',
        startedAt: new Date(),
        status: 'running',
      };

      const coreStatus = {
        exists: true,
        status: 'running',
        uptime: 125, // 2m 5s
      };

      const embed = formatTerminalStatus(session, coreStatus);

      expect(embed.data.fields?.some((f) => f.name === 'Uptime')).toBe(true);
      expect(embed.data.fields?.find((f) => f.name === 'Uptime')?.value).toContain('2m 5s');
    });

    it('should show seconds only when uptime < 60', () => {
      const session: TerminalSession = {
        containerId: 'abc123',
        guildId: '123',
        channelId: '456',
        startedBy: '789',
        startedAt: new Date(),
        status: 'running',
      };

      const coreStatus = {
        exists: true,
        status: 'running',
        uptime: 45,
      };

      const embed = formatTerminalStatus(session, coreStatus);

      expect(embed.data.fields?.find((f) => f.name === 'Uptime')?.value).toBe('45s');
    });
  });

  describe('formatSessionList', () => {
    it('should show empty message when no sessions', () => {
      const embed = formatSessionList([]);

      expect(embed.data.description).toContain('No active terminal sessions');
    });

    it('should list sessions with channel and user info', () => {
      const sessions: TerminalSession[] = [
        {
          containerId: 'abc123',
          guildId: '123456',
          channelId: '789012',
          startedBy: '111222',
          startedAt: new Date(),
          status: 'running',
        },
        {
          containerId: 'def456',
          guildId: '123456',
          channelId: '345678',
          startedBy: '333444',
          startedAt: new Date(),
          status: 'running',
        },
      ];

      const embed = formatSessionList(sessions);

      expect(embed.data.description).toContain('<#789012>');
      expect(embed.data.description).toContain('<#345678>');
      expect(embed.data.description).toContain('<@111222>');
      expect(embed.data.description).toContain('<@333444>');
      expect(embed.data.footer?.text).toContain('2 active sessions');
    });

    it('should use singular form for one session', () => {
      const sessions: TerminalSession[] = [
        {
          containerId: 'abc123',
          guildId: '123456',
          channelId: '789012',
          startedBy: '111222',
          startedAt: new Date(),
          status: 'running',
        },
      ];

      const embed = formatSessionList(sessions);

      expect(embed.data.footer?.text).toBe('1 active session');
    });

    it('should number sessions in order', () => {
      const sessions: TerminalSession[] = [
        {
          containerId: 'abc',
          guildId: '123',
          channelId: '111',
          startedBy: '999',
          startedAt: new Date(),
          status: 'running',
        },
        {
          containerId: 'def',
          guildId: '123',
          channelId: '222',
          startedBy: '999',
          startedAt: new Date(),
          status: 'running',
        },
      ];

      const embed = formatSessionList(sessions);

      expect(embed.data.description).toContain('1. ');
      expect(embed.data.description).toContain('2. ');
    });
  });
});

// =============================================================================
// Adventure Formatter Tests
// =============================================================================

import {
  formatAdventureMessage,
  formatAdventureStatus,
  formatAdventureHistory,
} from '../../../../src/services/terminal/output-formatter.js';
import type {
  Adventure,
  AdventureMessage,
} from '../../../../src/services/terminal/adventure-service.js';

describe('Adventure Output Formatter', () => {
  describe('formatAdventureMessage', () => {
    it('should format action message with asterisks', () => {
      const message: AdventureMessage = {
        id: 'msg-1',
        adventureId: 'adv-1',
        playerId: 'user1',
        playerName: 'Aragorn',
        type: 'action',
        content: 'draws his sword',
        createdAt: new Date().toISOString(),
      };

      const result = formatAdventureMessage(message);

      expect(result).toBe('*Aragorn draws his sword*');
    });

    it('should format say message with quotes', () => {
      const message: AdventureMessage = {
        id: 'msg-2',
        adventureId: 'adv-1',
        playerId: 'user1',
        playerName: 'Gandalf',
        type: 'say',
        content: 'You shall not pass!',
        createdAt: new Date().toISOString(),
      };

      const result = formatAdventureMessage(message);

      expect(result).toBe('**Gandalf:** "You shall not pass!"');
    });

    it('should format emote message with asterisks', () => {
      const message: AdventureMessage = {
        id: 'msg-3',
        adventureId: 'adv-1',
        playerId: 'user1',
        playerName: 'Legolas',
        type: 'emote',
        content: 'smiles knowingly',
        createdAt: new Date().toISOString(),
      };

      const result = formatAdventureMessage(message);

      expect(result).toBe('*Legolas smiles knowingly*');
    });

    it('should format narrative message with blockquote', () => {
      const message: AdventureMessage = {
        id: 'msg-4',
        adventureId: 'adv-1',
        playerId: 'dm1',
        playerName: 'DM',
        type: 'narrative',
        content: 'A cold wind sweeps through the chamber...',
        createdAt: new Date().toISOString(),
      };

      const result = formatAdventureMessage(message);

      expect(result).toBe('> A cold wind sweeps through the chamber...');
    });

    it('should format system message with brackets', () => {
      const message: AdventureMessage = {
        id: 'msg-5',
        adventureId: 'adv-1',
        playerId: 'system',
        playerName: 'System',
        type: 'system',
        content: 'Player1 has joined the adventure',
        createdAt: new Date().toISOString(),
      };

      const result = formatAdventureMessage(message);

      expect(result).toBe('[Player1 has joined the adventure]');
    });
  });

  describe('formatAdventureStatus', () => {
    it('should show inactive status when no adventure', () => {
      const embed = formatAdventureStatus(null);

      expect(embed.data.color).toBe(0x95A5A6); // Gray
      expect(embed.data.title).toBe('Adventure Status');
      expect(embed.data.description).toContain('No adventure session');
      expect(embed.data.fields?.some((f) => f.value.includes('/adventure create'))).toBe(true);
    });

    it('should show active adventure with green color', () => {
      const adventure: Adventure = {
        id: 'adv-123',
        guildId: 'guild1',
        channelId: 'channel1',
        name: 'The Dark Dungeon',
        description: 'A perilous journey into darkness',
        status: 'active',
        players: [
          { playerId: 'user1', name: 'Aragorn', role: 'player', joinedAt: new Date().toISOString() },
          { playerId: 'user2', name: 'Gandalf', role: 'dm', joinedAt: new Date().toISOString() },
        ],
        playerCount: 2,
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
      };

      const embed = formatAdventureStatus(adventure);

      expect(embed.data.color).toBe(0x57F287); // Green for active
      expect(embed.data.title).toBe('The Dark Dungeon');
      expect(embed.data.description).toBe('A perilous journey into darkness');
      expect(embed.data.fields?.some((f) => f.name === 'Status' && f.value === 'Active')).toBe(true);
      expect(embed.data.fields?.some((f) => f.name === 'Players (2)' && f.value.includes('Gandalf **DM**'))).toBe(true);
      expect(embed.data.footer?.text).toContain('adv-123');
    });

    it('should show waiting adventure with yellow color', () => {
      const adventure: Adventure = {
        id: 'adv-124',
        guildId: 'guild1',
        channelId: 'channel1',
        name: 'Waiting Quest',
        status: 'waiting',
        players: [],
        playerCount: 0,
        createdAt: new Date().toISOString(),
      };

      const embed = formatAdventureStatus(adventure);

      expect(embed.data.color).toBe(0xFEE75C); // Yellow for waiting
      expect(embed.data.fields?.some((f) => f.name === 'Status' && f.value === 'Waiting')).toBe(true);
    });

    it('should show paused adventure with pink color', () => {
      const adventure: Adventure = {
        id: 'adv-125',
        guildId: 'guild1',
        channelId: 'channel1',
        name: 'Paused Quest',
        status: 'paused',
        players: [],
        playerCount: 1,
        createdAt: new Date().toISOString(),
      };

      const embed = formatAdventureStatus(adventure);

      expect(embed.data.color).toBe(0xEB459E); // Pink for paused
    });

    it('should show ended adventure with gray color', () => {
      const adventure: Adventure = {
        id: 'adv-126',
        guildId: 'guild1',
        channelId: 'channel1',
        name: 'Finished Quest',
        status: 'ended',
        players: [],
        playerCount: 0,
        createdAt: new Date().toISOString(),
      };

      const embed = formatAdventureStatus(adventure);

      expect(embed.data.color).toBe(0x95A5A6); // Gray for ended
    });

    it('should show player count when no player details', () => {
      const adventure: Adventure = {
        id: 'adv-127',
        guildId: 'guild1',
        channelId: 'channel1',
        name: 'Quest',
        status: 'active',
        players: [],
        playerCount: 3,
        createdAt: new Date().toISOString(),
      };

      const embed = formatAdventureStatus(adventure);

      expect(embed.data.fields?.some((f) => f.name === 'Players' && f.value === '3 players')).toBe(true);
    });

    it('should use singular form for 1 player', () => {
      const adventure: Adventure = {
        id: 'adv-128',
        guildId: 'guild1',
        channelId: 'channel1',
        name: 'Solo Quest',
        status: 'active',
        players: [],
        playerCount: 1,
        createdAt: new Date().toISOString(),
      };

      const embed = formatAdventureStatus(adventure);

      expect(embed.data.fields?.some((f) => f.name === 'Players' && f.value === '1 player')).toBe(true);
    });

    it('should show created time when not started', () => {
      const createdAt = new Date('2025-01-15T10:00:00Z');
      const adventure: Adventure = {
        id: 'adv-129',
        guildId: 'guild1',
        channelId: 'channel1',
        name: 'New Quest',
        status: 'waiting',
        players: [],
        playerCount: 0,
        createdAt: createdAt.toISOString(),
      };

      const embed = formatAdventureStatus(adventure);

      expect(embed.data.fields?.some((f) => f.name === 'Created')).toBe(true);
    });

    it('should show started time when adventure has started', () => {
      const startedAt = new Date('2025-01-15T12:00:00Z');
      const adventure: Adventure = {
        id: 'adv-130',
        guildId: 'guild1',
        channelId: 'channel1',
        name: 'Started Quest',
        status: 'active',
        players: [],
        playerCount: 0,
        createdAt: new Date().toISOString(),
        startedAt: startedAt.toISOString(),
      };

      const embed = formatAdventureStatus(adventure);

      expect(embed.data.fields?.some((f) => f.name === 'Started')).toBe(true);
    });

    it('should show history count when available', () => {
      const adventure: Adventure = {
        id: 'adv-131',
        guildId: 'guild1',
        channelId: 'channel1',
        name: 'Quest with History',
        status: 'active',
        players: [],
        playerCount: 0,
        createdAt: new Date().toISOString(),
        historyCount: 42,
      };

      const embed = formatAdventureStatus(adventure);

      expect(embed.data.fields?.some((f) => f.name === 'Messages' && f.value === '42')).toBe(true);
    });

    it('should identify bot players', () => {
      const adventure: Adventure = {
        id: 'adv-132',
        guildId: 'guild1',
        channelId: 'channel1',
        name: 'Quest with Bot',
        status: 'active',
        players: [
          { playerId: 'fumblebot', name: 'FumbleBot', role: 'bot', joinedAt: new Date().toISOString() },
        ],
        playerCount: 1,
        createdAt: new Date().toISOString(),
      };

      const embed = formatAdventureStatus(adventure);

      expect(embed.data.fields?.some((f) => f.name === 'Players (1)' && f.value.includes('FumbleBot **Bot**'))).toBe(true);
    });
  });

  describe('formatAdventureHistory', () => {
    const adventure: Adventure = {
      id: 'adv-100',
      guildId: 'guild1',
      channelId: 'channel1',
      name: 'History Quest',
      status: 'active',
      players: [],
      playerCount: 0,
      createdAt: new Date().toISOString(),
    };

    it('should show empty message when no history', () => {
      const embed = formatAdventureHistory(adventure, []);

      expect(embed.data.title).toBe('History Quest - Recent History');
      expect(embed.data.description).toBe('*No messages yet. Start your adventure!*');
    });

    it('should format history messages', () => {
      const messages: AdventureMessage[] = [
        {
          id: 'msg-1',
          adventureId: 'adv-100',
          playerId: 'user1',
          playerName: 'Aragorn',
          type: 'action',
          content: 'enters the room',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'msg-2',
          adventureId: 'adv-100',
          playerId: 'user1',
          playerName: 'Aragorn',
          type: 'say',
          content: 'Hello?',
          createdAt: new Date().toISOString(),
        },
      ];

      const embed = formatAdventureHistory(adventure, messages);

      expect(embed.data.description).toContain('*Aragorn enters the room*');
      expect(embed.data.description).toContain('**Aragorn:** "Hello?"');
      expect(embed.data.footer?.text).toBe('2 total messages');
    });

    it('should limit to last 15 messages', () => {
      const messages: AdventureMessage[] = [];
      for (let i = 0; i < 20; i++) {
        messages.push({
          id: `msg-${i}`,
          adventureId: 'adv-100',
          playerId: 'user1',
          playerName: 'Player',
          type: 'say',
          content: `Message ${i}`,
          createdAt: new Date().toISOString(),
        });
      }

      const embed = formatAdventureHistory(adventure, messages);

      // Should show messages 5-19 (last 15)
      expect(embed.data.description).not.toContain('Message 4');
      expect(embed.data.description).toContain('Message 19');
      expect(embed.data.footer?.text).toBe('20 total messages');
    });

    it('should use adventure status color', () => {
      const embed = formatAdventureHistory(adventure, []);

      expect(embed.data.color).toBe(0x57F287); // Green for active
    });
  });
});
