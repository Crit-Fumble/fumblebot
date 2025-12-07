/**
 * Game System Detector
 * Detects TTRPG game systems from message content
 */

import type { GameSystem } from './types.js'

export interface DetectionResult {
  system: GameSystem | null
  confidence: number
  reason: string
  isExplicit: boolean
}

// Explicit system declarations - high confidence
const EXPLICIT_PATTERNS: Array<{ pattern: RegExp; system: GameSystem }> = [
  // D&D 5e
  { pattern: /\b(we('re| are)|i('m| am)|playing|using|running)\s+(5e|5th edition|dnd 5e?|d&d 5e?)\b/i, system: '5e' },
  { pattern: /\b(switch(ing)?|change|chang(ing)?)\s+to\s+(5e|5th edition)\b/i, system: '5e' },

  // Pathfinder 2e
  { pattern: /\b(we('re| are)|i('m| am)|playing|using|running)\s+(pf2e?|pathfinder 2e?|pathfinder (2nd|second) edition)\b/i, system: 'pf2e' },
  { pattern: /\b(switch(ing)?|change|chang(ing)?)\s+to\s+(pf2e?|pathfinder 2)\b/i, system: 'pf2e' },

  // Pathfinder 1e
  { pattern: /\b(we('re| are)|i('m| am)|playing|using|running)\s+(pf1e?|pathfinder 1e?|pathfinder (1st|first) edition)\b/i, system: 'pf1e' },

  // Cypher System
  { pattern: /\b(we('re| are)|i('m| am)|playing|using|running)\s+(cypher|numenera|the strange)\b/i, system: 'cypher' },
  { pattern: /\b(switch(ing)?|change|chang(ing)?)\s+to\s+(cypher|numenera)\b/i, system: 'cypher' },

  // Blades in the Dark
  { pattern: /\b(we('re| are)|i('m| am)|playing|using|running)\s+(blades|bitd|blades in the dark|scum and villainy)\b/i, system: 'bitd' },

  // Stars Without Number
  { pattern: /\b(we('re| are)|i('m| am)|playing|using|running)\s+(swn|stars without number|worlds without number)\b/i, system: 'swn' },

  // Call of Cthulhu
  { pattern: /\b(we('re| are)|i('m| am)|playing|using|running)\s+(coc|call of cthulhu|delta green)\b/i, system: 'coc' },

  // Mothership
  { pattern: /\b(we('re| are)|i('m| am)|playing|using|running)\s+(mothership)\b/i, system: 'mothership' },

  // FATE
  { pattern: /\b(we('re| are)|i('m| am)|playing|using|running)\s+(fate|fate core|fate accelerated|fae)\b/i, system: 'fate' },

  // PbtA
  { pattern: /\b(we('re| are)|i('m| am)|playing|using|running)\s+(pbta|powered by the apocalypse|apocalypse world|monster of the week|dungeon world)\b/i, system: 'pbta' },

  // Savage Worlds
  { pattern: /\b(we('re| are)|i('m| am)|playing|using|running)\s+(savage worlds|deadlands|rifts savage)\b/i, system: 'savage' },

  // DCC
  { pattern: /\b(we('re| are)|i('m| am)|playing|using|running)\s+(dcc|dungeon crawl classics)\b/i, system: 'dcc' },

  // OSR
  { pattern: /\b(we('re| are)|i('m| am)|playing|using|running)\s+(osr|old school|ose|old school essentials|b\/x|basic|expert|becmi)\b/i, system: 'osr' },
]

