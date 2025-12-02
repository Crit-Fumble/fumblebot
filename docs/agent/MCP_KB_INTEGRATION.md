# FumbleBot MCP Knowledge Base Integration

**Date**: 2025-12-01
**Core SDK Version**: 10.2.0

## Summary

FumbleBot's MCP server now integrates with the Knowledge Base served by Core. This allows AI agents (Claude Desktop, etc.) to query TTRPG rules, FoundryVTT documentation, and game mechanics directly through MCP tools.

## Changes Made

### 1. Updated Core SDK

**Previous**: v10.1.0
**Current**: v10.2.0

**New in 10.2.0**:
- Added `kb` namespace to `CoreApiClient`
- KB API methods: `list()`, `get()`, `getSystems()`, `getCategories()`, `getTags()`
- Full TypeScript types for KB articles, frontmatter, and responses

### 2. Updated MCP Server

File: [src/mcp/fumblebot-mcp-server.ts](../src/mcp/fumblebot-mcp-server.ts)

**Added KB tools:**

| Tool | Description | Usage |
|------|-------------|-------|
| `kb_search` | Search KB for rules/guides | `kb_search { "search": "spell slots", "system": "dnd5e" }` |
| `kb_get_article` | Get full article by slug | `kb_get_article { "slug": "common/dice-notation" }` |
| `kb_list_systems` | List all game systems | `kb_list_systems {}` |
| `kb_list_articles` | List articles with filters | `kb_list_articles { "system": "foundry", "category": "api" }` |

**Implementation**:
```typescript
// Added to imports
import { getCoreClient } from '../lib/core-client.js';

// Added KB handler
private async handleKBTool(name: string, args: any) {
  const coreClient = getCoreClient();
  // Routes to kb_search, kb_get_article, etc.
}

// Example: Search implementation
private async kbSearch(coreClient: any, args: any) {
  const { articles, total } = await coreClient.kb.list({
    search: args.search,
    system: args.system,
    category: args.category,
    tags: args.tags,
  });
  // Returns formatted results
}
```

### 3. Environment Configuration

**Required for KB access:**
```bash
# Core server URL (internal VPC or localhost)
CORE_SERVER_URL=http://<core-server-host>:4000

# Core API secret for service-to-service auth
CORE_SECRET=<your-core-secret>
```

**Note**: If Core is not configured, KB tools will return an error message but won't crash the MCP server.

## Usage Examples

### From Claude Desktop

**Search for D&D 5e spell rules:**
```
Use kb_search tool with:
{
  "search": "spell slots concentration",
  "system": "dnd5e",
  "category": "rules"
}
```

**Get FoundryVTT API documentation:**
```
Use kb_get_article tool with:
{
  "slug": "foundry/api-basics"
}
```

**List all available systems:**
```
Use kb_list_systems tool
```

### From Discord Commands

Discord commands can leverage MCP tools through the command handlers:

```typescript
// In src/commands/handlers/lookup.ts
import { fumbleBotMCP } from '../mcp/fumblebot-mcp-server.js';

async function lookupRule(interaction, query, system) {
  const result = await fumbleBotMCP.callTool('kb_search', {
    search: query,
    system: system || 'dnd5e',
    category: 'rules',
  });

  // Format and send to Discord
}
```

## KB Content

### Current Systems

| System ID | Description | Articles |
|-----------|-------------|----------|
| `dnd5e` | D&D 5th Edition | spellcasting |
| `cypher` | Cypher System | core-mechanics |
| `foundry` | FoundryVTT | api-basics, dnd5e-system, cypher-system, user guides (3) |
| `pc-games` | PC RPGs | crpg-mechanics |
| `common` | System-agnostic | dice-notation |

### Article Structure

All KB articles follow this format:

```markdown
---
title: "Article Title"
system: "dnd5e"
category: "rules"
tags: ["tag1", "tag2"]
source: "Player's Handbook"
---

# Article Title

Content in markdown format...
```

**Categories:**
- `rules` - Game system rules
- `api` - FoundryVTT API documentation
- `user-guide` - Player/GM guides
- `reference` - Quick reference material

### Adding New Content

1. Create markdown file in appropriate directory (managed in FumbleBot repo):
   ```
   kb/systems/dnd5e/new-article.md
   kb/foundry/new-guide.md
   kb/common/new-reference.md
   ```

2. Add frontmatter with required fields

