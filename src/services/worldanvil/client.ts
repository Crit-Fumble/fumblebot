/**
 * World Anvil Service
 * Wraps @crit-fumble/worldanvil client for FumbleBot integration
 */

import {
  WorldAnvilClient,
  type WorldAnvilClientConfig,
  type ArticleWithContent,
  type ArticleFull,
  type World,
  type WorldFull,
  type Category,
} from '@crit-fumble/worldanvil';

export interface WorldAnvilServiceConfig {
  applicationKey: string;
  authToken?: string;
  /** Cache TTL in milliseconds (default: 5 minutes) */
  cacheTtl?: number;
}

export interface WorldAnvilSearchResult {
  success: boolean;
  content: string;
  source?: string;
  error?: string;
  articleId?: string;
  worldId?: string;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

/**
 * World Anvil Service for FumbleBot
 * Provides cached access to World Anvil content with search capabilities
 */
export class WorldAnvilService {
  private client: WorldAnvilClient;
  private cacheTtl: number;
  private cache: Map<string, CacheEntry<unknown>> = new Map();

  constructor(config: WorldAnvilServiceConfig) {
    this.client = new WorldAnvilClient({
      applicationKey: config.applicationKey,
      authToken: config.authToken,
    });
    this.cacheTtl = config.cacheTtl || 5 * 60 * 1000; // 5 minutes default
  }

  /**
   * Update auth token (e.g., when user links their World Anvil account)
   */
  setAuthToken(authToken: string): void {
    this.client.configure({ authToken });
  }

  /**
   * Get from cache or fetch
   */
  private async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as T;
    }