// System-specific terminology - medium confidence
const TERMINOLOGY_PATTERNS: Array<{ patterns: RegExp[]; system: GameSystem; confidence: number }> = [
  // D&D 5e specific
  {
    system: '5e',
    confidence: 0.7,
    patterns: [
      /\b(advantage|disadvantage)\b/i,
      /\b(action surge|second wind|fighting style)\b/i,
      /\b(bardic inspiration|cutting words)\b/i,
      /\b(eldritch blast|agonizing blast)\b/i,
      /\b(sneak attack|cunning action)\b/i,
      /\b(wild shape|circle of)\b/i,
      /\b(concentration)\s+(check|save)\b/i,
      /\b(death saving throw|death save)\b/i,
      /\bshort rest|long rest\b/i,
      /\b(spell slot|cantrip)\b/i,
    ],
  },

  // Pathfinder 2e specific
  {
    system: 'pf2e',
    confidence: 0.75,
    patterns: [
      /\b(three action|3[- ]action)\b/i,
      /\b(hero point)\b/i,
      /\b(ancestry|heritage)\b/i,
      /\b(focus (point|spell))\b/i,
      /\b(recall knowledge)\b/i,
      /\b(degrees? of (success|failure))\b/i,
      /\b(critical success|critical failure)\b/i,
      /\bexploration (mode|activity)\b/i,
      /\bdowntime (mode|activity)\b/i,
    ],
  },

  // Cypher System specific
  {
    system: 'cypher',
    confidence: 0.8,
    patterns: [
      /\b(effort)\b/i,
      /\b(might|speed|intellect)\s+(pool|edge)\b/i,
      /\b(cypher limit)\b/i,
      /\b(gm intrusion)\b/i,
      /\b(descriptor|type|focus)\b/i,
      /\b(nano|glaive|jack)\b/i,
      /\bthe ninth world\b/i,
      /\b(numenera|oddity|artifact)\b/i,
    ],
  },

  // Blades in the Dark specific
  {
    system: 'bitd',
    confidence: 0.8,
    patterns: [
      /\b(stress|trauma)\b/i,
      /\b(position|effect)\b/i,
      /\b(desperate|risky|controlled)\b/i,
      /\b(limited|standard|great)\s+effect\b/i,
      /\b(flashback)\b/i,
      /\b(downtime|coin|heat)\b/i,
      /\b(crew (sheet|type)|playbook)\b/i,
      /\b(devil's bargain)\b/i,
      /\b(action roll|resistance roll)\b/i,
    ],
  },

  // Call of Cthulhu specific
  {
    system: 'coc',
    confidence: 0.8,
    patterns: [
      /\b(sanity|san (loss|check|roll))\b/i,
      /\b(luck (point|roll))\b/i,
      /\b(mythos|cthulhu)\b/i,
      /\b(investigator)\b/i,
      /\b(hard success|extreme success)\b/i,
      /\b(pushed roll)\b/i,
      /\b(credit rating)\b/i,
    ],
  },

  // FATE specific
  {
    system: 'fate',
    confidence: 0.75,
    patterns: [
      /\b(fate point|aspect)\b/i,
      /\b(invoke|compel)\b/i,
      /\b(approach|skill)\s+(pyramid|column)\b/i,
      /\b(stress|consequence)\b/i,
      /\b(fudge dice|\+4|\-4)\b/i,
      /\b(create advantage|overcome|attack|defend)\b/i,
    ],
  },

  // PbtA specific
  {
    system: 'pbta',
    confidence: 0.7,
    patterns: [
      /\b(move)\b.*\b(trigger)\b/i,
      /\b(2d6\s*\+)\b/i,
      /\b(10\+|7-9|6-)\b/i,
      /\b(mark (xp|experience))\b/i,
      /\b(bonds?|strings?)\b/i,
      /\b(hard move|soft move)\b/i,
    ],
  },

  // Savage Worlds specific
  {
    system: 'savage',
    confidence: 0.75,
    patterns: [
      /\b(bennies?|benny)\b/i,
      /\b(wild die)\b/i,
      /\b(raise|success with raise)\b/i,
      /\b(shaken|wound)\b/i,
      /\b(trait die|skill die)\b/i,
      /\b(edges?|hindrances?)\b/i,
    ],
  },
]

/**
 * Detect game system from message content
 */
export function detectGameSystem(content: string): DetectionResult {
  // First check for explicit declarations
  for (const { pattern, system } of EXPLICIT_PATTERNS) {
    if (pattern.test(content)) {
      return {
        system,
        confidence: 1.0,
        reason: `Explicit mention of ${system}`,
        isExplicit: true,
      }
    }
  }

  // Check for system-specific terminology
  const termMatches: Array<{ system: GameSystem; confidence: number; matches: number }> = []

  for (const { patterns, system, confidence } of TERMINOLOGY_PATTERNS) {
    let matches = 0
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        matches++
      }
    }

    if (matches > 0) {
      // Boost confidence with multiple matches
      const boostedConfidence = Math.min(confidence + matches * 0.05, 0.95)
      termMatches.push({ system, confidence: boostedConfidence, matches })
    }
  }

  if (termMatches.length > 0) {
    // Sort by matches first, then by confidence
    termMatches.sort((a, b) => {
      if (b.matches !== a.matches) return b.matches - a.matches
      return b.confidence - a.confidence
    })

    const best = termMatches[0]
    return {
      system: best.system,
      confidence: best.confidence,
      reason: `Detected ${best.matches} ${best.system}-specific term(s)`,
      isExplicit: false,
    }
  }

  return {
    system: null,
    confidence: 0,
    reason: 'No game system detected',
    isExplicit: false,
  }
}