3. Migrate to Core:
   ```bash
   # Copy to Core repo
   rsync -av kb/ ../core.crit-fumble.com/kb/

   # Or let Core team pull from FumbleBot repo
   ```

4. Core automatically indexes new articles on restart

## MCP Tool Flow

```
┌─────────────────────────────────────────────────────────┐
│  AI Agent (Claude Desktop, etc.)                        │
└──────────────────┬──────────────────────────────────────┘
                   │ MCP Protocol (stdio)
                   ▼
┌─────────────────────────────────────────────────────────┐
│  FumbleBot MCP Server                                   │
│  - kb_search / kb_get_article / kb_list_* tools        │
└──────────────────┬──────────────────────────────────────┘
                   │ getCoreClient()
                   ▼
┌─────────────────────────────────────────────────────────┐
│  Core API Client (from @crit-fumble/core SDK)          │
│  - coreClient.kb.list()                                │
│  - coreClient.kb.get()                                 │
│  - coreClient.kb.getSystems()                          │
└──────────────────┬──────────────────────────────────────┘
                   │ HTTP (X-Core-Secret auth)
                   ▼
┌─────────────────────────────────────────────────────────┐
│  Core Server (core.crit-fumble.com)                    │
│  - GET /kb?search=...&system=...                       │
│  - GET /kb/:slug                                       │
│  - GET /kb/systems                                     │
└─────────────────────────────────────────────────────────┘
```

## Error Handling

**Core not configured:**
```
Error: Knowledge Base not available: Core API not configured.
Set CORE_SERVER_URL and CORE_SECRET.
```

**Article not found:**
```
Error: KB API error (404): Article not found: invalid/slug
```

**Search no results:**
```json
{
  "query": "nonexistent",
  "results": [],
  "total": 0
}
```

## Wiki Integration (Pending)

**Status**: Core SDK does not yet include wiki API

**Planned tools** (when Core implements):
- `wiki_search` - Search wiki pages
- `wiki_get_page` - Get wiki page content
- `wiki_list_pages` - List all wiki pages
- `wiki_recent_changes` - Get recent wiki updates

**Implementation notes**:
- Will likely mirror KB integration pattern
- May use GitHub Wiki API or custom wiki system
- Authentication same as KB (Core API secret)

**Waiting on**:
- Core to add wiki namespace to CoreApiClient
- Core to implement wiki endpoints
- Core SDK to publish updated types

## Testing

### Test KB Tools Locally

```bash
# 1. Start MCP server
npx tsx src/mcp/fumblebot-mcp-server.ts

# 2. In another terminal, test with MCP client
# (Requires MCP test client or Claude Desktop configured)

# 3. Or test Core SDK directly
npx tsx -e "
import { CoreApiClient } from '@crit-fumble/core';

const api = new CoreApiClient({
  baseUrl: process.env.CORE_SERVER_URL,
  apiKey: process.env.CORE_SECRET
});

const result = await api.kb.list({ system: 'dnd5e' });
console.log(result);
"
```

### Integration Test

```bash
# Test full stack: MCP -> Core -> KB
npm run test:integration -- kb-integration.test.ts
```

## Performance

**KB queries**:
- Search: ~50-200ms (depends on KB size)
- Get article: ~10-50ms (direct lookup)
- List systems: ~5-10ms (cached in Core)

**Caching**:
- Core caches KB index in memory
- Articles loaded on demand
- No FumbleBot-side caching needed

## Future Enhancements

1. **Semantic Search**: Use embeddings for better search relevance
2. **RAG Integration**: Feed KB articles to AI for context
3. **Real-time Updates**: WebSocket notifications when KB updates
4. **Multi-language**: Support for non-English KB content
5. **Wiki Integration**: Once Core implements wiki API

## Documentation

- **KB Content Guide**: [docs/agent/KB_CONTENT_GUIDE.md](./KB_CONTENT_GUIDE.md)
- **KB Migration to Core**: [docs/agent/KB_MIGRATION_TO_CORE.md](./KB_MIGRATION_TO_CORE.md)
- **Core SDK Docs**: `node_modules/@crit-fumble/core/README.md`

## Support

- **Issues**: Open in fumblebot.crit-fumble.com repo
- **Core API**: Contact Core team for endpoint questions
- **MCP Protocol**: See MCP SDK documentation

---

**Status**: Production-ready (KB tools)
**Wiki Status**: Pending Core implementation
**Last Updated**: 2025-12-01
