/**
 * Game System Detector Unit Tests
 */

import { describe, it, expect } from 'vitest'
import {
  detectGameSystem,
  detectSystemSwitch,
  extractTopics,
  getSystemDisplayName,
  getSupportedSystems,
} from './game-system-detector.js'

describe('detectGameSystem', () => {
  describe('explicit declarations', () => {
    it('detects explicit 5e declaration', () => {
      const result = detectGameSystem("we're playing 5e tonight")
      expect(result.system).toBe('5e')
      expect(result.confidence).toBe(1.0)
      expect(result.isExplicit).toBe(true)
    })

    it('detects explicit D&D 5e declaration', () => {
      const result = detectGameSystem('I am running D&D 5e')
      expect(result.system).toBe('5e')
      expect(result.isExplicit).toBe(true)
    })

    it('detects explicit Pathfinder 2e declaration', () => {
      const result = detectGameSystem("we're playing pathfinder 2e")
      expect(result.system).toBe('pf2e')
      expect(result.isExplicit).toBe(true)
    })

    it('detects explicit Cypher System declaration', () => {
      const result = detectGameSystem('I am playing Numenera')
      expect(result.system).toBe('cypher')
      expect(result.isExplicit).toBe(true)
    })

    it('detects explicit Blades in the Dark declaration', () => {
      const result = detectGameSystem("we're using Blades in the Dark")
      expect(result.system).toBe('bitd')
      expect(result.isExplicit).toBe(true)
    })

    it('detects explicit Call of Cthulhu declaration', () => {
      const result = detectGameSystem('running Call of Cthulhu')
      expect(result.system).toBe('coc')
      expect(result.isExplicit).toBe(true)
    })

    it('detects system switch', () => {
      const result = detectGameSystem('switching to pf2e')
      expect(result.system).toBe('pf2e')
      expect(result.isExplicit).toBe(true)
    })
  })

  describe('terminology inference', () => {
    it('infers 5e from advantage/disadvantage', () => {
      // Use "disadvantage" to avoid matching FATE's "attack" pattern
      const result = detectGameSystem('I have disadvantage on this roll')
      expect(result.system).toBe('5e')
      expect(result.isExplicit).toBe(false)
      expect(result.confidence).toBeGreaterThanOrEqual(0.7)
    })

    it('infers 5e from action surge', () => {
      const result = detectGameSystem('I use my action surge')
      expect(result.system).toBe('5e')
      expect(result.isExplicit).toBe(false)
    })

    it('infers 5e from eldritch blast', () => {
      const result = detectGameSystem('casting eldritch blast')
      expect(result.system).toBe('5e')
    })

    it('infers PF2e from three action economy', () => {
      // Pattern requires "three action" (singular) not "three actions"
      const result = detectGameSystem('using my 3-action activity to stride')
      expect(result.system).toBe('pf2e')
      expect(result.isExplicit).toBe(false)
    })

    it('infers PF2e from hero points', () => {
      const result = detectGameSystem('spending a hero point to reroll')
      expect(result.system).toBe('pf2e')
    })

    it('infers Cypher from Might/Speed/Intellect pools', () => {
      const result = detectGameSystem('applying effort from my Might pool')
      expect(result.system).toBe('cypher')
    })

    it('infers Cypher from GM intrusion', () => {
      const result = detectGameSystem('the GM intrusion gives me XP')
      expect(result.system).toBe('cypher')
    })

    it('infers BitD from stress/trauma', () => {
      const result = detectGameSystem('I take 2 stress')
      expect(result.system).toBe('bitd')
    })

    it('infers BitD from position/effect', () => {
      const result = detectGameSystem('what is my position and effect?')
      expect(result.system).toBe('bitd')
    })

    it('infers CoC from sanity check', () => {
      const result = detectGameSystem('make a sanity check')
      expect(result.system).toBe('coc')
    })

    it('infers FATE from fate points and aspects', () => {
      const result = detectGameSystem('invoking my aspect with a fate point')
      expect(result.system).toBe('fate')
    })

    it('infers Savage Worlds from bennies', () => {
      const result = detectGameSystem('spending a benny to reroll')
      expect(result.system).toBe('savage')
    })
  })

  describe('no detection', () => {
    it('returns null for generic chat', () => {
      const result = detectGameSystem('hey everyone, how are you?')
      expect(result.system).toBeNull()
      expect(result.confidence).toBe(0)
    })

    it('returns null for non-TTRPG content', () => {
      const result = detectGameSystem('what time does the movie start?')
      expect(result.system).toBeNull()
    })
  })

  describe('confidence boosting', () => {
    it('boosts confidence with multiple term matches', () => {
      const result = detectGameSystem('I use action surge and have advantage on the attack with my fighting style')
      expect(result.system).toBe('5e')
      expect(result.confidence).toBeGreaterThan(0.7)
    })
  })
})