/**
 * Check if content suggests a different game system than the current one
 */
export function detectSystemSwitch(
  content: string,
  currentSystem: GameSystem | null
): DetectionResult | null {
  const detection = detectGameSystem(content)

  // Only return if we detected a different system with high confidence
  if (
    detection.system &&
    detection.system !== currentSystem &&
    (detection.isExplicit || detection.confidence >= 0.7)
  ) {
    return detection
  }

  return null
}

/**
 * Extract conversation topics from content
 */
export function extractTopics(content: string): string[] {
  const topics: string[] = []

  // Combat-related
  if (/\b(combat|fight|attack|damage|initiative|battle)\b/i.test(content)) {
    topics.push('combat')
  }

  // Spells/Magic
  if (/\b(spell|magic|cast|cantrip|ritual|arcane|divine)\b/i.test(content)) {
    topics.push('magic')
  }

  // Character creation
  if (/\b(character|build|create|level up|multiclass|feat|ability score)\b/i.test(content)) {
    topics.push('character-creation')
  }

  // Rules questions
  if (/\b(how (does|do)|rules?|mechanic|work|clarif|explain)\b/i.test(content)) {
    topics.push('rules')
  }

  // Lore/Story
  if (/\b(lore|history|story|world|setting|god|deity|faction|kingdom)\b/i.test(content)) {
    topics.push('lore')
  }

  // Monsters/Creatures
  if (/\b(monster|creature|enemy|npc|boss|encounter)\b/i.test(content)) {
    topics.push('monsters')
  }

  // Items/Equipment
  if (/\b(item|equipment|weapon|armor|treasure|loot|magic item)\b/i.test(content)) {
    topics.push('items')
  }

  // GM/DM tools
  if (/\b(dm|gm|dungeon master|game master|prep|session|campaign)\b/i.test(content)) {
    topics.push('gm-tools')
  }

  return topics
}

/**
 * Get human-readable name for a game system
 */
export function getSystemDisplayName(system: GameSystem): string {
  const names: Record<GameSystem, string> = {
    '5e': 'D&D 5th Edition',
    'pf2e': 'Pathfinder 2nd Edition',
    'pf1e': 'Pathfinder 1st Edition',
    'cypher': 'Cypher System',
    'bitd': 'Blades in the Dark',
    'swn': 'Stars Without Number',
    'mothership': 'Mothership',
    'coc': 'Call of Cthulhu',
    'fate': 'Fate Core',
    'pbta': 'Powered by the Apocalypse',
    'savage': 'Savage Worlds',
    'dcc': 'Dungeon Crawl Classics',
    'osr': 'Old School Renaissance',
    'other': 'Other System',
  }

  return names[system] || system
}

/**
 * Get the list of all supported game systems
 */
export function getSupportedSystems(): Array<{ id: GameSystem; name: string }> {
  const systems: GameSystem[] = [
    '5e', 'pf2e', 'pf1e', 'cypher', 'bitd', 'swn',
    'mothership', 'coc', 'fate', 'pbta', 'savage', 'dcc', 'osr', 'other',
  ]

  return systems.map(id => ({ id, name: getSystemDisplayName(id) }))
}
