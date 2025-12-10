/**
 * Command Registry Tests
 * Tests for the command registry that manages Discord slash commands
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SlashCommandBuilder } from 'discord.js';

// Create hoisted mocks for command modules - must include createMockCommand here
const {
  mockDiceHandler,
  mockVoiceHandler,
  mockSettingsHandler,
  mockCharacterHandler,
  mockIcHandler,
  mockTimestampHandler,
  mockAiGenerateHandler,
  mockEventHandler,
  mockAudioHandler,
  mockAdventureHandler,
  mockHelpHandler,
  createMockCommand,
} = vi.hoisted(() => {
  // Import inside hoisted to ensure it's available for vi.mock
  const { SlashCommandBuilder } = require('discord.js');

  const createMockCommand = (name: string) => {
    return new SlashCommandBuilder().setName(name).setDescription(`${name} command`);
  };

  return {
    mockDiceHandler: vi.fn(),
    mockVoiceHandler: vi.fn(),
    mockSettingsHandler: vi.fn(),
    mockCharacterHandler: vi.fn(),
    mockIcHandler: vi.fn(),
    mockTimestampHandler: vi.fn(),
    mockAiGenerateHandler: vi.fn(),
    mockEventHandler: vi.fn(),
    mockAudioHandler: vi.fn(),
    mockAdventureHandler: vi.fn(),
    mockHelpHandler: vi.fn(),
    createMockCommand,
  };
});

// Mock command modules
vi.mock('../../../../../src/services/discord/commands/slash/dice.js', () => ({
  diceCommands: [createMockCommand('roll')],
  diceHandler: mockDiceHandler,
}));

vi.mock('../../../../../src/services/discord/commands/slash/voice.js', () => ({
  voiceCommands: [createMockCommand('voice')],
  voiceHandler: mockVoiceHandler,
}));

vi.mock('../../../../../src/services/discord/commands/slash/settings.js', () => ({
  settingsCommands: [createMockCommand('settings')],
  settingsHandler: mockSettingsHandler,
}));

vi.mock('../../../../../src/services/discord/commands/slash/character.js', () => ({
  characterCommands: [createMockCommand('character')],
  characterHandler: mockCharacterHandler,
}));

vi.mock('../../../../../src/services/discord/commands/slash/ic.js', () => ({
  icCommands: [createMockCommand('ic')],
  icHandler: mockIcHandler,
}));

vi.mock('../../../../../src/services/discord/commands/slash/timestamp.js', () => ({
  timestampCommands: [createMockCommand('timestamp')],
  timestampHandler: mockTimestampHandler,
}));

vi.mock('../../../../../src/services/discord/commands/slash/ai-generate.js', () => ({
  aiGenerateCommands: [createMockCommand('write'), createMockCommand('imagine')],
  aiGenerateHandler: mockAiGenerateHandler,
}));

vi.mock('../../../../../src/services/discord/commands/slash/event.js', () => ({
  eventCommands: [createMockCommand('event')],
  eventHandler: mockEventHandler,
}));

vi.mock('../../../../../src/services/discord/commands/slash/audio.js', () => ({
  audioCommands: [createMockCommand('audio')],
  audioHandler: mockAudioHandler,
}));

vi.mock('../../../../../src/services/discord/commands/slash/adventure.js', () => ({
  adventureCommands: [createMockCommand('adventure')],
  adventureHandler: mockAdventureHandler,
}));

vi.mock('../../../../../src/services/discord/commands/slash/help.js', () => ({
  helpCommands: [createMockCommand('help')],
  helpHandler: mockHelpHandler,
}));

// Import after mocks
import { CommandRegistry } from '../../../../../src/services/discord/commands/registry.js';

describe('CommandRegistry', () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new CommandRegistry();
  });

  describe('constructor', () => {
    it('should create a registry with all commands registered', () => {
      // 12 commands: roll, voice, settings, character, ic, timestamp, write, imagine, event, audio, adventure, help
      expect(registry.commandCount).toBe(12);
    });
  });

  describe('getSlashHandler', () => {
    it('should return the dice handler for roll command', () => {
      const handler = registry.getSlashHandler('roll');
      expect(handler).toBe(mockDiceHandler);
    });

    it('should return the voice handler for voice command', () => {
      const handler = registry.getSlashHandler('voice');
      expect(handler).toBe(mockVoiceHandler);
    });

    it('should return the settings handler for settings command', () => {
      const handler = registry.getSlashHandler('settings');
      expect(handler).toBe(mockSettingsHandler);
    });

    it('should return the character handler for character command', () => {
      const handler = registry.getSlashHandler('character');
      expect(handler).toBe(mockCharacterHandler);
    });

    it('should return the ic handler for ic command', () => {
      const handler = registry.getSlashHandler('ic');
      expect(handler).toBe(mockIcHandler);
    });

    it('should return the timestamp handler for timestamp command', () => {
      const handler = registry.getSlashHandler('timestamp');
      expect(handler).toBe(mockTimestampHandler);
    });

    it('should return the ai-generate handler for write command', () => {
      const handler = registry.getSlashHandler('write');
      expect(handler).toBe(mockAiGenerateHandler);
    });

    it('should return the ai-generate handler for imagine command', () => {
      const handler = registry.getSlashHandler('imagine');
      expect(handler).toBe(mockAiGenerateHandler);
    });

    it('should return the event handler for event command', () => {
      const handler = registry.getSlashHandler('event');
      expect(handler).toBe(mockEventHandler);
    });

    it('should return the audio handler for audio command', () => {
      const handler = registry.getSlashHandler('audio');
      expect(handler).toBe(mockAudioHandler);
    });

    it('should return the adventure handler for adventure command', () => {
      const handler = registry.getSlashHandler('adventure');
      expect(handler).toBe(mockAdventureHandler);
    });

    it('should return the help handler for help command', () => {
      const handler = registry.getSlashHandler('help');
      expect(handler).toBe(mockHelpHandler);
    });

    it('should return undefined for unknown commands', () => {
      const handler = registry.getSlashHandler('unknown');
      expect(handler).toBeUndefined();
    });
  });

  describe('getCommandsJSON', () => {
    it('should return array of command JSON objects', () => {
      const commands = registry.getCommandsJSON();

      expect(Array.isArray(commands)).toBe(true);
      expect(commands.length).toBe(12);
    });

    it('should include command names in JSON', () => {
      const commands = registry.getCommandsJSON();
      const names = commands.map((cmd) => cmd.name);

      expect(names).toContain('roll');
      expect(names).toContain('voice');
      expect(names).toContain('settings');
      expect(names).toContain('character');
      expect(names).toContain('ic');
      expect(names).toContain('timestamp');
      expect(names).toContain('write');
      expect(names).toContain('imagine');
      expect(names).toContain('event');
      expect(names).toContain('audio');
      expect(names).toContain('adventure');
      expect(names).toContain('help');
    });

    it('should include command descriptions in JSON', () => {
      const commands = registry.getCommandsJSON();

      for (const cmd of commands) {
        expect(cmd.description).toBeDefined();
        expect(typeof cmd.description).toBe('string');
        expect(cmd.description.length).toBeGreaterThan(0);
      }
    });
  });

  describe('commandCount', () => {
    it('should return the correct number of registered commands', () => {
      expect(registry.commandCount).toBe(12);
    });
  });
});
