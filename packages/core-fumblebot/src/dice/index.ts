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

// =============================================================================
// Types
// =============================================================================

export type GameSystem =
  | 'dnd5e'
  | 'dnd5e-2024'
  | 'pf2e'
  | 'cypher'
  | 'coc'
  | 'swade'
  | 'generic';

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

// =============================================================================
// Constants
// =============================================================================

/**
 * Standard dice notation regex
 * Matches: 1d20, 2d6+5, 4d8-2, d20, 2d20kh1, 4d6dl1, 1d6!, etc.
 */
const DICE_REGEX = /(\d*)d(\d+)(?:(kh|kl|dh|dl)(\d+))?(?:(r|ro)(\d+))?(!{1,2})?([+-]\d+)?/gi;

/**
 * Simple modifier regex for standalone +/- numbers
 */
const MODIFIER_REGEX = /(?:^|(?<=[+\-\s]))([+-]?\d+)(?![d\d])/g;

// =============================================================================
// Dice Roller Class
// =============================================================================

export class DiceRoller {
  private random: () => number;

  constructor(options?: { random?: () => number }) {
    this.random = options?.random ?? Math.random;
  }

  /**
   * Roll a single die with given sides
   */
  private rollDie(sides: number): number {
    return Math.floor(this.random() * sides) + 1;
  }

  /**
   * Parse dice notation into components
   */
  parse(notation: string): ParsedDice[] {
    const dice: ParsedDice[] = [];
    let match: RegExpExecArray | null;

    // Reset regex state
    DICE_REGEX.lastIndex = 0;

    while ((match = DICE_REGEX.exec(notation)) !== null) {
      const [, countStr, sidesStr, keepDrop, keepDropCount, rerollType, rerollValue, exploding, modifierStr] = match;

      const parsed: ParsedDice = {
        count: countStr ? parseInt(countStr, 10) : 1,
        sides: parseInt(sidesStr, 10),
        modifier: modifierStr ? parseInt(modifierStr, 10) : 0,
      };

      // Handle keep/drop modifiers
      if (keepDrop && keepDropCount) {
        const count = parseInt(keepDropCount, 10);
        switch (keepDrop.toLowerCase()) {
          case 'kh': parsed.keepHighest = count; break;
          case 'kl': parsed.keepLowest = count; break;
          case 'dh': parsed.dropHighest = count; break;
          case 'dl': parsed.dropLowest = count; break;
        }
      }

      // Handle reroll
      if (rerollType && rerollValue) {
        if (rerollType === 'r') {
          parsed.reroll = parseInt(rerollValue, 10);
        } else {
          parsed.rerollOnce = parseInt(rerollValue, 10);
        }
      }

      // Handle exploding
      if (exploding) {
        if (exploding === '!!') {
          parsed.explodingOnce = true;
        } else {
          parsed.exploding = true;
        }
      }

      dice.push(parsed);
    }

    return dice;
  }

  /**
   * Roll dice from parsed components
   */
  private rollParsed(parsed: ParsedDice): { all: number[]; kept: number[]; dropped: number[] } {
    const rolls: number[] = [];

    // Roll initial dice
    for (let i = 0; i < parsed.count; i++) {
      let value = this.rollDie(parsed.sides);

      // Handle reroll
      if (parsed.reroll !== undefined && value <= parsed.reroll) {
        // Reroll indefinitely until above threshold
        while (value <= parsed.reroll) {
          value = this.rollDie(parsed.sides);
        }
      } else if (parsed.rerollOnce !== undefined && value <= parsed.rerollOnce) {
        // Reroll once
        value = this.rollDie(parsed.sides);
      }

      // Handle exploding
      if (parsed.exploding && value === parsed.sides) {
        rolls.push(value);
        // Keep rolling while we hit max
        while (value === parsed.sides) {
          value = this.rollDie(parsed.sides);
          rolls.push(value);
        }
      } else if (parsed.explodingOnce && value === parsed.sides) {
        rolls.push(value);
        // Explode once
        rolls.push(this.rollDie(parsed.sides));
      } else {
        rolls.push(value);
      }
    }

    // Apply keep/drop modifiers
    let kept = [...rolls];
    let dropped: number[] = [];

    if (parsed.keepHighest !== undefined) {
      const sorted = [...rolls].sort((a, b) => b - a);
      kept = sorted.slice(0, parsed.keepHighest);
      dropped = sorted.slice(parsed.keepHighest);
    } else if (parsed.keepLowest !== undefined) {
      const sorted = [...rolls].sort((a, b) => a - b);
      kept = sorted.slice(0, parsed.keepLowest);
      dropped = sorted.slice(parsed.keepLowest);
    } else if (parsed.dropHighest !== undefined) {
      const sorted = [...rolls].sort((a, b) => b - a);
      dropped = sorted.slice(0, parsed.dropHighest);
      kept = sorted.slice(parsed.dropHighest);
    } else if (parsed.dropLowest !== undefined) {
      const sorted = [...rolls].sort((a, b) => a - b);
      dropped = sorted.slice(0, parsed.dropLowest);
      kept = sorted.slice(parsed.dropLowest);
    }

    return { all: rolls, kept, dropped };
  }

