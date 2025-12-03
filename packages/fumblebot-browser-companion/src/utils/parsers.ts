/**
 * Roll Parsers
 *
 * Utilities to parse dice roll data from various VTT platforms
 * into a standardized format.
 */

import type { VTTRoll } from '../types';

/**
 * Parse a Roll20 roll result
 */
export function parseRoll20Roll(data: {
  expression: string;
  results: Array<{ v: number }>;
  total: number;
  playerid?: string;
  playername?: string;
  content?: string;
}): Partial<VTTRoll> {
  const results = data.results?.map((r) => r.v) || [];

  // Check for d20 rolls
  const isD20Roll = data.expression?.includes('d20');
  const hasCritical = isD20Roll && results.includes(20);
  const hasFumble = isD20Roll && results.includes(1);

  return {
    platform: 'roll20',
    expression: data.expression,
    results,
    total: data.total,
    roller: {
      id: data.playerid || 'unknown',
      name: data.playername || 'Unknown',
    },
    critical: hasCritical,
    fumble: hasFumble,
    raw: data,
  };
}

/**
 * Parse a D&D Beyond roll result
 */
export function parseDndBeyondRoll(data: {
  diceNotation: string;
  diceNotationStr?: string;
  result: {
    total: number;
    values: number[];
  };
  rollType?: string;
  rollKind?: string;
}): Partial<VTTRoll> {
  const results = data.result?.values || [];
  const expression = data.diceNotationStr || data.diceNotation;

  // Determine roll type
  let rollType: VTTRoll['rollType'] = 'custom';
  if (data.rollType) {
    const type = data.rollType.toLowerCase();
    if (type.includes('attack')) rollType = 'attack';
    else if (type.includes('damage')) rollType = 'damage';
    else if (type.includes('save') || type.includes('saving')) rollType = 'save';
    else if (type.includes('check') || type.includes('ability')) rollType = 'check';
  }

  // Check for critical/fumble based on rollKind or results
  const isCritical = data.rollKind === 'critical-hit' || (rollType === 'attack' && results[0] === 20);
  const isFumble = data.rollKind === 'critical-fail' || (rollType === 'attack' && results[0] === 1);

  return {
    platform: 'dndbeyond',
    expression,
    results,
    total: data.result?.total || 0,
    rollType,
    critical: isCritical,
    fumble: isFumble,
    raw: data,
  };
}

/**
 * Parse a Foundry VTT roll result
 */
export function parseFoundryRoll(data: {
  formula: string;
  total: number;
  dice: Array<{
    faces: number;
    results: Array<{ result: number; active?: boolean }>;
  }>;
  options?: {
    flavor?: string;
    critical?: number;
    fumble?: number;
  };
}): Partial<VTTRoll> {
  // Extract all active die results
  const results: number[] = [];
  data.dice?.forEach((die) => {
    die.results?.forEach((r) => {
      if (r.active !== false) {
        results.push(r.result);
      }
    });
  });

  // Check for critical/fumble
  const critThreshold = data.options?.critical || 20;
  const fumbleThreshold = data.options?.fumble || 1;

  // Only check d20s for crit/fumble
  const d20Dice = data.dice?.find((d) => d.faces === 20);
  const d20Results = d20Dice?.results?.filter((r) => r.active !== false).map((r) => r.result) || [];

  const hasCritical = d20Results.some((r) => r >= critThreshold);
  const hasFumble = d20Results.some((r) => r <= fumbleThreshold);

  return {
    platform: 'foundry',
    expression: data.formula,
    results,
    total: data.total,
    label: data.options?.flavor,
    critical: hasCritical,
    fumble: hasFumble,
    raw: data,
  };
}

/**
 * Detect which VTT platform a roll came from and parse it
 */
export function parseUnknownRoll(data: unknown): Partial<VTTRoll> | null {
  if (!data || typeof data !== 'object') return null;

  const obj = data as Record<string, unknown>;

  // Roll20 detection
  if ('playerid' in obj || (Array.isArray(obj.results) && obj.results[0]?.v !== undefined)) {
    return parseRoll20Roll(obj as Parameters<typeof parseRoll20Roll>[0]);
  }

  // D&D Beyond detection
  if ('diceNotation' in obj || 'rollType' in obj) {
    return parseDndBeyondRoll(obj as Parameters<typeof parseDndBeyondRoll>[0]);
  }

  // Foundry detection
  if ('formula' in obj && 'dice' in obj) {
    return parseFoundryRoll(obj as Parameters<typeof parseFoundryRoll>[0]);
  }

  return null;
}
