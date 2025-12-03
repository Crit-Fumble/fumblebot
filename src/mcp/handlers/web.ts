/**
 * Web Fetch Tool Handlers
 * Handles web content fetching from TTRPG sites
 */

import { AIService } from '../../services/ai/service.js';
import { getWebScreenshotService } from '../../services/web/index.js';
import type { MCPToolResult } from './types.js';

export class WebHandler {
  async handle(name: string, args: any): Promise<MCPToolResult> {
    switch (name) {
      case 'web_fetch':
        return await this.webFetch(args);

      case 'web_search_5etools':
        return await this.webSearch5etools(args);

      case 'web_search_cypher_srd':
        return await this.webSearchCypherSrd(args);

      case 'web_search_forgotten_realms':
        return await this.webSearchForgottenRealms(args);

      default:
        throw new Error(`Unknown web tool: ${name}`);
    }
  }

  private async webFetch(args: any): Promise<MCPToolResult> {
    const { url, query, site = 'general' } = args;

    try {
      // Fetch the URL content
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'FumbleBot/1.0 (TTRPG Assistant Bot)',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();

      // Use AI to extract relevant information from the HTML
      const aiService = AIService.getInstance();

      const extractionPrompt = `Extract the requested information from this webpage content.

URL: ${url}
Site Type: ${site}
User Query: ${query}

Instructions:
- Extract only the relevant information for the query
- Format as clean markdown
- Include important details (stats, rules, mechanics)
- For spell cards: include level, school, casting time, range, components, duration, description
- For NPC stat blocks: include all stats, abilities, and actions
- For tables: format as markdown tables
- ALWAYS include a linkback to the source at the end: "Source: [${url}](${url})"

HTML Content (first 10000 chars):
${html.slice(0, 10000)}`;

      const result = await aiService.lookup(
        extractionPrompt,
        'You are a web scraper extracting TTRPG reference information. Be accurate and preserve all important details.',
        { maxTokens: 1000 }
      );

      return {
        content: [
          {
            type: 'text',
            text: result.content,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to fetch ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async webSearch5etools(args: any): Promise<MCPToolResult> {
    const { query, category = 'spells' } = args;

    try {
      // Construct 5e.tools URL based on category
      const categoryMap: Record<string, string> = {
        spells: 'spells.html',
        items: 'items.html',
        bestiary: 'bestiary.html',
        classes: 'classes.html',
        races: 'races.html',
        feats: 'feats.html',
        backgrounds: 'backgrounds.html',
        conditions: 'conditionsdiseases.html',
        actions: 'actions.html',
      };

      const page = categoryMap[category] || 'spells.html';
      const searchTerm = query.toLowerCase().replace(/\s+/g, '%20');

      // 5e.tools uses hash navigation for specific entries
      const url = `https://5e.tools/${page}#${searchTerm}`;

      console.error(`[web_search_5etools] Searching for "${query}" in ${category} at ${url}`);

      // Fetch the page
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'FumbleBot/1.0 (TTRPG Assistant Bot)',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();

      // Use AI to extract the search result from 5e.tools
      const aiService = AIService.getInstance();

      const extractionPrompt = `Extract information about "${query}" from this 5e.tools ${category} page.

Search Query: ${query}
Category: ${category}
URL: ${url}

Instructions:
- Find the entry matching "${query}" in the page content
- Extract all relevant stats, descriptions, and mechanics
- Format as clean markdown with proper headings
- For spells: include level, school, casting time, range, components, duration, full description, at higher levels
- For monsters: include CR, size, type, AC, HP, speed, stats, saves, skills, senses, languages, traits, actions, legendary actions if any
- For items: include type, rarity, attunement, properties, description
- For classes/races: include core features, traits, and progression details
- If multiple matches exist, list all of them briefly
- ALWAYS end with: "Source: [5e.tools ${category}](${url})"

HTML Content (first 15000 chars):
${html.slice(0, 15000)}`;

      const result = await aiService.lookup(
        extractionPrompt,
        'You are extracting D&D 5e game content from 5e.tools. Be thorough and accurate with stats and mechanics.',
        { maxTokens: 1500 }
      );

      return {
        content: [
          {
            type: 'text',
            text: result.content,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to search 5e.tools for "${query}" in ${category}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async webSearchCypherSrd(args: any): Promise<MCPToolResult> {
    const { query } = args;

    try {
      // Old Gus' Cypher SRD is a large single-page document on GitHub Pages
      const baseUrl = 'https://callmepartario.github.io/og-csrd/';

      console.error(`[web_search_cypher_srd] Searching for "${query}" at ${baseUrl}`);

      const response = await fetch(baseUrl, {
        headers: {
          'User-Agent': 'FumbleBot/1.0 (TTRPG Assistant Bot)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();

      // The SRD uses anchor IDs like: #descriptor-clever, #focus-masters-weaponry, #ability-onslaught, #type-warrior
      const queryLower = query.toLowerCase();
      const querySlug = queryLower.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const htmlLower = html.toLowerCase();

      // Try anchor-based patterns (descriptor, focus, ability, type, flavor, cypher, artifact)
      const anchorPatterns = [
        { pattern: `id="ability-${querySlug}"`, anchor: `ability-${querySlug}`, type: 'ability' },
        { pattern: `id="focus-${querySlug}"`, anchor: `focus-${querySlug}`, type: 'focus' },
        { pattern: `id="descriptor-${querySlug}"`, anchor: `descriptor-${querySlug}`, type: 'descriptor' },
        { pattern: `id="type-${querySlug}"`, anchor: `type-${querySlug}`, type: 'type' },
        { pattern: `id="flavor-${querySlug}"`, anchor: `flavor-${querySlug}`, type: 'flavor' },
        { pattern: `id="cypher-${querySlug}"`, anchor: `cypher-${querySlug}`, type: 'cypher' },
        { pattern: `id="artifact-${querySlug}"`, anchor: `artifact-${querySlug}`, type: 'artifact' },
      ];

      const matches: Array<{ idx: number; anchor: string; type: string }> = [];

      // First try anchor-based search
      for (const { pattern, anchor, type } of anchorPatterns) {
        const idx = htmlLower.indexOf(pattern);
        if (idx !== -1) {
          matches.push({ idx, anchor, type });
        }
      }

      // If no anchor matches, fall back to text search
      let textMatches: number[] = [];
      if (matches.length === 0) {
        let searchStart = 0;
        while (true) {
          const idx = htmlLower.indexOf(queryLower, searchStart);
          if (idx === -1) break;
          textMatches.push(idx);
          searchStart = idx + 1;
          if (textMatches.length >= 5) break; // Limit to first 5 matches
        }
      }

      // Determine the best anchor for screenshot
      const bestMatch = matches.length > 0 ? matches[0] : null;
      const matchIndices = matches.length > 0 ? matches.map(m => m.idx) : textMatches;

      let relevantContent: string;
      if (matchIndices.length > 0) {
        // Extract content around each match (8000 chars per match, centered)
        const chunks: string[] = [];
        for (const matchIdx of matchIndices) {
          const start = Math.max(0, matchIdx - 2000);
          const end = Math.min(html.length, matchIdx + 6000);
          chunks.push(html.slice(start, end));
        }
        relevantContent = chunks.join('\n\n--- NEXT MATCH ---\n\n');
      } else {
        // No match found, send first portion for AI to search
        relevantContent = html.slice(0, 30000);
      }

      // Use AI to extract and format the Cypher System content
      const aiService = AIService.getInstance();

      const extractionPrompt = `You are extracting Cypher System TTRPG content from Old Gus' Cypher System SRD.

Search Query: "${query}"
Source URL: ${baseUrl}
Matches found: ${matchIndices.length}

Instructions:
- Extract the content matching "${query}" from the HTML below
- Format as clean markdown with proper headings
- For Descriptors: include stat adjustments (+2 to pool), skills, and special abilities
- For Foci: include ALL tier abilities (1-6), equipment, minor/major effects
- For Types (Warrior/Adept/Explorer/Speaker): include stat pools, starting abilities, edge, advancement
- For Abilities: include pool cost (e.g., "2 Might points"), action type, full description
- For Cyphers/Artifacts: include level range, form, effect, depletion
- Strip HTML tags but preserve the content structure
- If no match found, say so clearly
- End with: "Source: [Old Gus' Cypher SRD](${baseUrl})"

HTML Content:
${relevantContent.slice(0, 40000)}`;

      const result = await aiService.lookup(
        extractionPrompt,
        'You are extracting Cypher System TTRPG content. Be thorough and accurate. Cypher System uses Might, Speed, and Intellect pools. Costs are paid from pools. Include ALL relevant details.',
        { maxTokens: 2000 }
      );

      // Capture screenshot if we found an anchor match
      let screenshotBase64: string | null = null;
      if (bestMatch) {
        try {
          const screenshotService = getWebScreenshotService();
          const screenshot = await screenshotService.captureCypherSrd(bestMatch.anchor);
          screenshotBase64 = screenshot.base64;
          console.error(`[web_search_cypher_srd] Screenshot captured for anchor: ${bestMatch.anchor}`);
        } catch (screenshotError) {
          console.error(`[web_search_cypher_srd] Screenshot failed: ${screenshotError}`);
          // Continue without screenshot
        }
      }

      // Build response content
      const contentItems: Array<{ type: 'text' | 'image'; text?: string; data?: string; mimeType?: string }> = [];

      // Add screenshot if available
      if (screenshotBase64) {
        contentItems.push({
          type: 'image',
          data: screenshotBase64,
          mimeType: 'image/png',
        });
      }

      // Add text content
      contentItems.push({
        type: 'text',
        text: result.content,
      });

      return {
        content: contentItems,
        // Include metadata for Discord embed building
        _meta: {
          query,
          matchType: bestMatch?.type || 'text',
          anchor: bestMatch?.anchor || null,
          sourceUrl: bestMatch ? `${baseUrl}#${bestMatch.anchor}` : baseUrl,
          hasScreenshot: !!screenshotBase64,
        },
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to search Old Gus' Cypher SRD for "${query}": ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async webSearchForgottenRealms(args: any): Promise<MCPToolResult> {
    const { query } = args;

    try {
      // Forgotten Realms Wiki uses MediaWiki API
      const baseUrl = 'https://forgottenrealms.fandom.com';
      const searchUrl = `${baseUrl}/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=5&format=json`;

      console.error(`[web_search_forgotten_realms] Searching for "${query}"`);

      // First, search for matching articles
      const searchResponse = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'FumbleBot/1.0 (TTRPG Assistant Bot)',
        },
      });

      if (!searchResponse.ok) {
        throw new Error(`Search failed: HTTP ${searchResponse.status}`);
      }

      const searchResults = await searchResponse.json() as [string, string[], string[], string[]];
      const [, titles, , urls] = searchResults;

      if (titles.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No results found for "${query}" in the Forgotten Realms Wiki.`,
            },
          ],
        };
      }

      // Fetch the first matching article
      const articleUrl = urls[0];
      const articleResponse = await fetch(articleUrl, {
        headers: {
          'User-Agent': 'FumbleBot/1.0 (TTRPG Assistant Bot)',
        },
      });

      if (!articleResponse.ok) {
        throw new Error(`Article fetch failed: HTTP ${articleResponse.status}`);
      }

      const html = await articleResponse.text();

      // Use AI to extract and format the wiki content
      const aiService = AIService.getInstance();

      const extractionPrompt = `You are extracting Forgotten Realms lore from the Forgotten Realms Wiki (a D&D setting wiki).

Search Query: "${query}"
Article URL: ${articleUrl}
Other matching articles: ${titles.slice(1).join(', ') || 'None'}

Instructions:
- Extract the main content about "${titles[0]}" from the HTML
- Format as clean markdown with proper headings
- Include key lore details: history, description, location, notable events
- For characters: include race, class, alignment, affiliations, notable deeds
- For locations: include geography, history, notable inhabitants, organizations
- For items/artifacts: include powers, history, current location
- For deities: include domains, worshippers, holy days, symbols
- Keep it concise but informative (aim for ~500-800 words)
- If there are related articles of interest, mention them at the end
- End with: "Source: [Forgotten Realms Wiki](${articleUrl})"

HTML Content (first 20000 chars):
${html.slice(0, 20000)}`;

      const result = await aiService.lookup(
        extractionPrompt,
        'You are extracting D&D Forgotten Realms lore. Be thorough and accurate. Focus on the most important and interesting details.',
        { maxTokens: 1500 }
      );

      return {
        content: [
          {
            type: 'text',
            text: result.content,
          },
        ],
        _meta: {
          query,
          articleTitle: titles[0],
          articleUrl,
          otherResults: titles.slice(1),
        },
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to search Forgotten Realms Wiki for "${query}": ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }
}