  /**
   * Extract standalone modifiers from notation
   */
  private extractModifiers(notation: string): number {
    // Remove dice expressions first
    const withoutDice = notation.replace(DICE_REGEX, '');
    let total = 0;

    // Reset regex state
    MODIFIER_REGEX.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = MODIFIER_REGEX.exec(withoutDice)) !== null) {
      total += parseInt(match[1], 10);
    }

    return total;
  }

  /**
   * Analyze d20 result for critical/fumble based on game system
   */
  analyzeD20(result: number, gameSystem: GameSystem = 'generic'): {
    critical: boolean;
    fumble: boolean;
    cypherEffect?: 'minor' | 'major' | 'gm-intrusion';
  } {
    const analysis: {
      critical: boolean;
      fumble: boolean;
      cypherEffect?: 'minor' | 'major' | 'gm-intrusion';
    } = {
      critical: false,
      fumble: false,
    };

    switch (gameSystem) {
      case 'cypher':
        // Cypher System special effects
        if (result === 1) {
          analysis.fumble = true;
          analysis.cypherEffect = 'gm-intrusion';
        } else if (result === 17) {
          analysis.cypherEffect = 'minor';
        } else if (result >= 18 && result <= 19) {
          analysis.cypherEffect = 'major';
        } else if (result === 20) {
          analysis.critical = true;
          analysis.cypherEffect = 'major';
        }
        break;

      case 'coc':
        // Call of Cthulhu uses d100, but for d20 variant
        if (result === 1) {
          analysis.fumble = true;
        }
        break;

      case 'dnd5e':
      case 'dnd5e-2024':
      case 'pf2e':
      case 'swade':
      case 'generic':
      default:
        // Standard d20: 20 = crit, 1 = fumble
        if (result === 20) {
          analysis.critical = true;
        } else if (result === 1) {
          analysis.fumble = true;
        }
        break;
    }

    return analysis;
  }

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
  roll(notation: string, options?: DiceRollOptions): ExtendedRollResult {
    const parsed = this.parse(notation);
    const gameSystem = options?.gameSystem ?? 'generic';

    const allRolls: number[] = [];
    const keptRolls: number[] = [];
    const droppedRolls: number[] = [];
    let diceTotal = 0;

    // Roll each dice group
    for (const dice of parsed) {
      const result = this.rollParsed(dice);
      allRolls.push(...result.all);
      keptRolls.push(...result.kept);
      droppedRolls.push(...result.dropped);
      diceTotal += result.kept.reduce((sum, v) => sum + v, 0);
      diceTotal += dice.modifier;
    }

    // Add standalone modifiers
    const standaloneModifier = this.extractModifiers(notation);
    const total = diceTotal + standaloneModifier;

    // Calculate total modifier (from dice + standalone)
    const totalModifier = parsed.reduce((sum, d) => sum + d.modifier, 0) + standaloneModifier;

    // Analyze for crits/fumbles - check if this is a d20 roll
    let isCrit = false;
    let isFumble = false;
    let cypherEffect: 'minor' | 'major' | 'gm-intrusion' | undefined;

    const hasD20 = parsed.some(d => d.sides === 20);
    if (hasD20 && keptRolls.length > 0) {
      // Find the d20 result (first kept roll from a d20)
      const d20Index = parsed.findIndex(d => d.sides === 20);
      if (d20Index !== -1) {
        // The d20 result is the first kept roll
        const d20Result = keptRolls[0];
        const analysis = this.analyzeD20(d20Result, gameSystem);
        isCrit = analysis.critical;
        isFumble = analysis.fumble;
        cypherEffect = analysis.cypherEffect;
      }
    }

    return {
      notation,
      rolls: keptRolls,
      modifier: totalModifier,
      total,
      isCrit,
      isFumble,
      label: options?.label,
      // Extended properties
      allRolls,
      keptRolls,
      droppedRolls,
      cypherEffect,
      parsed,
    };
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

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
export function createDiceRoller(options?: { random?: () => number }): DiceRoller {
  return new DiceRoller(options);
}

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
export function rollDice(notation: string, options?: DiceRollOptions): ExtendedRollResult {
  const roller = new DiceRoller();
  return roller.roll(notation, options);
}

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
export function parseDice(notation: string): ParsedDice[] {
  const roller = new DiceRoller();
  return roller.parse(notation);
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format a roll result for display
 */
export function formatRollResult(result: ExtendedRollResult): string {
  const parts: string[] = [];

  // Show label if present
  if (result.label) {
    parts.push(`**${result.label}**`);
  }

  // Show notation
  parts.push(`Rolling ${result.notation}`);

  // Show dice results
  if (result.droppedRolls.length > 0) {
    const keptStr = result.keptRolls.join(', ');
    const droppedStr = result.droppedRolls.map(d => `~~${d}~~`).join(', ');
    parts.push(`[${keptStr}, ${droppedStr}]`);
  } else {
    parts.push(`[${result.keptRolls.join(', ')}]`);
  }

  // Show modifier
  if (result.modifier !== 0) {
    parts.push(`${result.modifier > 0 ? '+' : ''}${result.modifier}`);
  }

  // Show total with crit/fumble indication
  let totalStr = `= **${result.total}**`;
  if (result.isCrit) {
    totalStr += ' 🎯 Critical!';
  } else if (result.isFumble) {
    totalStr += ' 💀 Fumble!';
  }

  // Show Cypher effect if applicable
  if (result.cypherEffect) {
    switch (result.cypherEffect) {
      case 'minor':
        totalStr += ' ✨ Minor Effect';
        break;
      case 'major':
        totalStr += ' 🌟 Major Effect';
        break;
      case 'gm-intrusion':
        totalStr += ' ⚠️ GM Intrusion';
        break;
    }
  }

  parts.push(totalStr);

  return parts.join(' ');
}

/**
 * Validate dice notation
 */
export function isValidDiceNotation(notation: string): boolean {
  const roller = new DiceRoller();
  const parsed = roller.parse(notation);
  return parsed.length > 0;
}
