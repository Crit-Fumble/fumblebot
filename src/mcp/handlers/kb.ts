/**
 * Knowledge Base Tool Handlers
 * Handles TTRPG knowledge base search and retrieval
 */

import { getCoreClient } from '../../lib/core-client.js';
import type { MCPToolResult } from './types.js';

export class KBHandler {
  async handle(name: string, args: any): Promise<MCPToolResult> {
    let coreClient;
    try {
      coreClient = getCoreClient();
    } catch (error) {
      throw new Error('Knowledge Base not available: Core API not configured. Set CORE_SERVER_URL and CORE_SECRET.');
    }

    switch (name) {
      case 'kb_search':
        return await this.search(coreClient, args);

      case 'kb_get_article':
        return await this.getArticle(coreClient, args);

      case 'kb_list_systems':
        return await this.listSystems(coreClient);

      case 'kb_list_articles':
        return await this.listArticles(coreClient, args);

      default:
        throw new Error(`Unknown KB tool: ${name}`);
    }
  }

  private async search(coreClient: any, args: any): Promise<MCPToolResult> {
    const { search, system, category, tags } = args;

    const { articles, total } = await coreClient.kb.list({
      search,
      system,
      category,
      tags,
    });

    // Format results
    const formattedResults = articles.map((article: any) => ({
      slug: article.slug,
      title: article.title,
      system: article.system,
      category: article.category,
      tags: article.tags,
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            query: search,
            results: formattedResults,
            total,
          }, null, 2),
        },
      ],
    };
  }

  private async getArticle(coreClient: any, args: any): Promise<MCPToolResult> {
    const { slug } = args;

    const { article } = await coreClient.kb.get(slug);

    return {
      content: [
        {
          type: 'text',
          text: `# ${article.frontmatter.title}\n\n` +
                `**System**: ${article.frontmatter.system}\n` +
                `**Category**: ${article.frontmatter.category}\n` +
                `**Tags**: ${article.frontmatter.tags.join(', ')}\n\n` +
                `---\n\n${article.content}`,
        },
      ],
    };
  }

  private async listSystems(coreClient: any): Promise<MCPToolResult> {
    const { systems, total } = await coreClient.kb.getSystems();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            systems,
            total,
          }, null, 2),
        },
      ],
    };
  }

  private async listArticles(coreClient: any, args: any): Promise<MCPToolResult> {
    const { system, category, tags } = args;

    const { articles, total } = await coreClient.kb.list({
      system,
      category,
      tags,
    });

    const formattedArticles = articles.map((article: any) => ({
      slug: article.slug,
      title: article.title,
      system: article.system,
      category: article.category,
      tags: article.tags,
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            articles: formattedArticles,
            total,
          }, null, 2),
        },
      ],
    };
  }
}
