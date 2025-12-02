# Core Read-Only API Specification for FumbleBot

**Version**: 1.0
**Date**: 2025-12-01
**Author**: FumbleBot Team
**Target**: Core API Team

## Overview

FumbleBot requires read-only query access to all Core database tables to provide comprehensive RPG assistant features across Discord, web, and browser extension platforms. This specification defines the missing API endpoints needed for full read-only access.

## Architecture Principles

1. **Core as Source of Truth**: Core owns all persistent RPG data
2. **FumbleBot as Read-Only Consumer**: FumbleBot queries but never mutates Core data directly
3. **Auth-Agnostic**: Support both `userId` (Core ID) and `discordId` (Discord ID) where applicable
4. **Consistent Patterns**: Follow existing Core SDK patterns for pagination, filtering, and error handling

## Authentication

All endpoints require API key authentication via `X-API-Key` header (existing Core pattern).

Optional user context via:
- `userId` (Core user ID) - preferred
- `discordId` (Discord user ID) - auto-resolved to userId

## Common Response Patterns

### Pagination
```typescript
interface PaginatedRequest {
  limit?: number;      // Default: 20, Max: 100
  offset?: number;     // Default: 0
  cursor?: string;     // Optional cursor-based pagination
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  hasMore?: boolean;
  nextCursor?: string;
}
```

### Error Response
```typescript
interface ErrorResponse {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}
```

## Missing API Endpoints

### 1. Game Creatures API

**Endpoint**: `GET /api/v1/game/creatures`

**Purpose**: Query creature/monster stat blocks by system, type, tags

**Request**:
```typescript
interface ListCreaturesRequest extends PaginatedRequest {
  systemId?: string;           // Filter by game system
  type?: string;               // Filter by creature type (e.g., "undead", "dragon")
  tags?: string[];             // Filter by tags
  search?: string;             // Search by name/description
  source?: string;             // Filter by source book
}
```

**Response**:
```typescript
interface ListCreaturesResponse extends PaginatedResponse<GameCreature> {}
```

**Endpoint**: `GET /api/v1/game/creatures/:id`

**Purpose**: Get single creature by ID

**Response**:
```typescript
interface GetCreatureResponse {
  creature: GameCreature;
}
```

**Use Cases**:
- `/creature lookup owlbear` - Find creature stat blocks
- Browser extension: auto-populate creature stats in VTT
- Discord: inline creature reference lookup

---

### 2. Game Decks API

**Endpoint**: `GET /api/v1/game/decks`

**Purpose**: Query card decks by system and type

**Request**:
```typescript
interface ListDecksRequest extends PaginatedRequest {
  systemId?: string;           // Filter by game system
  type?: string;               // Filter by deck type (e.g., "tarot", "playing")
  search?: string;             // Search by name/description
}
```

**Response**:
```typescript
interface ListDecksResponse extends PaginatedResponse<GameDeck> {}
```

**Endpoint**: `GET /api/v1/game/decks/:id`

**Purpose**: Get single deck with all cards

**Response**:
```typescript
interface GetDeckResponse {
  deck: GameDeck & {
    cards: GameCard[];         // Include all cards in deck
  };
}
```

**Use Cases**:
- `/deck draw tarot` - Draw cards from deck
- Browser extension: sync deck state with VTT
- Discord: card draw commands

---

### 3. Game Cards API

**Endpoint**: `GET /api/v1/game/decks/:deckId/cards`

**Purpose**: Query cards within a specific deck

**Request**:
```typescript
interface ListCardsRequest extends PaginatedRequest {
  suit?: string;               // Filter by suit
  search?: string;             // Search by name/description
}
```

**Response**:
```typescript
interface ListCardsResponse extends PaginatedResponse<GameCard> {}
```

**Endpoint**: `GET /api/v1/game/cards/:id`

**Purpose**: Get single card by ID

**Response**:
```typescript
interface GetCardResponse {
  card: GameCard;
}
```

