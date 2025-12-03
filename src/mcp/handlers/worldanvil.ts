/**
 * World Anvil Tool Handlers
 * Handles World Anvil content fetching and search
 */

import { getWorldAnvilService } from '../../services/worldanvil/index.js';
import type { MCPToolResult } from './types.js';

export class WorldAnvilHandler {
  async handle(name: string, args: any): Promise<MCPToolResult> {
    switch (name) {
      case 'worldanvil_list_worlds':
        return await this.listWorlds();

      case 'worldanvil_get_world':
        return await this.getWorld(args);

      case 'worldanvil_search_articles':
        return await this.searchArticles(args);

      case 'worldanvil_get_article':
        return await this.getArticle(args);

      case 'worldanvil_list_articles':
        return await this.listArticles(args);

      case 'worldanvil_list_categories':
        return await this.listCategories(args);

      default:
        throw new Error(`Unknown World Anvil tool: ${name}`);
    }
  }

  private async listWorlds(): Promise<MCPToolResult> {
    try {
      const service = getWorldAnvilService();
      if (!service) {
        return {
          content: [
            {
              type: 'text',
              text: 'World Anvil integration not configured. Please set WORLDANVIL_APP_KEY environment variable.',
            },
          ],
          isError: true,
        };
      }

      const { entities: worlds } = await service.listWorlds();

      if (worlds.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No worlds found. Make sure your World Anvil account has access to at least one world.',
            },
          ],
        };
      }

      const worldList = worlds
        .map((w: any) => `- **${w.title}** (ID: \`${w.id}\`)${w.slug ? ` - [View](https://www.worldanvil.com/w/${w.slug})` : ''}`)
        .join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `## Your World Anvil Worlds\n\n${worldList}\n\nUse the world ID with other World Anvil tools to explore content.`,
          },
        ],
        _meta: {
          worldCount: worlds.length,
          worlds: worlds.map((w: any) => ({ id: w.id, title: w.title, slug: w.slug })),
        },
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to list World Anvil worlds: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async getWorld(args: any): Promise<MCPToolResult> {
    const { worldId } = args;

    if (!worldId) {
      return {
        content: [{ type: 'text', text: 'worldId is required' }],
        isError: true,
      };
    }

    try {
      const service = getWorldAnvilService();
      if (!service) {
        return {
          content: [
            {
              type: 'text',
              text: 'World Anvil integration not configured.',
            },
          ],
          isError: true,
        };
      }

      const world = await service.getWorld(worldId) as any;

      const parts: string[] = [];
      parts.push(`# ${world.title}`);

      if (world.description) {
        parts.push(`\n${world.description}`);
      }

      if (world.genres && world.genres.length > 0) {
        parts.push(`\n**Genres:** ${world.genres.join(', ')}`);
      }

      if (world.tags && world.tags.length > 0) {
        parts.push(`**Tags:** ${world.tags.join(', ')}`);
      }

      if (world.slug) {
        parts.push(`\n[View on World Anvil](https://www.worldanvil.com/w/${world.slug})`);
      }

      return {
        content: [
          {
            type: 'text',
            text: parts.join('\n'),
          },
        ],
        _meta: {
          worldId: world.id,
          title: world.title,
          slug: world.slug,
        },
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to get World Anvil world: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async searchArticles(args: any): Promise<MCPToolResult> {
    const { worldId, query } = args;

    if (!worldId || !query) {
      return {
        content: [{ type: 'text', text: 'worldId and query are required' }],
        isError: true,
      };
    }

    try {
      const service = getWorldAnvilService();
      if (!service) {
        return {
          content: [
            {
              type: 'text',
              text: 'World Anvil integration not configured.',
            },
          ],
          isError: true,
        };
      }

      const result = await service.searchArticles(worldId, query);

      return {
        content: [
          {
            type: 'text',
            text: result.content,
          },
        ],
        _meta: {
          success: result.success,
          source: result.source,
          articleId: result.articleId,
          worldId: result.worldId,
        },
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to search World Anvil: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async getArticle(args: any): Promise<MCPToolResult> {
    const { articleId } = args;

    if (!articleId) {
      return {
        content: [{ type: 'text', text: 'articleId is required' }],
        isError: true,
      };
    }

    try {
      const service = getWorldAnvilService();
      if (!service) {
        return {
          content: [
            {
              type: 'text',
              text: 'World Anvil integration not configured.',
            },
          ],
          isError: true,
        };
      }

      const article = await service.getArticle(articleId);
      const content = (service as any).formatArticleContent(article);

      return {
        content: [
          {
            type: 'text',
            text: content,
          },
        ],
        _meta: {
          articleId: article.id,
          title: article.title,
          template: article.entityClass,
        },
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to get World Anvil article: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async listArticles(args: any): Promise<MCPToolResult> {
    const { worldId } = args;

    if (!worldId) {
      return {
        content: [{ type: 'text', text: 'worldId is required' }],
        isError: true,
      };
    }

    try {
      const service = getWorldAnvilService();
      if (!service) {
        return {
          content: [
            {
              type: 'text',
              text: 'World Anvil integration not configured.',
            },
          ],
          isError: true,
        };
      }

      const { entities: articles } = await service.listArticles(worldId);

      if (articles.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No articles found in this world.',
            },
          ],
        };
      }

      // Group by template type
      const byType = new Map<string, Array<{ id: string; title: string }>>();
      for (const article of articles) {
        const type = (article as any).entityClass || 'generic';
        if (!byType.has(type)) {
          byType.set(type, []);
        }
        byType.get(type)!.push({ id: article.id, title: article.title });
      }

      const parts: string[] = [`## Articles in World (${articles.length} total)\n`];

      for (const [type, items] of Array.from(byType.entries())) {
        parts.push(`### ${type.charAt(0).toUpperCase() + type.slice(1)} (${items.length})`);
        // Show first 10 of each type
        const shown = items.slice(0, 10);
        for (const item of shown) {
          parts.push(`- ${item.title} (\`${item.id}\`)`);
        }
        if (items.length > 10) {
          parts.push(`- ... and ${items.length - 10} more`);
        }
        parts.push('');
      }

      return {
        content: [
          {
            type: 'text',
            text: parts.join('\n'),
          },
        ],
        _meta: {
          worldId,
          articleCount: articles.length,
          types: Array.from(byType.keys()),
        },
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to list World Anvil articles: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async listCategories(args: any): Promise<MCPToolResult> {
    const { worldId } = args;

    if (!worldId) {
      return {
        content: [{ type: 'text', text: 'worldId is required' }],
        isError: true,
      };
    }

    try {
      const service = getWorldAnvilService();
      if (!service) {
        return {
          content: [
            {
              type: 'text',
              text: 'World Anvil integration not configured.',
            },
          ],
          isError: true,
        };
      }

      const { entities: categories } = await service.listCategories(worldId);

      if (categories.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No categories found in this world.',
            },
          ],
        };
      }

      const categoryList = categories
        .map((c: any) => `- **${c.title}** (\`${c.id}\`)`)
        .join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `## Categories in World\n\n${categoryList}`,
          },
        ],
        _meta: {
          worldId,
          categoryCount: categories.length,
          categories: categories.map((c: any) => ({ id: c.id, title: c.title })),
        },
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to list World Anvil categories: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }
}
