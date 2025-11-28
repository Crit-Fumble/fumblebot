# World Anvil MCP Server

Model Context Protocol (MCP) server for interacting with World Anvil API.

## Features

- **RPG Systems**: Fetch D&D 5e, Cypher System, and other RPG systems
- **Articles**: Retrieve world articles and lore
- **Characters**: Get character data and stat blocks
- **Search**: Search across World Anvil content
- **Rate Limiting**: Respects World Anvil API limits (60 requests/minute)
- **Caching**: PostgreSQL-backed caching to minimize API calls

---

## Installation

### 1. Install Dependencies

```bash
cd src/packages/worldanvil/mcp
npm install
```

### 2. Build

```bash
npm run build
```

### 3. Set Environment Variables

Create `.env` file:

```bash
# Required
WORLDANVIL_API_KEY="your-api-key-here"

# Optional (for authenticated requests)
WORLDANVIL_ACCESS_TOKEN="your-oauth-token"

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/critfumble"
```

---

## Usage

### Running the MCP Server

```bash
# Start the server
npm start

# Or use in development with auto-reload
npm run dev
```

### Using with Claude Desktop

Add to your Claude Desktop MCP config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "worldanvil": {
      "command": "node",
      "args": ["/path/to/www.crit-fumble.com/src/packages/worldanvil/mcp/dist/server.js"],
      "env": {
        "WORLDANVIL_API_KEY": "your-api-key",
        "DATABASE_URL": "postgresql://..."
      }
    }
  }
}
```

---

## Available Tools

### `worldanvil_get_rpg_systems`

Get list of all RPG systems available in World Anvil.

**Parameters**:
- `forceRefresh` (boolean, optional): Force refresh from API instead of cache

**Example**:
```
Use worldanvil_get_rpg_systems to fetch all available RPG systems
```

**Example with force refresh**:
```
Use worldanvil_get_rpg_systems with forceRefresh=true
```

---

### `worldanvil_get_rpg_system`

Get details about a specific RPG system.

**Parameters**:
- `identifier` (string, required): System ID or slug (e.g., "5e", "cypher-system")

**Example**:
```
Use worldanvil_get_rpg_system with identifier="5e"
```

---

### `worldanvil_get_world`

Get details about a World Anvil world.

**Parameters**:
- `worldId` (string, required): World ID or slug

**Example**:
```
Use worldanvil_get_world with worldId="your-world-slug"
```

---

### `worldanvil_get_articles`

Get articles from a world.

**Parameters**:
- `worldId` (string, required): World ID or slug
- `limit` (number, optional): Maximum articles to fetch (default: 20)
- `offset` (number, optional): Pagination offset (default: 0)

**Example**:
```
Use worldanvil_get_articles with worldId="your-world" and limit=50
```

---

### `worldanvil_get_article`

Get a specific article by ID.

**Parameters**:
- `articleId` (string, required): Article ID

**Example**:
```
Use worldanvil_get_article with articleId="123456"
```

---

### `worldanvil_get_characters`

Get characters from a world.

**Parameters**:
- `worldId` (string, required): World ID or slug
- `limit` (number, optional): Maximum characters to fetch (default: 20)

**Example**:
```
Use worldanvil_get_characters with worldId="your-world"
```

---

### `worldanvil_get_stat_blocks`

Get stat blocks from a world.

**Parameters**:
- `worldId` (string, required): World ID or slug
- `limit` (number, optional): Maximum stat blocks to fetch (default: 20)

**Example**:
```
Use worldanvil_get_stat_blocks with worldId="your-world"
```

---

### `worldanvil_search`

Search across World Anvil content.

**Parameters**:
- `worldId` (string, required): World ID or slug
- `query` (string, required): Search query
- `contentType` (string, optional): Content type filter (article, character, location, item, all)

**Example**:
```
Use worldanvil_search with worldId="your-world", query="dragon", and contentType="article"
```

---

## CLI Tools

### Fetch RPG Systems

```bash
# Fetch all RPG systems
tsx cli/fetch-rpg-systems.ts

# Fetch only D&D 5e and Cypher System
tsx cli/fetch-rpg-systems.ts --systems "5e,cypher-system"

# Use cached data
tsx cli/fetch-rpg-systems.ts --cache

# Output as TypeScript file
tsx cli/fetch-rpg-systems.ts --format typescript --output src/data/rpg-systems.ts

# Show help
tsx cli/fetch-rpg-systems.ts --help
```

---

## Rate Limiting

The MCP server automatically rate limits requests to World Anvil API:
- **Limit**: 60 requests per minute
- **Behavior**: Waits automatically if limit is reached
- **Caching**: Uses PostgreSQL to cache responses and minimize API calls

**Cache TTLs**:
- RPG Systems: 7 days
- Worlds: 24 hours
- Articles: 24 hours
- Characters: 24 hours

---

## Database Schema

Required tables (from `prisma/schema.prisma`):

```prisma
model WorldAnvilWorld {
  id               String    @id @default(uuid())
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  worldAnvilId     String    @unique
  slug             String?
  name             String
  description      String?
  url              String?
  playerId         String?
  lastSyncedAt     DateTime?
  data             Json

  articles         WorldAnvilArticle[]
  characters       WorldAnvilCharacter[]

  @@map("worldanvil_worlds")
}

model WorldAnvilArticle {
  id               String    @id @default(uuid())
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  syncedAt         DateTime?
  worldAnvilWorldId String
  worldAnvilId     String    @unique
  title            String
  slug             String?
  content          String?
  template         String?
  category         String?
  url              String?
  isPublic         Boolean   @default(true)
  isDraft          Boolean   @default(false)
  data             Json

  @@map("worldanvil_articles")
}

model WorldAnvilCharacter {
  id               String    @id @default(uuid())
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  syncedAt         DateTime?
  worldAnvilWorldId String
  worldAnvilId     String    @unique
  name             String
  title            String?
  content          String?
  statBlockId      String?
  data             Json

  @@map("worldanvil_characters")
}
```

Also requires a custom table for RPG systems:

```sql
CREATE TABLE worldanvil_rpg_systems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    synced_at TIMESTAMP,

    worldanvil_id INTEGER UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    publisher VARCHAR(255),
    official BOOLEAN DEFAULT false,
    community_created BOOLEAN DEFAULT false,
    icon_url TEXT,
    image_url TEXT,
    data JSONB,

    INDEX idx_worldanvil_id (worldanvil_id),
    INDEX idx_slug (slug),
    INDEX idx_synced_at (synced_at)
);
```

---

## Troubleshooting

### "WORLDANVIL_API_KEY environment variable is required"

Set your API key:
```bash
export WORLDANVIL_API_KEY="your-key-here"
```

Or add to `.env` file.

### Rate limit errors

The server automatically handles rate limiting. If you see warnings, it's working as expected.

### Database connection errors

Ensure `DATABASE_URL` is set correctly and database is running:
```bash
docker-compose up -d postgres
```

---

## Development

### Watch mode
```bash
npm run dev
```

### Build
```bash
npm run build
```

### Test with Claude Code

1. Build the MCP server
2. Configure in Claude Desktop
3. Ask Claude to use World Anvil tools

**Example prompts**:
- "Fetch all RPG systems from World Anvil"
- "Get the D&D 5e system details"
- "Search for dragon-related articles in my World Anvil world"

---

## License

MIT
