# Discord Channels as Knowledge Base Sources

## Status: Backend Complete

The backend API and services are fully implemented. Web UI is pending.

## Overview

Enable FumbleBot to read Discord channels (especially forums) and use their content as knowledge base sources. Includes a web UI at fumblebot.crit-fumble.com for guild admins to configure which channels contain important context.

## Implementation Summary

### Completed
- [x] **Prisma Schema**: `ChannelKBSource` model with `ChannelKBType` enum
- [x] **Channel Reader**: `DiscordChannelReader` service to read text/forum/thread channels
- [x] **API Routes**: Full CRUD + sync endpoints at `/api/admin/guilds/:guildId/channel-kb/*`
- [x] **Controller**: Handlers for all channel-kb operations
- [x] **Sync Service**: Background sync scheduler with per-source and per-guild sync

### Pending
- [ ] **Web UI**: Admin interface at fumblebot.crit-fumble.com/admin
- [ ] **Core Integration**: Send indexed documents to Core's KB API

## Architecture

### Current State
- **Auth**: Discord OAuth2 with server-side sessions (already implemented)
- **Admin Routes**: Guild admin middleware validates permissions (already implemented)
- **Prompt Partials**: Channel/category/role-specific AI prompts (pattern to follow)
- **KB Client**: Communicates with Core's /api/kb/* for semantic search
- **AI Pipeline**: Message handler queries KB first, falls back to web search

### Proposed Flow
```
Discord Channel/Forum → FumbleBot reads → Sends to Core → Core indexes with embeddings
                                              ↓
User asks question → AI queries Core KB → Returns relevant context
```

## Implementation Plan

### Phase 1: Database Schema

Add to `prisma/schema.prisma`:

```prisma
// Discord channel as knowledge base source
model ChannelKBSource {
  id        String   @id @default(cuid())
  guildId   String

  // Channel info
  channelId   String
  channelName String?
  channelType String   // 'text' | 'forum' | 'thread'

  // Configuration
  name        String   // User-friendly name like "House Rules"
  description String?
  category    String   @default("general") // KB category for search filtering

  // Sync settings
  syncEnabled   Boolean @default(true)
  syncThreads   Boolean @default(true)  // For forums: sync all threads
  syncPinned    Boolean @default(true)  // Prioritize pinned messages
  maxMessages   Int     @default(100)   // Limit per channel/thread

  // Audit
  createdBy String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  lastSyncAt DateTime?
  lastSyncStatus String? // 'success' | 'error' | 'partial'
  lastSyncError  String?

  guild Guild @relation(fields: [guildId], references: [guildId], onDelete: Cascade)

  @@unique([guildId, channelId])
  @@index([guildId])
}
```

Update Guild model:
```prisma
model Guild {
  // ... existing fields
  channelKBSources ChannelKBSource[]
}
```

### Phase 2: Discord Channel Reader Service

Create `src/services/discord/channel-reader.ts`:

```typescript
interface ChannelContent {
  channelId: string;
  channelName: string;
  channelType: 'text' | 'forum' | 'thread';
  messages: MessageContent[];
  threads?: ThreadContent[];
}

interface MessageContent {
  id: string;
  content: string;
  author: string;
  timestamp: Date;
  isPinned: boolean;
  attachments?: string[]; // URLs for future processing
}

interface ThreadContent {
  id: string;
  name: string;
  messages: MessageContent[];
  tags?: string[]; // Forum tags
  isPinned: boolean;
}

class DiscordChannelReader {
  // Read text channel messages
  async readTextChannel(channelId: string, options: ReadOptions): Promise<ChannelContent>;

  // Read forum channel with all threads
  async readForumChannel(channelId: string, options: ReadOptions): Promise<ChannelContent>;

  // Read single thread
  async readThread(threadId: string, options: ReadOptions): Promise<ThreadContent>;

  // Format content for KB ingestion
  formatForKB(content: ChannelContent): KBDocument[];
}
```

### Phase 3: API Endpoints

Add to `src/routes.ts` under admin category:

```typescript
channelKB: [
  {
    method: 'get',
    path: '/api/admin/guilds/:guildId/channel-kb',
    handler: 'handleListChannelKBSources',
    description: 'List all channel KB sources for a guild',
  },
  {
    method: 'get',
    path: '/api/admin/guilds/:guildId/channel-kb/:id',
    handler: 'handleGetChannelKBSource',
    description: 'Get a specific channel KB source',
  },
  {
    method: 'post',
    path: '/api/admin/guilds/:guildId/channel-kb',
    handler: 'handleCreateChannelKBSource',
    description: 'Create a new channel KB source',
  },
  {
    method: 'post',
    path: '/api/admin/guilds/:guildId/channel-kb/:id',
    handler: 'handleUpdateChannelKBSource',
    description: 'Update a channel KB source',
  },
  {
    method: 'delete',
    path: '/api/admin/guilds/:guildId/channel-kb/:id',
    handler: 'handleDeleteChannelKBSource',
    description: 'Delete a channel KB source',
  },
  {
    method: 'post',
    path: '/api/admin/guilds/:guildId/channel-kb/:id/sync',
    handler: 'handleSyncChannelKBSource',
    description: 'Trigger sync for a channel KB source',
  },
  {
    method: 'get',
    path: '/api/admin/guilds/:guildId/channels',
    handler: 'handleListGuildChannels',
    description: 'List available channels for KB configuration',
  },
]
```

