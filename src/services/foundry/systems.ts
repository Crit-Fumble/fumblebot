/**
 * Foundry VTT Game Systems
 *
 * Curated list of popular game systems available in Foundry VTT.
 * Foundry doesn't expose a public API for their package registry,
 * so we maintain this list manually.
 *
 * TODO: In the future, we could sync this from a running Foundry instance
 * via the Setup API or by reading the installed systems.
 */

export interface FoundrySystem {
  id: string;
  name: string;
  description: string;
  manifest?: string; // URL to system.json manifest
  version?: string;
  compatibility?: {
    minimum?: string;
    verified?: string;
    maximum?: string;
  };
}

/**
 * Popular/supported game systems
 * These are the most commonly used systems in Foundry VTT
 */
export const FOUNDRY_SYSTEMS: FoundrySystem[] = [
  {
    id: 'dnd5e',
    name: 'D&D 5th Edition',
    description: 'The official system for playing Dungeons & Dragons 5th Edition.',
    manifest: 'https://raw.githubusercontent.com/foundryvtt/dnd5e/releases/latest/download/system.json',
  },
  {
    id: 'pf2e',
    name: 'Pathfinder 2nd Edition',
    description: 'The premier system for playing Pathfinder Second Edition.',
    manifest: 'https://github.com/foundryvtt/pf2e/releases/latest/download/system.json',
  },
  {
    id: 'pf1',
    name: 'Pathfinder 1st Edition',
    description: 'A system for playing Pathfinder First Edition.',
  },
  {
    id: 'dnd4e',
    name: 'D&D 4th Edition',
    description: 'A community system for D&D 4th Edition.',
  },
  {
    id: 'archmage',
    name: '13th Age',
    description: 'The official system for 13th Age RPG.',
  },
  {
    id: 'swade',
    name: 'Savage Worlds Adventure Edition',
    description: 'The official system for Savage Worlds Adventure Edition.',
  },
  {
    id: 'coc7',
    name: 'Call of Cthulhu 7th Edition',
    description: 'The official system for Call of Cthulhu 7th Edition.',
  },
  {
    id: 'wfrp4e',
    name: 'Warhammer Fantasy 4th Edition',
    description: 'The official system for Warhammer Fantasy Roleplay 4th Edition.',
  },
  {
    id: 'alienrpg',
    name: 'Alien RPG',
    description: 'The official system for the Alien RPG.',
  },
  {
    id: 'blades-in-the-dark',
    name: 'Blades in the Dark',
    description: 'A system for Blades in the Dark.',
  },
  {
    id: 'starfinder',
    name: 'Starfinder',
    description: 'A system for Starfinder RPG.',
  },
  {
    id: 'cyberpunk-red-core',
    name: 'Cyberpunk RED',
    description: 'The official system for Cyberpunk RED.',
  },
  {
    id: 'worldbuilding',
    name: 'Simple Worldbuilding',
    description: 'A flexible system for creating custom game worlds.',
  },
  {
    id: 'fate',
    name: 'Fate Core',
    description: 'A system for Fate Core and Fate Accelerated.',
  },
  {
    id: 'gurps',
    name: 'GURPS 4th Edition',
    description: 'A system for GURPS 4th Edition.',
  },
  {
    id: 'shadowrun5e',
    name: 'Shadowrun 5th Edition',
    description: 'A system for Shadowrun 5th Edition.',
  },
  {
    id: 'dcc',
    name: 'Dungeon Crawl Classics',
    description: 'A system for Dungeon Crawl Classics RPG.',
  },
  {
    id: 'ose',
    name: 'Old-School Essentials',
    description: 'A system for Old-School Essentials.',
  },
  {
    id: 'forbidden-lands',
    name: 'Forbidden Lands',
    description: 'The official system for Forbidden Lands.',
  },
  {
    id: 'lancer',
    name: 'Lancer',
    description: 'A system for Lancer, the mech combat RPG.',
  },
];

/**
 * Get all available systems
 */
export function getAllSystems(): FoundrySystem[] {
  return FOUNDRY_SYSTEMS;
}

/**
 * Get a system by ID
 */
export function getSystemById(id: string): FoundrySystem | undefined {
  return FOUNDRY_SYSTEMS.find(s => s.id === id);
}

/**
 * Search systems by name
 */
export function searchSystems(query: string): FoundrySystem[] {
  const lowerQuery = query.toLowerCase();
  return FOUNDRY_SYSTEMS.filter(s =>
    s.id.toLowerCase().includes(lowerQuery) ||
    s.name.toLowerCase().includes(lowerQuery) ||
    s.description.toLowerCase().includes(lowerQuery)
  );
}
