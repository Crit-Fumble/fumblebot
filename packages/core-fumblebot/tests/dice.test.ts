/**
 * @crit-fumble/core-fumblebot Dice Roller Tests
 */

import { describe, it, expect } from 'vitest';
import {
  DiceRoller,
  createDiceRoller,
  rollDice,
  parseDice,
  formatRollResult,
  isValidDiceNotation,
  type ParsedDice,
  type ExtendedRollResult,
} from '../src/dice/index.js';

// Helper to create a predictable sequence of random numbers
function createSequence(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index++;
    return value;
  };
}

// Convert die result to random value (0-1) that produces it
// For a d20: result 1 needs random 0-0.05, result 20 needs random 0.95-1
function dieToRandom(result: number, sides: number): number {
  return (result - 1) / sides + 0.0001;
}

describe('DiceRoller', () => {
  describe('parse', () => {
    it('should parse simple dice notation', () => {
      const roller = new DiceRoller();
      const parsed = roller.parse('1d20');

      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toEqual({
        count: 1,
        sides: 20,
        modifier: 0,
      });
    });

    it('should parse dice notation without count', () => {
      const roller = new DiceRoller();
      const parsed = roller.parse('d20');

      expect(parsed).toHaveLength(1);
      expect(parsed[0].count).toBe(1);
      expect(parsed[0].sides).toBe(20);
    });

    it('should parse dice with positive modifier', () => {
      const roller = new DiceRoller();
      const parsed = roller.parse('1d20+5');

      expect(parsed[0].modifier).toBe(5);
    });

    it('should parse dice with negative modifier', () => {
      const roller = new DiceRoller();
      const parsed = roller.parse('2d6-2');

      expect(parsed[0].count).toBe(2);
      expect(parsed[0].sides).toBe(6);
      expect(parsed[0].modifier).toBe(-2);
    });

    it('should parse keep highest modifier', () => {
      const roller = new DiceRoller();
      const parsed = roller.parse('2d20kh1');

      expect(parsed[0].count).toBe(2);
      expect(parsed[0].sides).toBe(20);
      expect(parsed[0].keepHighest).toBe(1);
    });

    it('should parse keep lowest modifier', () => {
      const roller = new DiceRoller();
      const parsed = roller.parse('2d20kl1');

      expect(parsed[0].keepLowest).toBe(1);
    });

    it('should parse drop highest modifier', () => {
      const roller = new DiceRoller();
      const parsed = roller.parse('4d6dh1');

      expect(parsed[0].count).toBe(4);
      expect(parsed[0].sides).toBe(6);
      expect(parsed[0].dropHighest).toBe(1);
    });

    it('should parse drop lowest modifier', () => {
      const roller = new DiceRoller();
      const parsed = roller.parse('4d6dl1');

      expect(parsed[0].dropLowest).toBe(1);
    });

    it('should parse exploding dice (!)', () => {
      const roller = new DiceRoller();
      const parsed = roller.parse('2d6!');

      expect(parsed[0].exploding).toBe(true);
    });

    it('should parse exploding once (!!)', () => {
      const roller = new DiceRoller();
      const parsed = roller.parse('1d6!!');

      expect(parsed[0].explodingOnce).toBe(true);
    });

    it('should parse reroll modifier (r)', () => {
      const roller = new DiceRoller();
      const parsed = roller.parse('4d6r1');

      expect(parsed[0].reroll).toBe(1);
    });

    it('should parse reroll once modifier (ro)', () => {
      const roller = new DiceRoller();
      const parsed = roller.parse('4d6ro1');

      expect(parsed[0].rerollOnce).toBe(1);
    });

    it('should parse multiple dice groups', () => {
      const roller = new DiceRoller();
      // The parser treats +2d6 as a separate dice group
      const parsed = roller.parse('1d20 2d6');

      expect(parsed).toHaveLength(2);
      expect(parsed[0].sides).toBe(20);
      expect(parsed[1].count).toBe(2);
      expect(parsed[1].sides).toBe(6);
    });

    it('should parse complex notation with keep and modifier', () => {
      const roller = new DiceRoller();
      const parsed = roller.parse('2d20kh1+5');

      expect(parsed[0].count).toBe(2);
      expect(parsed[0].sides).toBe(20);
      expect(parsed[0].keepHighest).toBe(1);
      expect(parsed[0].modifier).toBe(5);
    });

    it('should return empty array for invalid notation', () => {
      const roller = new DiceRoller();
      const parsed = roller.parse('invalid');

      expect(parsed).toHaveLength(0);
    });
  });

  describe('roll', () => {
    it('should roll dice with deterministic random', () => {
      // Random value 0.5 on a d20 = floor(0.5 * 20) + 1 = 11
      const roller = new DiceRoller({ random: () => 0.5 });
      const result = roller.roll('1d20');

      expect(result.total).toBe(11);
      expect(result.rolls).toEqual([11]);
    });

    it('should roll multiple dice', () => {
      const roller = new DiceRoller({ random: () => 0.5 });
      const result = roller.roll('3d6');

      // Each d6 with 0.5 = floor(0.5 * 6) + 1 = 4
      expect(result.total).toBe(12); // 4 + 4 + 4
      expect(result.rolls).toEqual([4, 4, 4]);
    });

    it('should apply positive modifier', () => {
      const roller = new DiceRoller({ random: () => 0.5 });
      const result = roller.roll('1d20+5');

      expect(result.total).toBe(16); // 11 + 5
      expect(result.modifier).toBe(5);
    });

    it('should apply negative modifier', () => {
      const roller = new DiceRoller({ random: () => 0.5 });
      const result = roller.roll('1d20-3');

      expect(result.total).toBe(8); // 11 - 3
      expect(result.modifier).toBe(-3);
    });

    it('should keep highest dice', () => {
      // First roll: 0.1 -> 3, Second roll: 0.9 -> 19
      let callCount = 0;
      const roller = new DiceRoller({
        random: () => {
          callCount++;
          return callCount === 1 ? 0.1 : 0.9;
        },
      });
      const result = roller.roll('2d20kh1');

      expect(result.keptRolls).toEqual([19]);
      expect(result.droppedRolls).toEqual([3]);
      expect(result.total).toBe(19);
    });

    it('should keep lowest dice', () => {
      let callCount = 0;
      const roller = new DiceRoller({
        random: () => {
          callCount++;
          return callCount === 1 ? 0.1 : 0.9;
        },
      });
      const result = roller.roll('2d20kl1');

      expect(result.keptRolls).toEqual([3]);
      expect(result.droppedRolls).toEqual([19]);
      expect(result.total).toBe(3);
    });

    it('should drop highest dice', () => {
      let callCount = 0;
      const roller = new DiceRoller({
        random: () => {
          callCount++;
          // d6: 0.0->1, 0.33->2, 0.66->4, 0.99->6
          const values = [0.0, 0.33, 0.66, 0.99];
          return values[(callCount - 1) % values.length];
        },
      });
      const result = roller.roll('4d6dh1');

      // Rolls: 1, 2, 4, 6 - drop 6, keep 1,2,4
      expect(result.droppedRolls).toEqual([6]);
      expect(result.keptRolls.sort((a, b) => a - b)).toEqual([1, 2, 4]);
      expect(result.total).toBe(7); // 1 + 2 + 4
    });

    it('should drop lowest dice', () => {
      let callCount = 0;
      const roller = new DiceRoller({
        random: () => {
          callCount++;
          // d6: 0.0->1, 0.33->2, 0.66->4, 0.99->6
          const values = [0.0, 0.33, 0.66, 0.99];
          return values[(callCount - 1) % values.length];
        },
      });
      const result = roller.roll('4d6dl1');

      // Rolls: 1, 2, 4, 6 - drop 1, keep 2,4,6
      expect(result.droppedRolls).toEqual([1]);
      expect(result.keptRolls.sort((a, b) => a - b)).toEqual([2, 4, 6]);
      expect(result.total).toBe(12); // 2 + 4 + 6
    });

    it('should handle exploding dice', () => {
      let callCount = 0;
      const roller = new DiceRoller({
        random: () => {
          callCount++;
          // First roll: max (6), second roll: not max (3)
          return callCount === 1 ? 0.99 : 0.4;
        },
      });
      const result = roller.roll('1d6!');

      // Should have exploded once: 6 + 3 = 9
      expect(result.allRolls).toEqual([6, 3]);
      expect(result.total).toBe(9);
    });

    it('should handle exploding once (!!)', () => {
      let callCount = 0;
      const roller = new DiceRoller({
        random: () => {
          callCount++;
          // All rolls max
          return 0.99;
        },
      });
      const result = roller.roll('1d6!!');

      // Should explode exactly once: 6 + 6 = 12
      expect(result.allRolls).toEqual([6, 6]);
      expect(result.total).toBe(12);
    });

    it('should handle reroll modifier', () => {
      let callCount = 0;
      const roller = new DiceRoller({
        random: () => {
          callCount++;
          // First roll: 1 (reroll), second roll: 4
          return callCount === 1 ? 0.0 : 0.5;
        },
      });
      const result = roller.roll('1d6r1');

      expect(result.rolls).toEqual([4]);
      expect(result.total).toBe(4);
    });

    it('should handle reroll once modifier', () => {
      let callCount = 0;
      const roller = new DiceRoller({
        random: () => {
          callCount++;
          // Both rolls are 1
          return 0.0;
        },
      });
      const result = roller.roll('1d6ro1');

      // Rerolls once but still 1, keeps the 1
      expect(result.rolls).toEqual([1]);
      expect(result.total).toBe(1);
    });

    it('should include label in result', () => {
      const roller = new DiceRoller({ random: () => 0.5 });
      const result = roller.roll('1d20+5', { label: 'Attack Roll' });

      expect(result.label).toBe('Attack Roll');
    });

    it('should return notation in result', () => {
      const roller = new DiceRoller({ random: () => 0.5 });
      const result = roller.roll('2d20kh1+5');

      expect(result.notation).toBe('2d20kh1+5');
    });

    it('should include parsed components in result', () => {
      const roller = new DiceRoller({ random: () => 0.5 });
      const result = roller.roll('2d20kh1+5');

      expect(result.parsed).toHaveLength(1);
      expect(result.parsed[0].keepHighest).toBe(1);
    });
  });

  describe('analyzeD20', () => {
    const roller = new DiceRoller();

    describe('generic game system', () => {
      it('should detect critical on 20', () => {
        const analysis = roller.analyzeD20(20, 'generic');
        expect(analysis.critical).toBe(true);
        expect(analysis.fumble).toBe(false);
      });

      it('should detect fumble on 1', () => {
        const analysis = roller.analyzeD20(1, 'generic');
        expect(analysis.critical).toBe(false);
        expect(analysis.fumble).toBe(true);
      });

      it('should not detect crit/fumble on other values', () => {
        const analysis = roller.analyzeD20(10, 'generic');
        expect(analysis.critical).toBe(false);
        expect(analysis.fumble).toBe(false);
      });
    });

    describe('D&D 5e game system', () => {
      it('should detect critical on 20', () => {
        const analysis = roller.analyzeD20(20, 'dnd5e');
        expect(analysis.critical).toBe(true);
      });

      it('should detect fumble on 1', () => {
        const analysis = roller.analyzeD20(1, 'dnd5e');
        expect(analysis.fumble).toBe(true);
      });
    });

    describe('D&D 5e 2024 game system', () => {
      it('should detect critical on 20', () => {
        const analysis = roller.analyzeD20(20, 'dnd5e-2024');
        expect(analysis.critical).toBe(true);
      });
    });

    describe('Pathfinder 2e game system', () => {
      it('should detect critical on 20', () => {
        const analysis = roller.analyzeD20(20, 'pf2e');
        expect(analysis.critical).toBe(true);
      });
    });

    describe('Cypher System', () => {
      it('should detect GM intrusion on 1', () => {
        const analysis = roller.analyzeD20(1, 'cypher');
        expect(analysis.fumble).toBe(true);
        expect(analysis.cypherEffect).toBe('gm-intrusion');
      });

      it('should detect minor effect on 17', () => {
        const analysis = roller.analyzeD20(17, 'cypher');
        expect(analysis.cypherEffect).toBe('minor');
        expect(analysis.critical).toBe(false);
      });

      it('should detect major effect on 18', () => {
        const analysis = roller.analyzeD20(18, 'cypher');
        expect(analysis.cypherEffect).toBe('major');
      });

      it('should detect major effect on 19', () => {
        const analysis = roller.analyzeD20(19, 'cypher');
        expect(analysis.cypherEffect).toBe('major');
      });

      it('should detect critical and major effect on 20', () => {
        const analysis = roller.analyzeD20(20, 'cypher');
        expect(analysis.critical).toBe(true);
        expect(analysis.cypherEffect).toBe('major');
      });

      it('should not detect effect on normal roll', () => {
        const analysis = roller.analyzeD20(10, 'cypher');
        expect(analysis.cypherEffect).toBeUndefined();
      });
    });

    describe('Call of Cthulhu', () => {
      it('should detect fumble on 1', () => {
        const analysis = roller.analyzeD20(1, 'coc');
        expect(analysis.fumble).toBe(true);
      });

      it('should not detect critical on 20', () => {
        const analysis = roller.analyzeD20(20, 'coc');
        expect(analysis.critical).toBe(false);
      });
    });
  });

  describe('roll with crit/fumble detection', () => {
    it('should detect critical when d20 rolls 20', () => {
      const roller = new DiceRoller({ random: () => 0.99 }); // d20: 20
      const result = roller.roll('1d20+5');

      expect(result.isCrit).toBe(true);
      expect(result.isFumble).toBe(false);
    });

    it('should detect fumble when d20 rolls 1', () => {
      const roller = new DiceRoller({ random: () => 0.0 }); // d20: 1
      const result = roller.roll('1d20+5');

      expect(result.isCrit).toBe(false);
      expect(result.isFumble).toBe(true);
    });

    it('should detect cypher effect on appropriate rolls', () => {
      // Roll a 17 on d20
      const roller = new DiceRoller({ random: () => 0.8 }); // d20: 17
      const result = roller.roll('1d20', { gameSystem: 'cypher' });

      expect(result.cypherEffect).toBe('minor');
    });

    it('should not detect crit/fumble for non-d20 rolls', () => {
      const roller = new DiceRoller({ random: () => 0.99 }); // d6: 6
      const result = roller.roll('1d6');

      expect(result.isCrit).toBe(false);
      expect(result.isFumble).toBe(false);
    });
  });
});