### Phase 4: Controller Implementation

Create `src/controllers/channel-kb.ts`:

```typescript
export class ChannelKBController {
  // CRUD operations using Prisma
  async list(guildId: string): Promise<ChannelKBSource[]>;
  async get(guildId: string, id: string): Promise<ChannelKBSource>;
  async create(guildId: string, data: CreateChannelKBData): Promise<ChannelKBSource>;
  async update(guildId: string, id: string, data: UpdateChannelKBData): Promise<ChannelKBSource>;
  async delete(guildId: string, id: string): Promise<void>;

  // Sync with Core KB
  async sync(guildId: string, id: string): Promise<SyncResult>;
  async syncAll(guildId: string): Promise<SyncResult[]>;

  // List available channels
  async listGuildChannels(guildId: string): Promise<ChannelInfo[]>;
}
```

### Phase 5: Core Integration

Add to Core's KB ingestion API:

```typescript
// POST /api/kb/ingest/discord
interface DiscordKBIngestRequest {
  guildId: string;
  sourceId: string;  // ChannelKBSource.id
  sourceName: string;
  category: string;
  documents: {
    id: string;      // message/thread ID
    title: string;   // thread name or channel name
    content: string; // formatted message content
    metadata: {
      channelId: string;
      threadId?: string;
      author: string;
      timestamp: string;
      isPinned: boolean;
      tags?: string[];
    };
  }[];
}
```

### Phase 6: Web UI

The UI will be served from the existing fumblebot.crit-fumble.com infrastructure.

Routes to add:
- `/admin` - Admin dashboard (guild selector)
- `/admin/guilds/:guildId` - Guild dashboard
- `/admin/guilds/:guildId/channel-kb` - Channel KB configuration

UI Components:
1. **Guild Selector** - List guilds where user is admin
2. **Channel KB List** - Table of configured sources with sync status
3. **Add/Edit Modal** - Select channel, configure sync options
4. **Sync Status** - Show last sync time, errors, document count

Tech Stack:
- Use existing Express server
- Server-rendered HTML with HTMX for interactivity (matches existing pattern)
- Or: Lightweight React SPA if Core's activity UI pattern preferred

### Phase 7: Background Sync

Create `src/services/discord/channel-kb-sync.ts`:

```typescript
class ChannelKBSyncService {
  // Scheduled sync (cron-like, runs every N hours)
  async scheduledSync(): Promise<void>;

  // On-demand sync for specific source
  async syncSource(sourceId: string): Promise<SyncResult>;

  // Incremental sync (only new messages since lastSyncAt)
  async incrementalSync(sourceId: string): Promise<SyncResult>;

  // Full resync (clear and reimport)
  async fullResync(sourceId: string): Promise<SyncResult>;
}
```

## File Changes Required

### New Files
- `src/services/discord/channel-reader.ts` - Read Discord channels
- `src/services/discord/channel-kb-sync.ts` - Sync service
- `src/controllers/channel-kb.ts` - API handlers
- `src/views/admin/*.ejs` or `src/views/admin/*.tsx` - UI templates

### Modified Files
- `prisma/schema.prisma` - Add ChannelKBSource model
- `src/routes.ts` - Add channel-kb routes
- `src/server.ts` - Mount admin routes, initialize sync service

## Security Considerations

1. **Guild Admin Only** - All channel-kb endpoints require `requireGuildAdmin` middleware
2. **Bot Permissions** - Bot must have read access to channels being indexed
3. **Content Filtering** - Skip messages with sensitive patterns (tokens, passwords)
4. **Rate Limiting** - Limit sync frequency to prevent Discord API abuse
5. **Data Retention** - Clear KB content when source is deleted

## Open Questions

1. **Real-time Updates**: Should we use Discord gateway events to update KB on new messages?
2. **Content Size**: How to handle very long threads/channels? Summarize or paginate?
3. **Attachments**: Should we extract text from images/PDFs in attachments?
4. **Private Channels**: How to handle access control for private channel content?

## Next Steps

1. Add ChannelKBSource to Prisma schema
2. Implement Discord channel reader service
3. Create API endpoints and controller
4. Add Core KB ingestion endpoint (Core repo)
5. Build admin UI
6. Add background sync service
7. Test end-to-end flow