**Use Cases**:
- `/card lookup "ace of spades"` - Find specific card
- Discord: card reference with image
- Browser extension: card preview on hover

---

### 4. Game Sheet Templates API

**Endpoint**: `GET /api/v1/game/sheets`

**Purpose**: Query character sheet templates by system

**Request**:
```typescript
interface ListSheetTemplatesRequest extends PaginatedRequest {
  systemId?: string;           // Filter by game system
  search?: string;             // Search by name/description
}
```

**Response**:
```typescript
interface ListSheetTemplatesResponse extends PaginatedResponse<GameSheet> {}
```

**Endpoint**: `GET /api/v1/game/sheets/:id`

**Purpose**: Get single sheet template with field mappings

**Response**:
```typescript
interface GetSheetTemplateResponse {
  sheet: GameSheet;
}
```

**Use Cases**:
- Browser extension: map VTT character fields to Core schema
- Discord: `/character create` - scaffold from template
- Web app: character sheet builder

---

### 5. Campaign Players API

**Endpoint**: `GET /api/v1/campaigns/:campaignId/players`

**Purpose**: Query all players in a campaign

**Request**:
```typescript
interface ListPlayersRequest extends PaginatedRequest {
  role?: 'gm' | 'player' | 'spectator';  // Filter by role
}
```

**Response**:
```typescript
interface ListPlayersResponse extends PaginatedResponse<CritPlayer & {
  user?: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };
  sheets?: CritSheet[];        // Include player's character sheets
}> {}
```

**Endpoint**: `GET /api/v1/players/:id`

**Purpose**: Get single player with sheets and account info

**Response**:
```typescript
interface GetPlayerResponse {
  player: CritPlayer & {
    account?: CritAccount;
    sheets: CritSheet[];
  };
}
```

**Use Cases**:
- Discord: `/campaign roster` - Show all players
- Browser extension: auto-populate player permissions in VTT
- Web app: campaign member management UI

---

### 6. Session Messages API

**Endpoint**: `GET /api/v1/sessions/:sessionId/messages`

**Purpose**: Query messages/transcript from a game session

**Request**:
```typescript
interface ListSessionMessagesRequest extends PaginatedRequest {
  messageType?: MessageType[];          // Filter by type (ic, ooc, narration, roll, system)
  characterId?: string;                 // Filter by character
  discordId?: string;                   // Filter by user
  startTime?: string;                   // ISO timestamp
  endTime?: string;                     // ISO timestamp
  search?: string;                      // Full-text search in content
}
```

**Response**:
```typescript
interface ListSessionMessagesResponse extends PaginatedResponse<SessionMessage & {
  character?: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  user?: {
    username: string;
    avatarUrl: string | null;
  };
}> {}
```

**Endpoint**: `GET /api/v1/sessions/:sessionId/messages/export`

**Purpose**: Export session transcript in various formats

**Request**:
```typescript
interface ExportMessagesRequest {
  format: 'json' | 'markdown' | 'html' | 'txt';
  includeRolls?: boolean;      // Include dice rolls
  includeOOC?: boolean;        // Include out-of-character messages
  includeSystem?: boolean;     // Include system messages
}
```

**Response**:
```typescript
interface ExportMessagesResponse {
  content: string;             // Formatted transcript
  mimeType: string;            // Content-Type for download
}
```

**Use Cases**:
- Discord: `/session recap` - Show recent session activity
- Web app: Session history viewer
- Browser extension: Export to World Anvil notes
- AI: Generate session summaries

---

### 7. Campaign Assets API

**Endpoint**: `GET /api/v1/campaigns/:campaignId/assets`

**Purpose**: Query campaign assets (images, maps, tokens, audio)

**Request**:
```typescript
interface ListAssetsRequest extends PaginatedRequest {
  type?: AssetType[];          // Filter by type (audio, image, video, map, token)
  search?: string;             // Search by name
  uploadedBy?: string;         // Filter by uploader
  minSize?: number;            // Min file size in bytes
  maxSize?: number;            // Max file size in bytes
}
```