describe('Factory Functions', () => {
  describe('createDiceRoller', () => {
    it('should create a DiceRoller instance', () => {
      const roller = createDiceRoller();
      expect(roller).toBeInstanceOf(DiceRoller);
    });

    it('should accept custom random function', () => {
      const roller = createDiceRoller({ random: () => 0.5 });
      const result = roller.roll('1d20');
      expect(result.total).toBe(11);
    });
  });

  describe('rollDice', () => {
    it('should roll dice without creating a roller', () => {
      const result = rollDice('1d20');
      expect(result.notation).toBe('1d20');
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.total).toBeLessThanOrEqual(20);
    });

    it('should accept options', () => {
      const result = rollDice('1d20', { label: 'Test Roll' });
      expect(result.label).toBe('Test Roll');
    });
  });

  describe('parseDice', () => {
    it('should parse dice notation without rolling', () => {
      const parsed = parseDice('2d20kh1+5');

      expect(parsed).toHaveLength(1);
      expect(parsed[0].count).toBe(2);
      expect(parsed[0].sides).toBe(20);
      expect(parsed[0].keepHighest).toBe(1);
    });
  });
});

describe('Utility Functions', () => {
  describe('formatRollResult', () => {
    it('should format basic roll result', () => {
      const result: ExtendedRollResult = {
        notation: '1d20',
        rolls: [15],
        modifier: 0,
        total: 15,
        isCrit: false,
        isFumble: false,
        allRolls: [15],
        keptRolls: [15],
        droppedRolls: [],
        parsed: [{ count: 1, sides: 20, modifier: 0 }],
      };

      const formatted = formatRollResult(result);
      expect(formatted).toContain('Rolling 1d20');
      expect(formatted).toContain('[15]');
      expect(formatted).toContain('**15**');
    });

    it('should include label when present', () => {
      const result: ExtendedRollResult = {
        notation: '1d20+5',
        rolls: [15],
        modifier: 5,
        total: 20,
        isCrit: false,
        isFumble: false,
        label: 'Attack Roll',
        allRolls: [15],
        keptRolls: [15],
        droppedRolls: [],
        parsed: [{ count: 1, sides: 20, modifier: 5 }],
      };

      const formatted = formatRollResult(result);
      expect(formatted).toContain('**Attack Roll**');
    });

    it('should show dropped dice with strikethrough', () => {
      const result: ExtendedRollResult = {
        notation: '2d20kh1',
        rolls: [18],
        modifier: 0,
        total: 18,
        isCrit: false,
        isFumble: false,
        allRolls: [18, 5],
        keptRolls: [18],
        droppedRolls: [5],
        parsed: [{ count: 2, sides: 20, modifier: 0, keepHighest: 1 }],
      };

      const formatted = formatRollResult(result);
      expect(formatted).toContain('~~5~~');
    });

    it('should show positive modifier', () => {
      const result: ExtendedRollResult = {
        notation: '1d20+5',
        rolls: [10],
        modifier: 5,
        total: 15,
        isCrit: false,
        isFumble: false,
        allRolls: [10],
        keptRolls: [10],
        droppedRolls: [],
        parsed: [{ count: 1, sides: 20, modifier: 5 }],
      };

      const formatted = formatRollResult(result);
      expect(formatted).toContain('+5');
    });

    it('should show negative modifier', () => {
      const result: ExtendedRollResult = {
        notation: '1d20-2',
        rolls: [10],
        modifier: -2,
        total: 8,
        isCrit: false,
        isFumble: false,
        allRolls: [10],
        keptRolls: [10],
        droppedRolls: [],
        parsed: [{ count: 1, sides: 20, modifier: -2 }],
      };

      const formatted = formatRollResult(result);
      expect(formatted).toContain('-2');
    });

    it('should indicate critical', () => {
      const result: ExtendedRollResult = {
        notation: '1d20',
        rolls: [20],
        modifier: 0,
        total: 20,
        isCrit: true,
        isFumble: false,
        allRolls: [20],
        keptRolls: [20],
        droppedRolls: [],
        parsed: [{ count: 1, sides: 20, modifier: 0 }],
      };

      const formatted = formatRollResult(result);
      expect(formatted).toContain('Critical!');
    });

    it('should indicate fumble', () => {
      const result: ExtendedRollResult = {
        notation: '1d20',
        rolls: [1],
        modifier: 0,
        total: 1,
        isCrit: false,
        isFumble: true,
        allRolls: [1],
        keptRolls: [1],
        droppedRolls: [],
        parsed: [{ count: 1, sides: 20, modifier: 0 }],
      };

      const formatted = formatRollResult(result);
      expect(formatted).toContain('Fumble!');
    });

    it('should show cypher minor effect', () => {
      const result: ExtendedRollResult = {
        notation: '1d20',
        rolls: [17],
        modifier: 0,
        total: 17,
        isCrit: false,
        isFumble: false,
        cypherEffect: 'minor',
        allRolls: [17],
        keptRolls: [17],
        droppedRolls: [],
        parsed: [{ count: 1, sides: 20, modifier: 0 }],
      };

      const formatted = formatRollResult(result);
      expect(formatted).toContain('Minor Effect');
    });

    it('should show cypher major effect', () => {
      const result: ExtendedRollResult = {
        notation: '1d20',
        rolls: [19],
        modifier: 0,
        total: 19,
        isCrit: false,
        isFumble: false,
        cypherEffect: 'major',
        allRolls: [19],
        keptRolls: [19],
        droppedRolls: [],
        parsed: [{ count: 1, sides: 20, modifier: 0 }],
      };

      const formatted = formatRollResult(result);
      expect(formatted).toContain('Major Effect');
    });

    it('should show cypher GM intrusion', () => {
      const result: ExtendedRollResult = {
        notation: '1d20',
        rolls: [1],
        modifier: 0,
        total: 1,
        isCrit: false,
        isFumble: true,
        cypherEffect: 'gm-intrusion',
        allRolls: [1],
        keptRolls: [1],
        droppedRolls: [],
        parsed: [{ count: 1, sides: 20, modifier: 0 }],
      };

      const formatted = formatRollResult(result);
      expect(formatted).toContain('GM Intrusion');
    });
  });

  describe('isValidDiceNotation', () => {
    it('should return true for valid notation', () => {
      expect(isValidDiceNotation('1d20')).toBe(true);
      expect(isValidDiceNotation('2d6+5')).toBe(true);
      expect(isValidDiceNotation('4d6dl1')).toBe(true);
      expect(isValidDiceNotation('2d20kh1+5')).toBe(true);
    });

    it('should return false for invalid notation', () => {
      expect(isValidDiceNotation('invalid')).toBe(false);
      expect(isValidDiceNotation('')).toBe(false);
      expect(isValidDiceNotation('hello world')).toBe(false);
    });
  });
});

