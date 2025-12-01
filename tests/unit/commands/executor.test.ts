/**
 * Command Executor Unit Tests
 * Tests for platform-agnostic command execution
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  executeCommand,
  parseCommandString,
  getCommandDefinition,
  getAllCommandDefinitions,
  hasCommand,
  CommandExecutor,
  commandExecutor,
} from '../../../src/commands/executor.js';
import type { CommandContext } from '../../../src/commands/types.js';

describe('Command Executor', () => {
  let context: CommandContext;

  beforeEach(() => {
    context = {
      userId: 'user123',
      username: 'TestUser',
      guildId: 'guild456',
      channelId: 'channel789',
      platform: 'discord',
    };
  });

  describe('executeCommand', () => {
    it('should execute roll command successfully', async () => {
      const result = await executeCommand('roll', context, { dice: '1d20+5' });

      expect(result.success).toBe(true);
      expect(result.embed).toBeDefined();
    });

    it('should return error for unknown command', async () => {
      const result = await executeCommand('nonexistent', context, {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown command');
      expect(result.ephemeral).toBe(true);
    });

    it('should handle command requiring guild context', async () => {
      const noGuildContext: CommandContext = {
        userId: 'user123',
        username: 'TestUser',
        channelId: 'dm-channel',
        platform: 'discord',
      };

      // Roll command doesn't require guild, so it should work
      const result = await executeCommand('roll', noGuildContext, { dice: '1d20' });

      expect(result.success).toBe(true);
    });

    it('should handle errors thrown by command handler', async () => {
      const result = await executeCommand('roll', context, { dice: 'invalid' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌');
      expect(result.ephemeral).toBe(true);
    });

    it('should pass options to command handler', async () => {
      const result = await executeCommand('roll', context, {
        dice: '2d6+3',
        label: 'Attack Roll',
      });

      expect(result.success).toBe(true);
      expect(result.embed?.description).toContain('Attack Roll');
    });

    it('should handle empty options object', async () => {
      const result = await executeCommand('roll', context, {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('required');
    });
  });

  describe('parseCommandString', () => {
    it('should parse command with positional argument', () => {
      const parsed = parseCommandString('/roll 2d6+3');

      expect(parsed).toBeDefined();
      expect(parsed!.command).toBe('roll');
      expect(parsed!.options.dice).toBe('2d6+3');
    });

    it('should parse command with named arguments', () => {
      const parsed = parseCommandString('/roll dice:1d20+5 label:Attack');

      expect(parsed).toBeDefined();
      expect(parsed!.command).toBe('roll');
      expect(parsed!.options.dice).toBe('1d20+5');
      expect(parsed!.options.label).toBe('Attack');
    });

    it('should parse command without leading slash', () => {
      const parsed = parseCommandString('roll 1d20');

      expect(parsed).toBeDefined();
      expect(parsed!.command).toBe('roll');
      expect(parsed!.options.dice).toBe('1d20');
    });

    it('should handle mixed positional and named arguments', () => {
      const parsed = parseCommandString('/roll 2d6 label:Attack');

      expect(parsed).toBeDefined();
      expect(parsed!.command).toBe('roll');
      expect(parsed!.options.dice).toBe('2d6');
      expect(parsed!.options.label).toBe('Attack');
    });

    it('should handle command with no arguments', () => {
      const parsed = parseCommandString('/roll');

      expect(parsed).toBeDefined();
      expect(parsed!.command).toBe('roll');
      expect(parsed!.options).toEqual({});
    });

    it('should return null for empty input', () => {
      const parsed = parseCommandString('');

      expect(parsed).toBeNull();
    });

    it('should return null for whitespace-only input', () => {
      const parsed = parseCommandString('   ');

      expect(parsed).toBeNull();
    });

    it('should handle unknown command', () => {
      const parsed = parseCommandString('/unknown arg1 arg2');

      expect(parsed).toBeDefined();
      expect(parsed!.command).toBe('unknown');
      expect(parsed!.options).toEqual({});
    });

    it('should lowercase command name', () => {
      const parsed = parseCommandString('/ROLL 1d20');

      expect(parsed!.command).toBe('roll');
    });

    it('should handle colons in values', () => {
      const parsed = parseCommandString('/roll label:Test:Value');

      expect(parsed).toBeDefined();
      expect(parsed!.options.label).toBe('Test:Value');
    });
  });

  describe('getCommandDefinition', () => {
    it('should return definition for roll command', () => {
      const definition = getCommandDefinition('roll');

      expect(definition).toBeDefined();
      expect(definition!.name).toBe('roll');
      expect(definition!.description).toBeDefined();
      expect(definition!.options).toBeDefined();
    });

    it('should return undefined for unknown command', () => {
      const definition = getCommandDefinition('nonexistent');

      expect(definition).toBeUndefined();
    });

    it('should have dice option in roll command', () => {
      const definition = getCommandDefinition('roll');

      expect(definition!.options).toBeDefined();
      const diceOption = definition!.options!.find(o => o.name === 'dice');
      expect(diceOption).toBeDefined();
      expect(diceOption!.required).toBe(true);
    });

    it('should have label option in roll command', () => {
      const definition = getCommandDefinition('roll');

      const labelOption = definition!.options!.find(o => o.name === 'label');
      expect(labelOption).toBeDefined();
      expect(labelOption!.required).toBe(false);
    });

    it('should have private option in roll command', () => {
      const definition = getCommandDefinition('roll');

      const privateOption = definition!.options!.find(o => o.name === 'private');
      expect(privateOption).toBeDefined();
      expect(privateOption!.type).toBe('boolean');
    });
  });

  describe('getAllCommandDefinitions', () => {
    it('should return array of command definitions', () => {
      const definitions = getAllCommandDefinitions();

      expect(Array.isArray(definitions)).toBe(true);
      expect(definitions.length).toBeGreaterThan(0);
    });

    it('should include roll command', () => {
      const definitions = getAllCommandDefinitions();

      const rollCommand = definitions.find(d => d.name === 'roll');
      expect(rollCommand).toBeDefined();
    });

    it('should have valid structure for each definition', () => {
      const definitions = getAllCommandDefinitions();

      definitions.forEach(def => {
        expect(def.name).toBeDefined();
        expect(typeof def.name).toBe('string');
        expect(def.description).toBeDefined();
        expect(typeof def.description).toBe('string');
      });
    });
  });

  describe('hasCommand', () => {
    it('should return true for roll command', () => {
      expect(hasCommand('roll')).toBe(true);
    });

    it('should return false for unknown command', () => {
      expect(hasCommand('nonexistent')).toBe(false);
    });

    it('should be case-sensitive', () => {
      expect(hasCommand('ROLL')).toBe(false);
      expect(hasCommand('roll')).toBe(true);
    });
  });

  describe('CommandExecutor class', () => {
    let executor: CommandExecutor;

    beforeEach(() => {
      executor = new CommandExecutor();
    });

    describe('execute', () => {
      it('should execute command successfully', async () => {
        const result = await executor.execute('roll', context, { dice: '1d20' });

        expect(result.success).toBe(true);
      });

      it('should return error for unknown command', async () => {
        const result = await executor.execute('unknown', context, {});

        expect(result.success).toBe(false);
        expect(result.message).toContain('Unknown command');
      });
    });

    describe('executeString', () => {
      it('should execute command from string', async () => {
        const result = await executor.executeString('/roll 2d6+3', context);

        expect(result.success).toBe(true);
        expect(result.embed).toBeDefined();
      });

      it('should handle string with named arguments', async () => {
        const result = await executor.executeString(
          '/roll dice:1d20+5 label:Attack',
          context
        );

        expect(result.success).toBe(true);
        expect(result.embed?.description).toContain('Attack');
      });

      it('should return error for invalid format', async () => {
        const result = await executor.executeString('', context);

        expect(result.success).toBe(false);
        expect(result.message).toContain('Invalid command format');
      });

      it('should execute unknown command and get error', async () => {
        const result = await executor.executeString('/unknown arg', context);

        expect(result.success).toBe(false);
        expect(result.message).toContain('Unknown command');
      });
    });

    describe('getCommands', () => {
      it('should return array of commands', () => {
        const commands = executor.getCommands();

        expect(Array.isArray(commands)).toBe(true);
        expect(commands.length).toBeGreaterThan(0);
      });

      it('should include roll command', () => {
        const commands = executor.getCommands();

        const rollCommand = commands.find(c => c.name === 'roll');
        expect(rollCommand).toBeDefined();
      });
    });

    describe('hasCommand', () => {
      it('should return true for existing command', () => {
        expect(executor.hasCommand('roll')).toBe(true);
      });

      it('should return false for non-existing command', () => {
        expect(executor.hasCommand('fake')).toBe(false);
      });
    });
  });

  describe('commandExecutor singleton', () => {
    it('should be a CommandExecutor instance', () => {
      expect(commandExecutor).toBeInstanceOf(CommandExecutor);
    });

    it('should execute commands', async () => {
      const result = await commandExecutor.execute('roll', context, { dice: '1d20' });

      expect(result.success).toBe(true);
    });

    it('should have all methods available', () => {
      expect(commandExecutor.execute).toBeTypeOf('function');
      expect(commandExecutor.executeString).toBeTypeOf('function');
      expect(commandExecutor.getCommands).toBeTypeOf('function');
      expect(commandExecutor.hasCommand).toBeTypeOf('function');
    });
  });
});