**Response**:
```typescript
interface ListAssetsResponse extends PaginatedResponse<Asset & {
  url?: string;                // Signed URL for asset access (temporary)
  thumbnailUrl?: string;       // Thumbnail URL if available
}> {}
```

**Endpoint**: `GET /api/v1/assets/:id`

**Purpose**: Get single asset with download URL

**Response**:
```typescript
interface GetAssetResponse {
  asset: Asset & {
    url: string;               // Signed URL for download (expires in 1 hour)
    thumbnailUrl?: string;
  };
}
```

**Use Cases**:
- Browser extension: Sync assets between platforms (Roll20 ↔ Foundry ↔ Core)
- Discord: `/asset search map forest` - Find campaign assets
- Web app: Asset library browser
- AI: Image analysis for map/token recognition

---

### 8. World Snapshots API

**Endpoint**: `GET /api/v1/campaigns/:campaignId/snapshots`

**Purpose**: Query Foundry world snapshots for a campaign

**Request**:
```typescript
interface ListSnapshotsRequest extends PaginatedRequest {
  isAuto?: boolean;            // Filter auto vs manual snapshots
  createdBy?: string;          // Filter by creator
}
```

**Response**:
```typescript
interface ListSnapshotsResponse extends PaginatedResponse<WorldSnapshot> {}
```

**Endpoint**: `GET /api/v1/snapshots/:id`

**Purpose**: Get single snapshot details

**Response**:
```typescript
interface GetSnapshotResponse {
  snapshot: WorldSnapshot;
}
```

**Endpoint**: `GET /api/v1/snapshots/:id/download`

**Purpose**: Download snapshot archive

**Response**:
```typescript
interface DownloadSnapshotResponse {
  url: string;                 // Signed download URL (expires in 1 hour)
  sizeBytes: number;
  expiresAt: string;           // ISO timestamp
}
```

**Use Cases**:
- Discord: `/snapshot list` - View available backups
- Web app: Snapshot management UI
- Browser extension: Restore Foundry world from snapshot
- AI: World state analysis

---

### 9. Discord Guilds API

**Endpoint**: `GET /api/v1/guilds`

**Purpose**: List all guilds the user has access to

**Request**:
```typescript
interface ListGuildsRequest extends PaginatedRequest {
  discordId?: string;          // Filter by user access (auto-inferred from auth)
  search?: string;             // Search by guild name
}
```

**Response**:
```typescript
interface ListGuildsResponse extends PaginatedResponse<DiscordGuild & {
  campaignCount?: number;      // Number of campaigns in guild
}> {}
```

**Endpoint**: `GET /api/v1/guilds/:guildId`

**Purpose**: Get single guild details

**Response**:
```typescript
interface GetGuildResponse {
  guild: DiscordGuild;
  campaigns?: Array<{          // Optional: include campaigns
    id: string;
    name: string;
    status: CampaignStatus;
  }>;
}
```

**Use Cases**:
- Web app: Guild/server selector
- Discord: `/guild info` - Show guild stats
- Browser extension: Auto-detect active guild context

---

### 10. Foundry Systems API

**Endpoint**: `GET /api/v1/foundry/systems`

**Purpose**: Query available Foundry VTT game systems

**Request**:
```typescript
interface ListFoundrySystemsRequest extends PaginatedRequest {
  isEnabled?: boolean;         // Filter by enabled status
  search?: string;             // Search by title/description
}
```

**Response**:
```typescript
interface ListFoundrySystemsResponse extends PaginatedResponse<FoundrySystemRecord> {}
```

**Endpoint**: `GET /api/v1/foundry/systems/:systemId`

**Purpose**: Get single Foundry system details

**Response**:
```typescript
interface GetFoundrySystemResponse {
  system: FoundrySystemRecord;
}
```

**Use Cases**:
- Discord: `/foundry systems` - List available systems
- Browser extension: System compatibility check
- Web app: Campaign creation wizard

---

### 11. User Activity API

**Endpoint**: `GET /api/v1/users/activity`

