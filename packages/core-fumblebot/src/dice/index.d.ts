/**
 * @crit-fumble/core-fumblebot Dice Roller
 *
 * Standalone dice rolling utility that parses dice notation and rolls dice locally.
 * No API calls required - pure TypeScript implementation.
 *
 * Supports:
 * - Standard notation: 1d20, 2d6+5, 4d8-2
 * - Keep highest/lowest: 2d20kh1, 4d6kl1
 * - Drop highest/lowest: 4d6dh1, 4d6dl1
 * - Exploding dice: 4d6!, 1d6!!
 * - Rerolling: 4d6r1, 4d6ro1
 * - Cypher System effects (17=minor, 18-19=major, 1=GM intrusion, 20=crit)
 */
import type { DiceRollResult } from '../types/index.js';
export type GameSystem = 'dnd5e' | 'dnd5e-2024' | 'pf2e' | 'cypher' | 'coc' | 'swade' | 'generic';
export interface DiceRollOptions {
    /** Label for the roll */
    label?: string;
    /** Game system for special rules (affects crit/fumble detection) */
    gameSystem?: GameSystem;
    /** Custom random function for testing (returns 0-1) */
    random?: () => number;
}
export interface ParsedDice {
    count: number;
    sides: number;
    modifier: number;
    keepHighest?: number;
    keepLowest?: number;
    dropHighest?: number;
    dropLowest?: number;
    exploding?: boolean;
    explodingOnce?: boolean;
    reroll?: number;
    rerollOnce?: number;
}
export interface ExtendedRollResult extends DiceRollResult {
    /** Individual dice values (including dropped) */
    allRolls: number[];
    /** Dice that were kept after kh/kl/dh/dl */
    keptRolls: number[];
    /** Dice that were dropped */
    droppedRolls: number[];
    /** Cypher System effect (if applicable) */
    cypherEffect?: 'minor' | 'major' | 'gm-intrusion';
    /** Parsed dice components */
    parsed: ParsedDice[];
}
export declare class DiceRoller {
    private random;
    constructor(options?: {
        random?: () => number;
    });
    /**
     * Roll a single die with given sides
     */
    private rollDie;
    /**
     * Parse dice notation into components
     */
    parse(notation: string): ParsedDice[];
    /**
     * Roll dice from parsed components
     */
    private rollParsed;
    /**
     * Extract standalone modifiers from notation
     */
    private extractModifiers;
    /**
     * Analyze d20 result for critical/fumble based on game system
     */
    analyzeD20(result: number, gameSystem?: GameSystem): {
        critical: boolean;
        fumble: boolean;
        cypherEffect?: 'minor' | 'major' | 'gm-intrusion';
    };
    /**
     * Roll dice from notation string
     *
     * @example
     * ```typescript
     * const roller = new DiceRoller();
     *
     * // Simple roll
     * const result = roller.roll('1d20+5');
     * console.log(result.total); // e.g., 17
     *
     * // Advantage (keep highest of 2d20)
     * const advantage = roller.roll('2d20kh1+5');
     *
     * // 4d6 drop lowest (character stats)
     * const stats = roller.roll('4d6dl1');
     *
     * // Cypher System with effect detection
     * const cypher = roller.roll('1d20', { gameSystem: 'cypher' });
     * if (cypher.cypherEffect === 'major') {
     *   console.log('Major Effect!');
     * }
     * ```
     */
    roll(notation: string, options?: DiceRollOptions): ExtendedRollResult;
}
/**
 * Create a new DiceRoller instance
 *
 * @example
 * ```typescript
 * import { createDiceRoller } from '@crit-fumble/core-fumblebot';
 *
 * const roller = createDiceRoller();
 * const result = roller.roll('2d20kh1+5', { label: 'Attack (Advantage)' });
 * ```
 */
export declare function createDiceRoller(options?: {
    random?: () => number;
}): DiceRoller;
/**
 * Roll dice with a one-liner (creates a temporary roller)
 *
 * @example
 * ```typescript
 * import { rollDice } from '@crit-fumble/core-fumblebot';
 *
 * const result = rollDice('1d20+5');
 * console.log(`You rolled ${result.total}!`);
 *
 * // With Cypher System
 * const cypher = rollDice('1d20', { gameSystem: 'cypher' });
 * if (cypher.cypherEffect) {
 *   console.log(`Effect: ${cypher.cypherEffect}`);
 * }
 * ```
 */
export declare function rollDice(notation: string, options?: DiceRollOptions): ExtendedRollResult;
/**
 * Parse dice notation without rolling
 * Useful for validation or display
 *
 * @example
 * ```typescript
 * import { parseDice } from '@crit-fumble/core-fumblebot';
 *
 * const parsed = parseDice('2d20kh1+5');
 * // [{ count: 2, sides: 20, keepHighest: 1, modifier: 5 }]
 * ```
 */
export declare function parseDice(notation: string): ParsedDice[];
/**
 * Format a roll result for display
 */
export declare function formatRollResult(result: ExtendedRollResult): string;
/**
 * Validate dice notation
 */
export declare function isValidDiceNotation(notation: string): boolean;
//# sourceMappingURL=index.d.ts.map