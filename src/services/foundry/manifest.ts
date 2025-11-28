/**
 * Foundry VTT Manifest Parser
 *
 * Fetches and parses Foundry VTT system manifest files (system.json)
 * These manifests contain metadata about game systems like D&D 5e, Pathfinder, etc.
 */

/**
 * Author information from a Foundry manifest
 */
export interface ManifestAuthor {
  name: string;
  url?: string;
  email?: string;
  discord?: string;
}

/**
 * Foundry version compatibility information
 */
export interface ManifestCompatibility {
  minimum?: string;
  verified?: string;
  maximum?: string;
}

/**
 * Parsed Foundry VTT system manifest
 */
export interface FoundryManifest {
  id: string;
  name?: string; // Some manifests use 'name' instead of 'id'
  title: string;
  description?: string;
  version?: string;
  compatibility?: ManifestCompatibility;
  authors?: ManifestAuthor[];
  manifest?: string; // Self-referential manifest URL
  download?: string; // Download URL for the system
  url?: string; // Project homepage
  license?: string;
  readme?: string;
  bugs?: string;
  changelog?: string;
}

/**
 * Result of parsing a manifest
 * Maps to FoundrySystem model in Prisma
 */
export interface ParsedManifest {
  systemId: string;
  title: string;
  description?: string;
  version?: string;
  compatibility?: ManifestCompatibility;
  authors?: ManifestAuthor[];
  manifestUrl: string;
}

/**
 * Validates that a URL looks like a Foundry manifest URL
 */
export function isValidManifestUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Must be HTTPS (or HTTP for local dev)
    if (!['https:', 'http:'].includes(parsed.protocol)) {
      return false;
    }
    // Should end in .json or system.json
    const pathname = parsed.pathname.toLowerCase();
    if (!pathname.endsWith('.json')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetches and parses a Foundry system manifest from a URL
 *
 * @param url - The URL to the system.json manifest file
 * @param timeout - Request timeout in milliseconds (default: 10000)
 * @returns Parsed manifest data
 * @throws Error if fetch fails or manifest is invalid
 */
export async function fetchAndParseManifest(
  url: string,
  timeout: number = 10000
): Promise<ParsedManifest> {
  if (!isValidManifestUrl(url)) {
    throw new Error('Invalid manifest URL. Must be an HTTPS URL ending in .json');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'FumbleBot/1.0',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch manifest: HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && !contentType.includes('application/json') && !contentType.includes('text/plain')) {
      throw new Error(`Invalid content type: ${contentType}. Expected JSON.`);
    }

    const manifest = (await response.json()) as FoundryManifest;

    // Validate required fields
    const systemId = manifest.id || manifest.name;
    if (!systemId) {
      throw new Error('Manifest missing required field: id or name');
    }

    if (!manifest.title) {
      throw new Error('Manifest missing required field: title');
    }

    return {
      systemId,
      title: manifest.title,
      description: manifest.description,
      version: manifest.version,
      compatibility: manifest.compatibility,
      authors: manifest.authors,
      manifestUrl: url,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error(`Manifest fetch timed out after ${timeout}ms`);
      }
      throw error;
    }
    throw new Error('Unknown error fetching manifest');
  }
}

/**
 * Seed manifest URLs for common systems
 * These can be used to pre-populate the system registry
 */
export const SEED_MANIFESTS = {
  // D&D 5th Edition (Official)
  dnd5e: 'https://github.com/foundryvtt/dnd5e/releases/latest/download/system.json',

  // Cypher System (Numenera, The Strange, etc.)
  cyphersystem: 'https://raw.githubusercontent.com/mrkwnzl/cyphersystem-foundryvtt/main/system.json',

  // Pathfinder 2e (Official)
  pf2e: 'https://github.com/foundryvtt/pf2e/releases/latest/download/system.json',
} as const;

/**
 * Attempts to fetch a manifest, returning null on failure instead of throwing
 */
export async function tryFetchManifest(url: string): Promise<ParsedManifest | null> {
  try {
    return await fetchAndParseManifest(url);
  } catch {
    return null;
  }
}
