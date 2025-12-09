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