describe('Edge Cases', () => {
  it('should handle dice notation with spaces', () => {
    const result = rollDice('1d20 + 5');
    expect(result.notation).toBe('1d20 + 5');
  });

  it('should handle multiple dice groups with different sides', () => {
    const roller = new DiceRoller({ random: () => 0.5 });
    const result = roller.roll('1d20 2d6 1d8');

    // d20: 11, 2d6: 8 (4+4), d8: 5
    expect(result.total).toBe(24);
  });

  it('should handle standalone modifiers', () => {
    const roller = new DiceRoller({ random: () => 0.5 });
    const result = roller.roll('1d20+5+3');

    // d20: 11 + 5 (from notation) + 3 (standalone) = 19
    expect(result.total).toBe(19);
  });

  it('should handle advantage roll (2d20kh1)', () => {
    let callCount = 0;
    const roller = new DiceRoller({
      random: () => {
        callCount++;
        return callCount === 1 ? 0.3 : 0.8; // 7 and 17
      },
    });
    const result = roller.roll('2d20kh1+5', { label: 'Attack (Advantage)' });

    expect(result.keptRolls).toEqual([17]);
    expect(result.total).toBe(22); // 17 + 5
    expect(result.label).toBe('Attack (Advantage)');
  });

  it('should handle disadvantage roll (2d20kl1)', () => {
    let callCount = 0;
    const roller = new DiceRoller({
      random: () => {
        callCount++;
        return callCount === 1 ? 0.3 : 0.8; // 7 and 17
      },
    });
    const result = roller.roll('2d20kl1+5');

    expect(result.keptRolls).toEqual([7]);
    expect(result.total).toBe(12); // 7 + 5
  });

  it('should handle stat roll (4d6dl1)', () => {
    let callCount = 0;
    const roller = new DiceRoller({
      random: () => {
        callCount++;
        // d6: 0.0->1, 0.5->4, 0.66->4, 0.83->5
        const values = [0.0, 0.5, 0.66, 0.83];
        return values[(callCount - 1) % values.length];
      },
    });
    const result = roller.roll('4d6dl1');

    // Rolls: 1, 4, 4, 5 - Drop the 1, keep 4, 4, 5 = 13
    expect(result.droppedRolls).toContain(1);
    expect(result.total).toBe(13);
  });
});
