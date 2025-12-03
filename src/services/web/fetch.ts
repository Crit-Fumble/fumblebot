/**
 * Web Fetch Service
 * Fetches content from whitelisted TTRPG websites for FumbleBot
 *
 * Organized sitemap of allowed domains and their sub-sites
 * Categories:
 *   - VTT/Tools: System-agnostic virtual tabletop tools
 *   - D&D 5e (2024): 5.2-compatible sources + D&D setting wikis
 *   - Cypher: Cypher System resources + setting wikis (Old Gus' SRD primary)
 *   - General Lore: Wikipedia for earth-like/historical settings
 */

import { extractContent, type SiteType } from './extractors.js';

/**
 * Sitemap of allowed TTRPG sites organized by category
 * Each entry includes the main domain and any related sub-sites
 */
export const SITE_MAP = {
  // =========================================================================
  // VTT/TOOLS - System-agnostic virtual tabletop tools
  // =========================================================================

  'foundryvtt': {
    category: 'vtt',
    name: 'FoundryVTT',
    description: 'FoundryVTT documentation, API reference, and user guides',
    domains: ['foundryvtt.com', 'www.foundryvtt.com'],
    paths: ['/kb/', '/kb', '/api/', '/api'], // KB + Developer API docs
  },

  // =========================================================================
  // D&D 5e (2024) - Only 5.2-compatible sources
  // =========================================================================

  'dnd5e': {
    category: 'dnd5e',
    name: 'D&D 5e (2024) Resources',
    description: 'D&D 5th Edition (2024 rules) reference sites, tools, and setting wikis',
    domains: ['5e.tools', 'www.5e.tools'], // Primary: 5e.tools (updated for 2024)
    paths: null,
    subsites: {
      'dndbeyond': {
        name: 'D&D Beyond',
        description: 'Official D&D content, character sheets, and compendium (2024)',
        domains: ['dndbeyond.com', 'www.dndbeyond.com'],
        paths: null,
      },
      'dndbeyond-support': {
        name: 'D&D Beyond Support',
        description: 'Help articles, troubleshooting, and FAQ',
        domains: ['dndbeyond-support.wizards.com'],
        paths: ['/hc/'],
      },
      'forgotten-realms': {
        name: 'Forgotten Realms Wiki',
        description: 'Forgotten Realms setting - Faerûn, Sword Coast, Waterdeep',
        domains: ['forgottenrealms.fandom.com'],
        paths: null,
      },
      'eberron': {
        name: 'Eberron Wiki',
        description: 'Eberron setting - magitech, noir, pulp adventure',
        domains: ['eberron.fandom.com'],
        paths: null,
      },
      'dragonlance': {
        name: 'Dragonlance Wiki',
        description: 'Dragonlance - Krynn, dragons, and the War of the Lance',
        domains: ['dragonlance.fandom.com'],
        paths: null,
      },
      'greyhawk': {
        name: 'Greyhawk Wiki',
        description: 'World of Greyhawk - Oerth, classic D&D setting',
        domains: ['greyhawk.fandom.com'],
        paths: null,
      },
    },
  },

  // =========================================================================
  // CYPHER SYSTEM - Monte Cook Games
  // =========================================================================

  'cypher': {
    category: 'cypher',
    name: 'Cypher System',
    description: 'Cypher System rules, abilities, types, foci, and setting wikis',
    domains: ['callmepartario.github.io'], // Primary: Old Gus' Cypher SRD
    paths: ['/og-csrd/'],
    subsites: {
      'cypher-tools': {
        name: 'Cypher System Tools',
        description: 'Official Cypher System tools and reference',
        domains: ['tools.cypher-system.com'],
        paths: null,
      },
      'weird-west': {
        name: 'The Weird West',
        description: 'Weird West Cypher setting - supernatural western',
        domains: ['theweirdwest.wikidot.com'],
        paths: null,
      },
    },
  },

  // =========================================================================
  // GENERAL LORE - System-agnostic reference (earth-like settings)
  // =========================================================================

  'lore': {
    category: 'lore',
    name: 'General Reference',
    description: 'Real-world reference for earth-like or historical settings',
    domains: ['en.wikipedia.org'], // Primary: Wikipedia
    paths: ['/wiki/'],
  },
} as const;

/** Flatten all allowed domains from the sitemap */
function getAllowedDomainsFromSitemap(): string[] {
  const domains: string[] = [];

  for (const site of Object.values(SITE_MAP)) {
    domains.push(...site.domains);
    if ('subsites' in site && site.subsites) {
      for (const subsite of Object.values(site.subsites)) {
        domains.push(...subsite.domains);
      }
    }
  }

  return domains;
}

/** Legacy export for backwards compatibility */
export const ALLOWED_DOMAINS = getAllowedDomainsFromSitemap();

/** Result of a web fetch operation */
export interface WebFetchResult {
  success: boolean;
  content?: string;
  title?: string;
  source?: string;
  error?: string;
  cached?: boolean;
}

/** Options for web fetch */
export interface WebFetchOptions {
  /** Specific query to extract from the page */
  query?: string;
  /** Site type hint for better parsing */
  siteType?: SiteType;
  /** Skip cache and fetch fresh */
  skipCache?: boolean;
}

/** Cache entry */
interface CacheEntry {
  content: string;
  title: string;
  timestamp: number;
}

/**
 * Web Fetch Service
 * Provides controlled access to external TTRPG websites
 */
export class WebFetchService {
  private static instance: WebFetchService | null = null;
  private cache: Map<string, CacheEntry> = new Map();
  private readonly cacheTTL = 15 * 60 * 1000; // 15 minutes
  private readonly maxCacheSize = 100;
  private readonly requestTimeout = 10000; // 10 seconds
  private readonly userAgent = 'FumbleBot/1.0 (TTRPG Assistant; +https://crit-fumble.com)';

