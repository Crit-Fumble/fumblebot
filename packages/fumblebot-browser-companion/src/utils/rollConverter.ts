/**
 * Roll Converter Utility
 *
 * Converts dice rolls from various VTT formats into a unified structure.
 * Inspired by Beyond20 and dddice approaches.
 */

import type { VTTRoll, VTTPlatform, GameSystem } from '../types';

/**
 * Standard dice expression regex
 * Matches patterns like: 1d20, 2d6+5, 4d8-2, d20, etc.
 */
const DICE_REGEX = /(\d*)d(\d+)([+-]\d+)?/gi;

/**
 * Roll20 operator patterns to clean
 * Based on dddice's removeUnsupportedRoll20Operators
 */
const ROLL20_CLEANUP_PATTERNS = [
  { pattern: /\(\)/g, replacement: '(0)' },           // Empty parens
  { pattern: /\+-/g, replacement: '-' },              // Chained operators
  { pattern: /(cs|cf)\d+/gi, replacement: '' },       // Compare success/fail
  { pattern: /(cs|cf)?[><=]=?\d+/gi, replacement: '' }, // Comparators
  { pattern: /(r|rr|!|!!|!p|ro|co|ce|sf|df|min|max)\d*/gi, replacement: '' }, // Modifiers
];

/**
 * Clean Roll20-specific notation
 */
export function cleanRoll20Expression(expr: string): string {
  let cleaned = expr;
  for (const { pattern, replacement } of ROLL20_CLEANUP_PATTERNS) {
    cleaned = cleaned.replace(pattern, replacement);
  }
  return cleaned.trim();
}

/**
 * Parse dice expression into components
 */
export function parseDiceExpression(expr: string): Array<{
  count: number;
  sides: number;
  modifier: number;
}> {
  const dice: Array<{ count: number; sides: number; modifier: number }> = [];
  let match;

  while ((match = DICE_REGEX.exec(expr)) !== null) {
    dice.push({
      count: match[1] ? parseInt(match[1], 10) : 1,
      sides: parseInt(match[2], 10),
      modifier: match[3] ? parseInt(match[3], 10) : 0,
    });
  }

  return dice;
}

/**
 * Detect game system from roll context
 */
export function detectGameSystem(roll: Partial<VTTRoll>, context?: {
  sheetType?: string;
  systemId?: string;
  rollTemplate?: string;
}): GameSystem {
  // Check explicit system ID (Foundry provides this)
  if (context?.systemId) {
    if (context.systemId === 'cyphersystem') return 'cypher';
    if (context.systemId === 'dnd5e') return 'dnd5e';
    if (context.systemId === 'pf2e') return 'pf2e';
    if (context.systemId === 'CoC7') return 'coc';
    if (context.systemId === 'swade') return 'swade';
  }

  // Check Roll20 sheet type
  if (context?.sheetType) {
    if (context.sheetType.includes('cypher')) return 'cypher';
    if (context.sheetType.includes('numenera')) return 'cypher';
    if (context.sheetType.includes('strange')) return 'cypher';
    if (context.sheetType.includes('5e') || context.sheetType.includes('dnd')) return 'dnd5e';
    if (context.sheetType.includes('pf2e') || context.sheetType.includes('pathfinder')) return 'pf2e';
    if (context.sheetType.includes('coc') || context.sheetType.includes('cthulhu')) return 'coc';
  }

  // Check roll template names
  if (context?.rollTemplate) {
    if (context.rollTemplate.includes('cypher')) return 'cypher';
    if (context.rollTemplate.includes('npc') || context.rollTemplate.includes('5e')) return 'dnd5e';
  }

  return 'generic';
}

/**
 * Analyze a d20 roll for special results based on game system
 */
export function analyzeD20Roll(
  result: number,
  gameSystem: GameSystem
): {
  critical: boolean;
  fumble: boolean;
  cypherEffect?: 'minor' | 'major' | 'gm-intrusion';
} {
  const analysis = {
    critical: false,
    fumble: false,
    cypherEffect: undefined as 'minor' | 'major' | 'gm-intrusion' | undefined,
  };

  switch (gameSystem) {
    case 'cypher':
      // Cypher System: 1 = GM intrusion, 17 = minor effect, 18-19 = major effect, 20 = free intrusion
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
      // Call of Cthulhu: 1 = critical success, 100 = fumble (for d100)
      // For d20: 1 = fumble in some variants
      if (result === 1) {
        analysis.fumble = true;
      }
      break;

    case 'dnd5e':
    case 'dnd5e-2024':
    case 'pf2e':
    default:
      // Standard d20 games: 20 = crit, 1 = fumble
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
 * Generate a unique roll ID
 */
export function generateRollId(platform: VTTPlatform): string {
  return `${platform}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Convert raw roll data to unified VTTRoll format
 */
export function convertToVTTRoll(
  platform: VTTPlatform,
  data: {
    expression: string;
    results: number[];
    total: number;
    rollerId?: string;
    rollerName?: string;
    characterName?: string;
    label?: string;
    rollType?: VTTRoll['rollType'];
    raw?: unknown;
  },
  context?: {
    sheetType?: string;
    systemId?: string;
    rollTemplate?: string;
  }
): VTTRoll {
  const gameSystem = detectGameSystem({}, context);

  // Check for d20 results
  const dice = parseDiceExpression(data.expression);
  const hasD20 = dice.some(d => d.sides === 20);

  let critical = false;
  let fumble = false;
  let cypherEffect: VTTRoll['cypherEffect'];

  if (hasD20 && data.results.length > 0) {
    // Find the d20 result (usually first die)
    const d20Result = data.results[0];
    const analysis = analyzeD20Roll(d20Result, gameSystem);
    critical = analysis.critical;
    fumble = analysis.fumble;
    cypherEffect = analysis.cypherEffect;
  }

  return {
    id: generateRollId(platform),
    platform,
    gameSystem,
    timestamp: new Date(),
    roller: {
      id: data.rollerId || 'unknown',
      name: data.rollerName || 'Unknown',
    },
    expression: data.expression,
    results: data.results,
    total: data.total,
    label: data.label,
    characterName: data.characterName,
    rollType: data.rollType,
    critical,
    fumble,
    cypherEffect,
    raw: data.raw,
  };
}

/**
 * DOM Selectors for different VTT platforms and game systems
 * Inspired by Beyond20 and dddice
 */
export const ROLL_SELECTORS = {
  roll20: {
    chat: '#textchat .content',
    message: '.message',
    rollResult: '.message.rollresult',
    inlineRoll: '.inlinerollresult',
    formula: '.formula',
    diceRoll: '.diceroll',
    didRoll: '.didroll',
    // Game-specific
    cypher: '.sheet-coc-roll__container, [class*="cypher"], [class*="numenera"]',
    dnd2024: '.dnd-2024--roll',
  },
  foundry: {
    chat: '#chat-log',
    message: '.chat-message',
    rollResult: '.dice-roll',
    formula: '.dice-formula',
    total: '.dice-total',
    dice: '.die',
    // Cypher System module selectors
    cypherRoll: '.cypher-roll, .cyphersystem .dice-roll',
    cypherTotal: '.cypher-total, .roll-total',
  },
  dndbeyond: {
    diceNotification: '.dice_notification_controls',
    diceResult: '.dice_result',
    diceNotation: '.dice_notation',
    diceTotal: '.dice_result__total-result',
  },
};
