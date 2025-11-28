/**
 * World Anvil MCP Server
 * Model Context Protocol server for interacting with World Anvil API
 *
 * Provides tools for:
 * - Fetching RPG systems
 * - Retrieving articles, characters, and stat blocks
 * - Caching data in PostgreSQL
 * - Rate limiting to respect World Anvil API
 *
 * @TODO: Currently disabled due to:
 * 1. Missing MCP SDK dependencies (@modelcontextprotocol/sdk)
 * 2. Missing Prisma worldanvil_* table models
 * 3. World Anvil API Cloudflare blocking (see todo/FUTURE/WORLDANVIL_CLOUDFLARE_FIX.md)
 *
 * Re-enable once these dependencies are installed and Cloudflare issue is resolved.
 */

export {}; // Make this a module

/* TEMPORARILY DISABLED - Uncomment when dependencies are available

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { WorldAnvilApiClient } from '../client/WorldAnvilApiClient.js';
import { PrismaClient } from '@prisma/client';

// Initialize Prisma client
const prisma = new PrismaClient();

// Rate limiter: Max 60 requests per minute to World Anvil
class RateLimiter {
  private requests: number[] = [];
  private maxRequests = 60;
  private windowMs = 60000; // 1 minute

  async checkLimit(): Promise<void> {
    const now = Date.now();
    // Remove requests older than window
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest);
      console.error(`Rate limit reached. Waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.checkLimit();
    }

    this.requests.push(now);
  }
}

const rateLimiter = new RateLimiter();

// Initialize World Anvil API client
function getWAClient(): WorldAnvilApiClient {
  const apiKey = process.env.WORLDANVIL_API_KEY;
  const accessToken = process.env.WORLDANVIL_ACCESS_TOKEN;

  if (!apiKey) {
    throw new Error('WORLDANVIL_API_KEY environment variable is required');
  }

  return new WorldAnvilApiClient({
    apiKey,
    accessToken,
    apiUrl: 'https://www.worldanvil.com/api/external/boromir'
  });
}

// Define MCP tools
const tools: Tool[] = [
  {
    name: 'worldanvil_get_rpg_systems',
    description: 'Get list of all RPG systems available in World Anvil. Includes D&D 5e, Cypher System, and others.',
    inputSchema: {
      type: 'object',
      properties: {
        forceRefresh: {
          type: 'boolean',
          description: 'Force refresh from API instead of using cache',
          default: false
        }
      }
    }
  },
  {
    name: 'worldanvil_get_rpg_system',
    description: 'Get details about a specific RPG system by ID or slug',
    inputSchema: {
      type: 'object',
      properties: {
        identifier: {
          type: 'string',
          description: 'System ID (number) or slug (string) - e.g., "5e" or "cypher-system"',
        }
      },
      required: ['identifier']
    }
  },
  {
    name: 'worldanvil_get_world',
    description: 'Get details about a specific World Anvil world',
    inputSchema: {
      type: 'object',
      properties: {
        worldId: {
          type: 'string',
          description: 'World ID or slug'
        }
      },
      required: ['worldId']
    }
  },
  {
    name: 'worldanvil_get_articles',
    description: 'Get articles from a World Anvil world',
    inputSchema: {
      type: 'object',
      properties: {
        worldId: {
          type: 'string',
          description: 'World ID or slug'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of articles to fetch (default: 20)',
          default: 20
        },
        offset: {
          type: 'number',
          description: 'Offset for pagination (default: 0)',
          default: 0
        }
      },
      required: ['worldId']
    }
  },
  {
    name: 'worldanvil_get_article',
    description: 'Get a specific article by ID',
    inputSchema: {
      type: 'object',
      properties: {
        articleId: {
          type: 'string',
          description: 'Article ID'
        }
      },
      required: ['articleId']
    }
  },
  {
    name: 'worldanvil_get_characters',
    description: 'Get characters from a World Anvil world',
    inputSchema: {
      type: 'object',
      properties: {
        worldId: {
          type: 'string',
          description: 'World ID or slug'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of characters to fetch (default: 20)',
          default: 20
        }
      },
      required: ['worldId']
    }
  },
  {
    name: 'worldanvil_get_stat_blocks',
    description: 'Get stat blocks from a World Anvil world',
    inputSchema: {
      type: 'object',
      properties: {
        worldId: {
          type: 'string',
          description: 'World ID or slug'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of stat blocks to fetch (default: 20)',
          default: 20
        }
      },
      required: ['worldId']
    }
  },
  {
    name: 'worldanvil_search',
    description: 'Search across World Anvil content',
    inputSchema: {
      type: 'object',
      properties: {
        worldId: {
          type: 'string',
          description: 'World ID or slug to search within'
        },
        query: {
          type: 'string',
          description: 'Search query'
        },
        contentType: {
          type: 'string',
          description: 'Type of content to search (article, character, location, etc.)',
          enum: ['article', 'character', 'location', 'item', 'all']
        }
      },
      required: ['worldId', 'query']
    }
  }
];

// Create MCP server
const server = new Server(
  {
    name: 'worldanvil-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Apply rate limiting
    await rateLimiter.checkLimit();

    const client = getWAClient();

    switch (name) {
      case 'worldanvil_get_rpg_systems': {
        const forceRefresh = args?.forceRefresh || false;

        // Check cache first unless force refresh
        if (!forceRefresh) {
          const cached = await prisma.$queryRaw`
            SELECT * FROM worldanvil_rpg_systems
            WHERE synced_at > NOW() - INTERVAL '7 days'
          `;

          if (Array.isArray(cached) && cached.length > 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    source: 'cache',
                    cached_at: cached[0].synced_at,
                    systems: cached
                  }, null, 2)
                }
              ]
            };
          }
        }

        // Fetch from API
        const systems = await client.get<any>('/rpgsystems');

        // Cache in database
        if (systems?.entities) {
          for (const system of systems.entities) {
            await prisma.$executeRaw`
              INSERT INTO worldanvil_rpg_systems
              (worldanvil_id, name, slug, description, publisher, official, community_created, icon_url, image_url, data, synced_at)
              VALUES (${system.id}, ${system.name}, ${system.slug}, ${system.description || null},
                      ${system.publisher || null}, ${system.official}, ${system.community_created || false},
                      ${system.icon_url || null}, ${system.image_url || null}, ${JSON.stringify(system)}::jsonb, NOW())
              ON CONFLICT (worldanvil_id)
              DO UPDATE SET
                name = EXCLUDED.name,
                slug = EXCLUDED.slug,
                description = EXCLUDED.description,
                publisher = EXCLUDED.publisher,
                official = EXCLUDED.official,
                community_created = EXCLUDED.community_created,
                icon_url = EXCLUDED.icon_url,
                image_url = EXCLUDED.image_url,
                data = EXCLUDED.data,
                synced_at = NOW(),
                updated_at = NOW()
            `;
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                source: 'api',
                fetched_at: new Date().toISOString(),
                systems: systems?.entities || []
              }, null, 2)
            }
          ]
        };
      }

      case 'worldanvil_get_rpg_system': {
        const identifier = args?.identifier;
        if (!identifier) {
          throw new Error('identifier is required');
        }

        // Check if it's a number (ID) or string (slug)
        const isNumeric = /^\d+$/.test(identifier);

        // Check cache
        const cached = isNumeric
          ? await prisma.$queryRaw`SELECT * FROM worldanvil_rpg_systems WHERE worldanvil_id = ${identifier} LIMIT 1`
          : await prisma.$queryRaw`SELECT * FROM worldanvil_rpg_systems WHERE slug = ${identifier} LIMIT 1`;

        if (Array.isArray(cached) && cached.length > 0) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  source: 'cache',
                  system: cached[0]
                }, null, 2)
              }
            ]
          };
        }

        // Not in cache, fetch all systems and find it
        const systems = await client.get<any>('/rpgsystems');
        const system = systems?.entities?.find((s: any) =>
          isNumeric ? s.id === parseInt(identifier) : s.slug === identifier
        );

        if (!system) {
          throw new Error(`RPG system not found: ${identifier}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                source: 'api',
                system
              }, null, 2)
            }
          ]
        };
      }

      case 'worldanvil_get_world': {
        const worldId = args?.worldId;
        if (!worldId) {
          throw new Error('worldId is required');
        }

        // Check cache
        const cached = await prisma.worldAnvilWorld.findFirst({
          where: {
            OR: [
              { worldAnvilId: worldId },
              { slug: worldId }
            ]
          }
        });

        if (cached && cached.lastSyncedAt) {
          const hoursSinceSync = (Date.now() - cached.lastSyncedAt.getTime()) / (1000 * 60 * 60);
          if (hoursSinceSync < 24) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    source: 'cache',
                    world: cached
                  }, null, 2)
                }
              ]
            };
          }
        }

        // Fetch from API
        const world = await client.get<any>(`/world/${worldId}`);

        // Cache result
        await prisma.worldAnvilWorld.upsert({
          where: { worldAnvilId: world.id },
          create: {
            worldAnvilId: world.id,
            slug: world.slug || null,
            name: world.title,
            description: world.description || null,
            url: world.url || null,
            playerId: null, // Will be set when user links account
            lastSyncedAt: new Date(),
            data: world
          },
          update: {
            slug: world.slug || null,
            name: world.title,
            description: world.description || null,
            url: world.url || null,
            lastSyncedAt: new Date(),
            data: world,
            updatedAt: new Date()
          }
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                source: 'api',
                world
              }, null, 2)
            }
          ]
        };
      }

      case 'worldanvil_get_articles': {
        const { worldId, limit = 20, offset = 0 } = args || {};
        if (!worldId) {
          throw new Error('worldId is required');
        }

        const articles = await client.get<any>(`/world/${worldId}/articles?limit=${limit}&offset=${offset}`);

        // Cache articles
        if (articles?.entities) {
          for (const article of articles.entities) {
            await prisma.worldAnvilArticle.upsert({
              where: { worldAnvilId: article.id },
              create: {
                worldAnvilWorldId: worldId,
                worldAnvilId: article.id,
                title: article.title,
                slug: article.slug || null,
                content: article.content || null,
                template: article.template || null,
                category: article.category || null,
                url: article.url || null,
                isPublic: article.is_public !== false,
                isDraft: article.is_draft || false,
                data: article,
                syncedAt: new Date()
              },
              update: {
                title: article.title,
                slug: article.slug || null,
                content: article.content || null,
                template: article.template || null,
                category: article.category || null,
                url: article.url || null,
                isPublic: article.is_public !== false,
                isDraft: article.is_draft || false,
                data: article,
                syncedAt: new Date(),
                updatedAt: new Date()
              }
            });
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                source: 'api',
                total: articles?.total || 0,
                limit,
                offset,
                articles: articles?.entities || []
              }, null, 2)
            }
          ]
        };
      }

      case 'worldanvil_get_article': {
        const { articleId } = args || {};
        if (!articleId) {
          throw new Error('articleId is required');
        }

        // Check cache
        const cached = await prisma.worldAnvilArticle.findUnique({
          where: { worldAnvilId: articleId }
        });

        if (cached && cached.syncedAt) {
          const hoursSinceSync = (Date.now() - cached.syncedAt.getTime()) / (1000 * 60 * 60);
          if (hoursSinceSync < 24) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    source: 'cache',
                    article: cached
                  }, null, 2)
                }
              ]
            };
          }
        }

        // Fetch from API
        const article = await client.get<any>(`/article/${articleId}`);

        // Cache result
        await prisma.worldAnvilArticle.upsert({
          where: { worldAnvilId: article.id },
          create: {
            worldAnvilWorldId: article.world_id,
            worldAnvilId: article.id,
            title: article.title,
            slug: article.slug || null,
            content: article.content || null,
            template: article.template || null,
            category: article.category || null,
            url: article.url || null,
            isPublic: article.is_public !== false,
            isDraft: article.is_draft || false,
            data: article,
            syncedAt: new Date()
          },
          update: {
            title: article.title,
            slug: article.slug || null,
            content: article.content || null,
            template: article.template || null,
            category: article.category || null,
            url: article.url || null,
            isPublic: article.is_public !== false,
            isDraft: article.is_draft || false,
            data: article,
            syncedAt: new Date(),
            updatedAt: new Date()
          }
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                source: 'api',
                article
              }, null, 2)
            }
          ]
        };
      }

      case 'worldanvil_search': {
        const { worldId, query, contentType = 'all' } = args || {};
        if (!worldId || !query) {
          throw new Error('worldId and query are required');
        }

        // For now, search cached data
        // TODO: Implement World Anvil API search when available

        const results: any = {
          query,
          contentType,
          results: []
        };

        if (contentType === 'article' || contentType === 'all') {
          const articles = await prisma.worldAnvilArticle.findMany({
            where: {
              worldAnvilWorldId: worldId,
              OR: [
                { title: { contains: query, mode: 'insensitive' } },
                { content: { contains: query, mode: 'insensitive' } }
              ]
            },
            take: 10
          });
          results.results.push(...articles.map(a => ({ type: 'article', ...a })));
        }

        if (contentType === 'character' || contentType === 'all') {
          const characters = await prisma.worldAnvilCharacter.findMany({
            where: {
              worldAnvilWorldId: worldId,
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { content: { contains: query, mode: 'insensitive' } }
              ]
            },
            take: 10
          });
          results.results.push(...characters.map(c => ({ type: 'character', ...c })));
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2)
            }
          ]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}\n\nStack: ${error.stack}`
        }
      ],
      isError: true
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('World Anvil MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

END OF TEMPORARILY DISABLED CODE */
