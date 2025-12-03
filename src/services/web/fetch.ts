/**
 * Web Fetch Service
 * Fetches content from whitelisted TTRPG websites for FumbleBot
 *
 * Only allows fetching from domains in the Knowledge Base whitelist:
 * - 5e.tools (D&D 5e reference)
 * - dndbeyond.com (D&D Beyond)
 * - foundryvtt.com/kb (FoundryVTT knowledge base)
 * - tools.cypher-system.com (Cypher System tools)
 */

import { extractContent, type SiteType } from './extractors.js';

/** Allowed domains for web fetching */
export const ALLOWED_DOMAINS = [
  '5e.tools',
  'www.5e.tools',
  'www.dndbeyond.com',
  'dndbeyond.com',
  'foundryvtt.com',
  'www.foundryvtt.com',
  'tools.cypher-system.com',
] as const;

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
   */
  isAllowed(url: string): boolean {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();

      // Check against whitelist
      const allowed = ALLOWED_DOMAINS.some(domain =>
        hostname === domain || hostname.endsWith('.' + domain)
      );

      // Additional check: foundryvtt.com must be /kb/ paths
      if (allowed && hostname.includes('foundryvtt.com')) {
        return parsed.pathname.startsWith('/kb/') || parsed.pathname.startsWith('/kb');
      }

      return allowed;
    } catch {
      return false;
    }
  }

  /**
   * Get the list of allowed domains for error messages
   */
  getAllowedDomainsMessage(): string {
    return [
      '5e.tools',
      'dndbeyond.com',
      'foundryvtt.com/kb/',
      'tools.cypher-system.com',
    ].join(', ');
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