**Purpose**: Get user's activity across all guilds and campaigns

**Request**:
```typescript
interface GetUserActivityRequest {
  userId?: string;             // Core user ID
  discordId?: string;          // Discord user ID (auto-resolved)
  includeArchived?: boolean;   // Include archived campaigns
}
```

**Response**:
```typescript
interface GetUserActivityResponse {
  activity: UserActivity[];    // One per guild
}
```

**Use Cases**:
- Web app: User dashboard showing all campaigns
- Discord: `/my campaigns` - Show user's active games
- Browser extension: Quick campaign switcher

---

## SDK Client Structure

All new endpoints should be accessible via the Core SDK client:

```typescript
import { CoreApiClient } from '@crit-fumble/core/client';

const client = new CoreApiClient({ baseUrl, apiKey });

// Existing APIs (already implemented)
client.auth.*;
client.campaigns.*;
client.characters.*;
client.sessions.*;
client.voice.*;
client.dice.*;
client.games.*;
client.accounts.*;

// NEW APIs (needed)
client.creatures.*;          // Game creatures
client.decks.*;              // Game decks and cards
client.sheets.*;             // Game sheet templates
client.players.*;            // Campaign players
client.messages.*;           // Session messages
client.assets.*;             // Campaign assets
client.snapshots.*;          // World snapshots
client.guilds.*;             // Discord guilds
client.foundry.*;            // Foundry systems
client.activity.*;           // User activity
```

## TypeScript Type Generation

All request/response types should be auto-generated from Core database schema and exported in `@crit-fumble/core/dist/types/*.d.ts`.

## Rate Limiting

Suggested rate limits (per API key):
- **List endpoints**: 100 requests/minute
- **Get single item**: 200 requests/minute
- **Download/export**: 10 requests/minute

## Caching Strategy

FumbleBot will implement client-side caching:
- **Static data** (creatures, decks, sheet templates): 1 hour cache
- **User activity** (campaigns, characters): 5 minute cache
- **Session messages**: 30 second cache
- **Assets**: No cache (signed URLs expire)

## Error Codes

Follow existing Core error code patterns:

- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (missing/invalid API key)
- `403` - Forbidden (no access to resource)
- `404` - Not Found
- `429` - Rate Limit Exceeded
- `500` - Internal Server Error

## Migration Path

**Phase 1** (Priority - needed immediately):
- Session messages API (for AI session recaps)
- Campaign players API (for roster commands)
- User activity API (for web app dashboard)

**Phase 2** (Next 2 weeks):
- Game creatures API (for monster lookup)
- Game decks/cards API (for card draw mechanics)
- Campaign assets API (for asset sync)

**Phase 3** (Future):
- Sheet templates API (for character creation)
- World snapshots API (for backup management)
- Foundry systems API (for system selector)
- Discord guilds API (for guild management)

## Testing Requirements

Each endpoint should have:
1. **Unit tests** - Request validation, response serialization
2. **Integration tests** - Database queries, auth checks
3. **Load tests** - Handle 1000 req/min per endpoint

## Documentation Requirements

Each endpoint should have:
1. OpenAPI/Swagger specification
2. Example requests/responses
3. SDK usage examples in TypeScript
4. Rate limits and caching guidelines

## Questions for Core Team

1. **Pagination**: Cursor-based or offset-based preferred?
2. **Filtering**: Use query params or POST body for complex filters?
3. **Includes**: Support `?include=` param for related resources?
4. **Versioning**: All new endpoints under `/api/v1/`?
5. **WebSockets**: Future support for real-time updates (e.g., session messages)?

## Success Criteria

FumbleBot can:
1. ✅ Query any Core table without direct database access
2. ✅ Build comprehensive AI-powered features (recaps, lookups, recommendations)
3. ✅ Sync data between Discord, web, browser extension, and VTT platforms
4. ✅ Never directly mutate Core data (read-only contract maintained)

---

**Contact**: Forward questions to FumbleBot team
**Timeline**: Phase 1 endpoints needed by 2025-12-15 for web app launch