    const data = await fetcher();
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + this.cacheTtl,
    });
    return data;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get current user identity
   */
  async getIdentity() {
    return this.getOrFetch('identity', () => this.client.identity());
  }

  /**
   * List user's worlds
   */
  async listWorlds() {
    return this.getOrFetch('worlds', () => this.client.worlds.list());
  }

  /**
   * Get world by ID with full details
   */
  async getWorld(worldId: string): Promise<World | WorldFull> {
    return this.getOrFetch(`world:${worldId}`, () =>
      this.client.worlds.get(worldId, 2)
    );
  }

  /**
   * List articles in a world
   */
  async listArticles(worldId: string) {
    return this.getOrFetch(`articles:${worldId}`, () =>
      this.client.articles.listByWorld(worldId)
    );
  }

  /**
   * Get article by ID with content
   */
  async getArticle(
    articleId: string
  ): Promise<ArticleWithContent | ArticleFull> {
    return this.getOrFetch(`article:${articleId}`, () =>
      this.client.articles.get(articleId, 2)
    );
  }

  /**
   * List categories in a world
   */
  async listCategories(worldId: string) {
    return this.getOrFetch(`categories:${worldId}`, () =>
      this.client.categories.listByWorld(worldId)
    );
  }

  /**
   * Search articles in a world by title/content
   * Note: World Anvil API doesn't have native search, so we filter client-side
   */
  async searchArticles(
    worldId: string,
    query: string
  ): Promise<WorldAnvilSearchResult> {
    try {
      // Get all articles for the world
      const { entities: articles } = await this.listArticles(worldId);

      // Filter by query (case-insensitive)
      const lowerQuery = query.toLowerCase();
      const matches = articles.filter((article) => {
        const title = article.title?.toLowerCase() || '';
        return title.includes(lowerQuery);
      });

      if (matches.length === 0) {
        return {
          success: false,
          content: `No articles found matching "${query}" in this world.`,
          error: 'No matches found',
        };
      }

      // Get full content for top match
      const topMatch = matches[0];
      const fullArticle = await this.getArticle(topMatch.id);

      // Format content
      const content = this.formatArticleContent(fullArticle);

      // Build source URL
      const world = await this.getWorld(worldId);
      const sourceUrl = `https://www.worldanvil.com/w/${(world as World).slug || worldId}/${fullArticle.id}`;

      return {
        success: true,
        content,
        source: sourceUrl,
        articleId: fullArticle.id,
        worldId,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        content: `Failed to search World Anvil: ${message}`,
        error: message,
      };
    }
  }

  /**
   * Get article by title (exact or fuzzy match)
   */
  async getArticleByTitle(
    worldId: string,
    title: string
  ): Promise<WorldAnvilSearchResult> {
    return this.searchArticles(worldId, title);
  }

  /**
   * Format article content for display
   */
  private formatArticleContent(
    article: ArticleWithContent | ArticleFull
  ): string {
    const parts: string[] = [];

    // Title
    parts.push(`# ${article.title}`);

    // Excerpt if available
    if (article.excerpt) {
      parts.push(`\n*${article.excerpt}*`);
    }

    // Main content
    if (article.content) {
      // Convert BBCode to markdown (basic conversion)
      const content = this.convertBBCodeToMarkdown(article.content);
      parts.push(`\n${content}`);
    }

    // Sidebar content
    if (article.sidebar) {
      parts.push(`\n---\n**Additional Info:**\n${article.sidebar}`);
    }

    // Tags
    if (article.tags && article.tags.length > 0) {
      parts.push(`\n\n*Tags: ${article.tags.join(', ')}*`);
    }

    return parts.join('\n');
  }

  /**
   * Basic BBCode to Markdown conversion
   */
  private convertBBCodeToMarkdown(text: string): string {
    return (
      text
        // Bold
        .replace(/\[b\](.*?)\[\/b\]/gi, '**$1**')
        // Italic
        .replace(/\[i\](.*?)\[\/i\]/gi, '*$1*')
        // Underline (markdown doesn't have underline, use italic)
        .replace(/\[u\](.*?)\[\/u\]/gi, '_$1_')
        // Headers
        .replace(/\[h1\](.*?)\[\/h1\]/gi, '\n## $1\n')
        .replace(/\[h2\](.*?)\[\/h2\]/gi, '\n### $1\n')
        .replace(/\[h3\](.*?)\[\/h3\]/gi, '\n#### $1\n')
        // Links
        .replace(/\[url=(.*?)\](.*?)\[\/url\]/gi, '[$2]($1)')
        // Quotes
        .replace(/\[quote\](.*?)\[\/quote\]/gi, '\n> $1\n')
        // Lists
        .replace(/\[list\]/gi, '')
        .replace(/\[\/list\]/gi, '')
        .replace(/\[\*\]/gi, '- ')
        // Clean up World Anvil specific tags
        .replace(/\[article:(.*?)\]/gi, '**$1**')
        .replace(/\[container:(.*?)\]/gi, '')
        .replace(/\[\/container\]/gi, '')
        // Remove other BBCode tags
        .replace(/\[.*?\]/g, '')
    );
  }

  /**
   * Get raw client for advanced operations
   */
  get rawClient(): WorldAnvilClient {
    return this.client;
  }
}

// Singleton instance (lazy initialization)
let worldAnvilServiceInstance: WorldAnvilService | null = null;

/**
 * Get or create the World Anvil service singleton
 */
export function getWorldAnvilService(): WorldAnvilService | null {
  if (!worldAnvilServiceInstance) {
    const applicationKey = process.env.WORLDANVIL_APP_KEY;
    const authToken = process.env.WORLDANVIL_AUTH_TOKEN;

    if (!applicationKey) {
      console.warn(
        'World Anvil service not initialized: WORLDANVIL_APP_KEY not set'
      );
      return null;
    }

    worldAnvilServiceInstance = new WorldAnvilService({
      applicationKey,
      authToken,
    });
  }

  return worldAnvilServiceInstance;
}

/**
 * Search World Anvil for content
 */
export async function searchWorldAnvil(
  worldId: string,
  query: string
): Promise<WorldAnvilSearchResult> {
  const service = getWorldAnvilService();
  if (!service) {
    return {
      success: false,
      content: 'World Anvil service not configured',
      error: 'WORLDANVIL_APP_KEY environment variable not set',
    };
  }

  return service.searchArticles(worldId, query);
}