  private constructor() {}

  static getInstance(): WebFetchService {
    if (!WebFetchService.instance) {
      WebFetchService.instance = new WebFetchService();
    }
    return WebFetchService.instance;
  }

  /**
   * Check if a URL is allowed to be fetched
   * Uses the SITE_MAP to validate both domain and path restrictions
   */
  isAllowed(url: string): boolean {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();
      const pathname = parsed.pathname;

      // Check each site in the sitemap
      for (const site of Object.values(SITE_MAP)) {
        // Check main site domains
        if (site.domains.some(d => hostname === d || hostname.endsWith('.' + d))) {
          // If paths is null, all paths allowed
          if (site.paths === null) return true;
          // Check if pathname matches any allowed path
          if (site.paths.some(p => pathname.startsWith(p))) return true;
        }

        // Check subsites
        if ('subsites' in site && site.subsites) {
          for (const subsite of Object.values(site.subsites)) {
            if (subsite.domains.some(d => hostname === d || hostname.endsWith('.' + d))) {
              if (subsite.paths === null) return true;
              if (subsite.paths.some(p => pathname.startsWith(p))) return true;
            }
          }
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Get the list of allowed domains for error messages
   */
  getAllowedDomainsMessage(): string {
    const sites: string[] = [];

    for (const site of Object.values(SITE_MAP)) {
      const mainDomain = site.domains[0];
      const pathSuffix = site.paths ? site.paths[0] : '';
      sites.push(mainDomain + pathSuffix);

      if ('subsites' in site && site.subsites) {
        for (const subsite of Object.values(site.subsites)) {
          const subDomain = subsite.domains[0];
          const subPath = subsite.paths ? subsite.paths[0] : '';
          sites.push(subDomain + subPath);
        }
      }
    }

    return sites.join(', ');
  }

  /**
   * Get the full sitemap for documentation/help
   */
  getSiteMap(): typeof SITE_MAP {
    return SITE_MAP;
  }

  /**
   * Detect site type from URL
   */
  private detectSiteType(url: string): SiteType {
    const hostname = new URL(url).hostname.toLowerCase();

    if (hostname.includes('5e.tools')) return '5etools';
    if (hostname.includes('dndbeyond')) return 'dndbeyond';
    if (hostname.includes('foundryvtt')) return 'foundryvtt';
    if (hostname.includes('cypher')) return 'cypher';

    return 'general';
  }

  /**
   * Fetch and extract content from a URL
   */
  async fetch(url: string, options: WebFetchOptions = {}): Promise<WebFetchResult> {
    // Validate URL
    if (!this.isAllowed(url)) {
      return {
        success: false,
        error: `URL not allowed. FumbleBot can only access: ${this.getAllowedDomainsMessage()}`,
      };
    }

    // Check cache
    const cacheKey = `${url}:${options.query || ''}`;
    if (!options.skipCache) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return {
          success: true,
          content: cached.content,
          title: cached.title,
          source: url,
          cached: true,
        };
      }
    }

    try {
      // Fetch the page
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch: HTTP ${response.status} ${response.statusText}`,
          source: url,
        };
      }

      const html = await response.text();

      // Detect site type
      const siteType = options.siteType || this.detectSiteType(url);

      // Extract content
      const extracted = extractContent(html, url, siteType, options.query);

      // Cache the result
      this.addToCache(cacheKey, {
        content: extracted.content,
        title: extracted.title,
        timestamp: Date.now(),
      });

      return {
        success: true,
        content: extracted.content,
        title: extracted.title,
        source: url,
        cached: false,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            error: `Request timed out after ${this.requestTimeout / 1000} seconds`,
            source: url,
          };
        }
        return {
          success: false,
          error: `Fetch error: ${error.message}`,
          source: url,
        };
      }
      return {
        success: false,
        error: 'Unknown fetch error',
        source: url,
      };
    }
  }

  /**
   * Search 5e.tools for D&D 5e content
   */
  async search5eTools(query: string, category: string = 'spells'): Promise<WebFetchResult> {
    const categoryMap: Record<string, string> = {
      spells: 'spells.html',
      items: 'items.html',
      bestiary: 'bestiary.html',
      monsters: 'bestiary.html',
      classes: 'classes.html',
      races: 'races.html',
      feats: 'feats.html',
      backgrounds: 'backgrounds.html',
      conditions: 'conditionsdiseases.html',
      rules: 'variantrules.html',
    };

    const page = categoryMap[category.toLowerCase()] || 'spells.html';
    const searchTerm = encodeURIComponent(query.toLowerCase().replace(/\s+/g, ''));
    const url = `https://5e.tools/${page}#${searchTerm}`;

    return this.fetch(url, {
      query,
      siteType: '5etools',
    });
  }

  /**
   * Get from cache if not expired
   */
  private getFromCache(key: string): CacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  /**
   * Add to cache with LRU eviction
   */
  private addToCache(key: string, entry: CacheEntry): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, entry);
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { size: number; maxSize: number; ttlMinutes: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      ttlMinutes: this.cacheTTL / 60000,
    };
  }
}

/** Singleton instance */
export const webFetchService = WebFetchService.getInstance();

/**
 * Helper function to fetch web content
 */
export async function fetchWebContent(
  url: string,
  options?: WebFetchOptions
): Promise<WebFetchResult> {
  return webFetchService.fetch(url, options);
}

/**
 * Helper function to search 5e.tools
 */
export async function search5eTools(
  query: string,
  category?: string
): Promise<WebFetchResult> {
  return webFetchService.search5eTools(query, category);
}

/**
 * Check if a URL is in the allowed whitelist
 */
export function isUrlAllowed(url: string): boolean {
  return webFetchService.isAllowed(url);
}