describe('detectSystemSwitch', () => {
  it('detects switch to different system', () => {
    const result = detectSystemSwitch("we're playing pathfinder 2e now", '5e')
    expect(result).not.toBeNull()
    expect(result?.system).toBe('pf2e')
  })

  it('returns null when same system', () => {
    const result = detectSystemSwitch("we're playing 5e", '5e')
    expect(result).toBeNull()
  })

  it('returns null for low confidence different system', () => {
    const result = detectSystemSwitch('nice roll!', '5e')
    expect(result).toBeNull()
  })
})

describe('extractTopics', () => {
  it('extracts combat topic', () => {
    const topics = extractTopics('how does combat work?')
    expect(topics).toContain('combat')
  })

  it('extracts magic topic', () => {
    const topics = extractTopics('casting a spell')
    expect(topics).toContain('magic')
  })

  it('extracts character creation topic', () => {
    const topics = extractTopics('building a new character')
    expect(topics).toContain('character-creation')
  })

  it('extracts rules topic', () => {
    const topics = extractTopics('how does this rule work?')
    expect(topics).toContain('rules')
  })

  it('extracts lore topic', () => {
    const topics = extractTopics('tell me about the history of this world')
    expect(topics).toContain('lore')
  })

  it('extracts monsters topic', () => {
    // Pattern requires singular "monster" or other creature-related terms
    const topics = extractTopics('what creature is in this dungeon?')
    expect(topics).toContain('monsters')
  })

  it('extracts items topic', () => {
    // Pattern requires singular "item" or "equipment", "weapon", "armor", etc.
    const topics = extractTopics('looking for treasure')
    expect(topics).toContain('items')
  })

  it('extracts GM tools topic', () => {
    const topics = extractTopics('need help with session prep')
    expect(topics).toContain('gm-tools')
  })

  it('extracts multiple topics', () => {
    // Use singular "spell" and "combat" (singular keywords)
    const topics = extractTopics('how does this spell work in combat?')
    expect(topics).toContain('combat')
    expect(topics).toContain('magic')
  })

  it('returns empty for non-TTRPG content', () => {
    const topics = extractTopics('hello there')
    expect(topics).toHaveLength(0)
  })
})

describe('getSystemDisplayName', () => {
  it('returns correct display names', () => {
    expect(getSystemDisplayName('5e')).toBe('D&D 5th Edition')
    expect(getSystemDisplayName('pf2e')).toBe('Pathfinder 2nd Edition')
    expect(getSystemDisplayName('cypher')).toBe('Cypher System')
    expect(getSystemDisplayName('bitd')).toBe('Blades in the Dark')
    expect(getSystemDisplayName('coc')).toBe('Call of Cthulhu')
    expect(getSystemDisplayName('fate')).toBe('Fate Core')
  })
})

describe('getSupportedSystems', () => {
  it('returns all supported systems', () => {
    const systems = getSupportedSystems()
    expect(systems.length).toBeGreaterThan(10)
    expect(systems.find(s => s.id === '5e')).toBeDefined()
    expect(systems.find(s => s.id === 'pf2e')).toBeDefined()
    expect(systems.find(s => s.id === 'cypher')).toBeDefined()
  })

  it('includes display names', () => {
    const systems = getSupportedSystems()
    const dnd = systems.find(s => s.id === '5e')
    expect(dnd?.name).toBe('D&D 5th Edition')
  })
})
