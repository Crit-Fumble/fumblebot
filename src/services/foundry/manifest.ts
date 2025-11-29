/**
 * Foundry VTT Manifest Parser
 * Utilities for fetching and parsing Foundry VTT system manifests
 */

/**
 * Foundry VTT manifest structure
 */
export interface FoundryManifest {
  systemId: string;
  title: string;
  description?: string;
  version?: string;
  manifestUrl: string;
  compatibility?: {
    minimum?: string;
    verified?: string;
    maximum?: string;
  };
  authors?: Array<{
    name: string;
    url?: string;
    email?: string;
    discord?: string;
  }>;
  url?: string;
  manifest?: string;
  download?: string;
}

/**
 * Validate manifest URL format
 */
export function isValidManifestUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      parsed.pathname.endsWith('.json')
    );
  } catch {
    return false;
  }
}

/**
 * Fetch and parse a Foundry VTT system manifest
 */
export async function fetchAndParseManifest(manifestUrl: string): Promise<FoundryManifest> {
  if (!isValidManifestUrl(manifestUrl)) {
    throw new Error('Invalid manifest URL: must be HTTPS and end with .json');
  }

  const response = await fetch(manifestUrl, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'FumbleBot/1.0 (https://fumblebot.crit-fumble.com)',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch manifest: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Validate required fields
  const systemId = data.id || data.name;
  if (!systemId) {
    throw new Error('Manifest missing required field: id or name');
  }

  const title = data.title || data.name || systemId;

  return {
    systemId,
    title,
    description: data.description,
    version: data.version,
    manifestUrl,
    compatibility: data.compatibility,
    authors: data.authors,
    url: data.url,
    manifest: data.manifest,
    download: data.download,
  };
}

/**
 * Popular Foundry VTT system manifests for seeding
 */
export const SEED_MANIFESTS: Record<string, string> = {
  // D&D 5e
  'dnd5e': 'https://raw.githubusercontent.com/foundryvtt/dnd5e/master/system.json',

  // Pathfinder 2e
  'pf2e': 'https://raw.githubusercontent.com/foundryvtt/pf2e/master/system.json',

  // Pathfinder 1e
  'pf1': 'https://raw.githubusercontent.com/foundryvtt/pf1/master/system.json',

  // Call of Cthulhu 7e
  'CoC7': 'https://raw.githubusercontent.com/Miskatonic-Investigative-Society/CoC7-FoundryVTT/main/system.json',

  // Savage Worlds Adventure Edition
  'swade': 'https://raw.githubusercontent.com/FloRad/swade/main/system.json',

  // Warhammer Fantasy 4e
  'wfrp4e': 'https://raw.githubusercontent.com/moo-man/WFRP4e-FoundryVTT/master/system.json',

  // Starfinder
  'sfrpg': 'https://raw.githubusercontent.com/foundryvtt-starfinder/foundryvtt-starfinder/master/system.json',

  // Simple Worldbuilding
  'worldbuilding': 'https://raw.githubusercontent.com/foundryvtt/worldbuilding/master/system.json',

  // Blades in the Dark
  'blades-in-the-dark': 'https://raw.githubusercontent.com/megastruktur/bitd/master/system.json',

  // FATE Core
  'fate-core-official': 'https://raw.githubusercontent.com/Fateful-games/fate-core-official/main/system.json',
};
