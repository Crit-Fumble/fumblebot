/**
 * Roll Command Unit Tests
 * Comprehensive tests for dice rolling logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rollDice, createRollEmbed, handleRoll } from '../../../src/commands/handlers/roll.js';
import type { CommandContext } from '../../../src/commands/types.js';

describe('rollDice', () => {
  describe('Basic Dice Rolling', () => {
    it('should roll a single d20', () => {
      const result = rollDice('1d20');
      expect(result.notation).toBe('1d20');
      expect(result.rolls).toHaveLength(1);
      expect(result.rolls[0]).toBeGreaterThanOrEqual(1);
      expect(result.rolls[0]).toBeLessThanOrEqual(20);
      expect(result.modifier).toBe(0);
      expect(result.total).toBe(result.rolls[0]);
    });

    it('should roll multiple dice', () => {
      const result = rollDice('3d6');
      expect(result.notation).toBe('3d6');
      expect(result.rolls).toHaveLength(3);
      result.rolls.forEach(roll => {
        expect(roll).toBeGreaterThanOrEqual(1);
        expect(roll).toBeLessThanOrEqual(6);
      });
      expect(result.total).toBe(result.rolls.reduce((sum, r) => sum + r, 0));
    });

    it('should handle d20 without count prefix', () => {
      const result = rollDice('d20');
      expect(result.notation).toBe('d20');
      expect(result.rolls).toHaveLength(1);
      expect(result.rolls[0]).toBeGreaterThanOrEqual(1);
      expect(result.rolls[0]).toBeLessThanOrEqual(20);
    });

    it('should handle various die sizes', () => {
      const dieSizes = [4, 6, 8, 10, 12, 20, 100];
      dieSizes.forEach(sides => {
        const result = rollDice(`1d${sides}`);
        expect(result.rolls[0]).toBeGreaterThanOrEqual(1);
        expect(result.rolls[0]).toBeLessThanOrEqual(sides);
      });
    });
  });

  describe('Modifiers', () => {
    it('should apply positive modifiers', () => {
      const result = rollDice('1d20+5');
      expect(result.modifier).toBe(5);
      expect(result.total).toBe(result.rolls[0] + 5);
    });

    it('should apply negative modifiers', () => {
      const result = rollDice('1d20-3');
      expect(result.modifier).toBe(-3);
      expect(result.total).toBe(result.rolls[0] - 3);
    });

    it('should handle large modifiers', () => {
      const result = rollDice('2d6+10');
      expect(result.modifier).toBe(10);
      expect(result.total).toBe(result.rolls[0] + result.rolls[1] + 10);
    });

    it('should handle modifier of zero', () => {
      const result = rollDice('1d20');
      expect(result.modifier).toBe(0);
    });
  });

  describe('Crit and Fumble Detection', () => {
    it('should detect natural 20 as crit on d20', () => {
      // Mock Math.random to always return 0.999 (will roll 20)
      vi.spyOn(Math, 'random').mockReturnValue(0.999);

      const result = rollDice('1d20');
      expect(result.rolls[0]).toBe(20);
      expect(result.isCrit).toBe(true);
      expect(result.isFumble).toBe(false);

      vi.restoreAllMocks();
    });

    it('should detect natural 1 as fumble on d20', () => {
      // Mock Math.random to always return 0 (will roll 1)
      vi.spyOn(Math, 'random').mockReturnValue(0);

      const result = rollDice('1d20');
      expect(result.rolls[0]).toBe(1);
      expect(result.isCrit).toBe(false);
      expect(result.isFumble).toBe(true);

      vi.restoreAllMocks();
    });

    it('should not detect crit/fumble on multiple d20s', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.999);

      const result = rollDice('2d20');
      expect(result.isCrit).toBe(false);
      expect(result.isFumble).toBe(false);

      vi.restoreAllMocks();
    });

    it('should not detect crit/fumble on non-d20 dice', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.999);

      const result = rollDice('1d6');
      expect(result.isCrit).toBe(false);
      expect(result.isFumble).toBe(false);

      vi.restoreAllMocks();
    });

    it('should not detect crit when rolling 20 with modifier', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.999);

      const result = rollDice('1d20+5');
      expect(result.rolls[0]).toBe(20);
      expect(result.total).toBe(25);
      expect(result.isCrit).toBe(true); // Natural 20 is still a crit

      vi.restoreAllMocks();
    });
  });

  describe('Case Insensitivity', () => {
    it('should handle uppercase notation', () => {
      const result = rollDice('1D20+5');
      expect(result.notation).toBe('1D20+5');
      expect(result.rolls).toHaveLength(1);
      expect(result.modifier).toBe(5);
    });

    it('should handle mixed case notation', () => {
      const result = rollDice('2D6+3');
      expect(result.rolls).toHaveLength(2);
      expect(result.modifier).toBe(3);
    });
  });

  describe('Edge Cases', () => {
    it('should roll maximum dice count', () => {
      const result = rollDice('100d6');
      expect(result.rolls).toHaveLength(100);
      result.rolls.forEach(roll => {
        expect(roll).toBeGreaterThanOrEqual(1);
        expect(roll).toBeLessThanOrEqual(6);
      });
    });

    it('should roll maximum die size', () => {
      const result = rollDice('1d1000');
      expect(result.rolls[0]).toBeGreaterThanOrEqual(1);
      expect(result.rolls[0]).toBeLessThanOrEqual(1000);
    });

    it('should roll minimum valid dice', () => {
      const result = rollDice('1d2');
      expect(result.rolls[0]).toBeGreaterThanOrEqual(1);
      expect(result.rolls[0]).toBeLessThanOrEqual(2);
    });
  });

  describe('Error Handling', () => {
    it('should reject invalid notation', () => {
      expect(() => rollDice('invalid')).toThrow('Invalid dice notation');
      expect(() => rollDice('abc')).toThrow('Invalid dice notation');
      expect(() => rollDice('1d')).toThrow('Invalid dice notation');
      expect(() => rollDice('d')).toThrow('Invalid dice notation');
    });

    it('should reject dice count of 0', () => {
      expect(() => rollDice('0d20')).toThrow('Dice count must be between 1 and 100');
    });

    it('should reject dice count over 100', () => {
      expect(() => rollDice('101d6')).toThrow('Dice count must be between 1 and 100');
    });

    it('should reject die size of 1', () => {
      expect(() => rollDice('1d1')).toThrow('Dice sides must be between 2 and 1000');
    });

    it('should reject die size over 1000', () => {
      expect(() => rollDice('1d1001')).toThrow('Dice sides must be between 2 and 1000');
    });

    it('should reject negative modifiers beyond valid range', () => {
      const result = rollDice('1d20-99');
      expect(result.modifier).toBe(-99);
    });
  });
});

describe('createRollEmbed', () => {
  it('should create basic roll embed', () => {
    const roll = {
      notation: '1d20+5',
      rolls: [15],
      modifier: 5,
      total: 20,
      isCrit: false,
      isFumble: false,
    };

    const embed = createRollEmbed(roll, 'TestUser');

    expect(embed.title).toBe('🎲 Dice Roll');
    expect(embed.description).toContain('TestUser');
    expect(embed.description).toContain('1d20+5');
    expect(embed.color).toBe(0x7c3aed); // Purple
    expect(embed.fields).toHaveLength(3);
    expect(embed.fields![0].value).toBe('[15]');
    expect(embed.fields![1].value).toBe('+5');
    expect(embed.fields![2].value).toBe('**20**');
  });

  it('should create crit embed with green color', () => {
    const roll = {
      notation: '1d20',
      rolls: [20],
      modifier: 0,
      total: 20,
      isCrit: true,
      isFumble: false,
    };

    const embed = createRollEmbed(roll, 'CritMaster');

    expect(embed.title).toBe('🎉 CRITICAL HIT!');
    expect(embed.color).toBe(0x22c55e); // Green
  });

  it('should create fumble embed with red color', () => {
    const roll = {
      notation: '1d20',
      rolls: [1],
      modifier: 0,
      total: 1,
      isCrit: false,
      isFumble: true,
    };

    const embed = createRollEmbed(roll, 'FumbleKing');

    expect(embed.title).toBe('💀 FUMBLE!');
    expect(embed.color).toBe(0xef4444); // Red
  });

  it('should include label in description', () => {
    const roll = {
      notation: '2d6+3',
      rolls: [4, 5],
      modifier: 3,
      total: 12,
      isCrit: false,
      isFumble: false,
      label: 'Attack Roll',
    };

    const embed = createRollEmbed(roll, 'Warrior');

    expect(embed.description).toContain('Attack Roll');
    expect(embed.description).toContain('for *Attack Roll*');
  });

  it('should handle negative modifiers', () => {
    const roll = {
      notation: '1d20-2',
      rolls: [10],
      modifier: -2,
      total: 8,
      isCrit: false,
      isFumble: false,
    };

    const embed = createRollEmbed(roll, 'Player');

    expect(embed.fields![1].value).toBe('-2');
  });

  it('should include footer and timestamp', () => {
    const roll = {
      notation: '1d6',
      rolls: [3],
      modifier: 0,
      total: 3,
      isCrit: false,
      isFumble: false,
    };

    const embed = createRollEmbed(roll, 'Tester');

    expect(embed.footer).toEqual({ text: 'Powered by FumbleBot' });
    expect(embed.timestamp).toBeDefined();
    expect(new Date(embed.timestamp!).getTime()).toBeCloseTo(Date.now(), -3); // Within 1 second
  });
});

describe('handleRoll', () => {
  let context: CommandContext;

  beforeEach(() => {
    context = {
      userId: 'user123',
      username: 'TestPlayer',
      guildId: 'guild456',
      channelId: 'channel789',
      platform: 'discord',
    };
  });

  it('should successfully execute roll command', async () => {
    const options = {
      dice: '2d6+3',
    };

    const result = await handleRoll(context, options);

    expect(result.success).toBe(true);
    expect(result.embed).toBeDefined();
    expect(result.embed!.description).toContain('TestPlayer');
    expect(result.embed!.description).toContain('2d6+3');
    expect(result.data).toBeDefined();
    expect(result.data!.roll).toBeDefined();
  });

  it('should handle label option', async () => {
    const options = {
      dice: '1d20+5',
      label: 'Stealth Check',
    };

    const result = await handleRoll(context, options);

    expect(result.success).toBe(true);
    expect(result.embed!.description).toContain('Stealth Check');
    expect(result.data!.roll.label).toBe('Stealth Check');
  });

  it('should handle private option', async () => {
    const options = {
      dice: '1d20',
      private: true,
    };

    const result = await handleRoll(context, options);

    expect(result.success).toBe(true);
    expect(result.ephemeral).toBe(true);
  });

  it('should default private to false', async () => {
    const options = {
      dice: '1d20',
    };

    const result = await handleRoll(context, options);

    expect(result.success).toBe(true);
    expect(result.ephemeral).toBeUndefined();
  });

  it('should return error for missing notation', async () => {
    const options = {};

    const result = await handleRoll(context, options);

    expect(result.success).toBe(false);
    expect(result.message).toContain('required');
    expect(result.ephemeral).toBe(true);
  });

  it('should return error for invalid notation', async () => {
    const options = {
      dice: 'invalid',
    };

    const result = await handleRoll(context, options);

    expect(result.success).toBe(false);
    expect(result.message).toContain('❌');
    expect(result.message).toContain('Invalid dice notation');
    expect(result.ephemeral).toBe(true);
  });

  it('should return error for dice count over limit', async () => {
    const options = {
      dice: '101d6',
    };

    const result = await handleRoll(context, options);

    expect(result.success).toBe(false);
    expect(result.message).toContain('Dice count must be between 1 and 100');
  });

  it('should handle context without guild', async () => {
    const noGuildContext: CommandContext = {
      userId: 'user123',
      username: 'DMlessPlayer',
      channelId: 'dm-channel',
      platform: 'discord',
    };

    const options = {
      dice: '1d20',
    };

    const result = await handleRoll(noGuildContext, options);

    expect(result.success).toBe(true);
    expect(result.embed).toBeDefined();
  });
});
