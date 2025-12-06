# FumbleBot → Core Migration Plan

**Date:** 2025-12-06
**Status:** Planning
**Goal:** Establish Core as the central platform; FumbleBot becomes a stateless AI interface

---

## Executive Summary

FumbleBot currently handles both AI/Discord bot functionality AND platform infrastructure. This plan establishes Core as the **central platform** that owns all data and functionality, with FumbleBot becoming a pure **AI interface layer**.

**Core (Platform):**
- All data storage (dice rolls, game sessions, characters, campaigns, TTRPG rules)
- All business logic APIs
- Authentication, admin, knowledge base
- The "toolbox" that powers everything

**FumbleBot (AI Interface):**
- Discord bot gateway (slash commands, context menus, events)
- AI service integration (Claude, GPT-4, Gradient)
- Voice processing (Discord voice, Deepgram STT/TTS)
- AI memory database (user preferences, personas, conversation memory)
- Translates user intent → Core API calls → AI-enhanced responses

**Key Principle:** Core is the platform. FumbleBot is an AI-powered interface that uses Core's APIs as tools to serve users. FumbleBot maintains a small local database for AI memory and user preferences - this is AI-specific data that shapes how the bot interacts with each user.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CORE (Platform)                                 │
│                    Source of Truth for Everything                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │     Auth     │  │    Admin     │  │  Knowledge   │  │    Dice    │  │
│  │   - OAuth2   │  │  - Guilds    │  │     Base     │  │  - Rolls   │  │
│  │   - Sessions │  │  - Prompts   │  │  - TTRPG     │  │  - Stats   │  │
│  │   - Users    │  │  - Settings  │  │  - Rules     │  │  - History │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │   Campaigns  │  │  Characters  │  │    Game      │  │  Discord   │  │
│  │  - CRUD      │  │  - Sheets    │  │   Sessions   │  │  Activity  │  │
│  │  - History   │  │  - Stats     │  │  - State     │  │   Assets   │  │
│  │  - Players   │  │  - Items     │  │  - Logs      │  │   Proxy    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │ SDK API Calls (Toolbox)
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                      FUMBLEBOT (AI Interface)                           │
│                  Stateless - Uses Core as Toolbox                       │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                     Discord Gateway                                │ │
│  │  - Slash Commands    - Context Menus    - Events    - Interactions │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────┐  │
│  │     AI Services      │  │   Voice Processing   │  │  AI Memory   │  │
│  │  - Claude            │  │  - Discord Voice     │  │  - User      │  │
│  │  - GPT-4             │  │  - Deepgram STT      │  │    prefs     │  │
│  │  - Gradient          │  │  - TTS Synthesis     │  │  - Personas  │  │
│  └──────────────────────┘  └──────────────────────┘  └──────────────┘  │
│                                                                         │
│  User Intent ──▶ AI Processing ──▶ Core API Calls ──▶ Response         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Migration Phases

### Phase 1: Authentication & Authorization (Priority: Critical)

**What Moves:**
- OAuth2 flows (Discord Activity SDK token exchange, web OAuth callback)
- Session management (Express sessions, cookies)
- User authentication middleware
- CSRF protection

**FumbleBot Files:**
```
src/controllers/auth.ts          (~455 lines)
src/middleware.ts (session)      (~150 lines)
src/controllers/sessions.ts      (~40 lines)
```

**New Core Endpoints:**
```
POST /api/auth/token              - OAuth2 token exchange (Activity SDK)
GET  /api/auth/callback           - OAuth2 callback (web)
GET  /api/auth/me                 - Get current user
POST /api/auth/logout             - Logout / destroy session
GET  /api/auth/guilds             - Get user's Discord guilds
GET  /api/auth/activities         - Get user's active activities
POST /api/auth/session            - Create activity session
GET  /api/auth/session/:id        - Get session by ID
```

**Core SDK Additions:**
```typescript
// @crit-fumble/core SDK additions
interface AuthApi {
  tokenExchange(code: string): Promise<TokenExchangeResponse>;
  getUser(): Promise<AuthMeResponse>;
  logout(): Promise<void>;
  getGuilds(): Promise<AuthGuildsResponse>;
  getActivities(): Promise<AuthActivitiesResponse>;
  createSession(data: CreateSessionRequest): Promise<SessionResponse>;
  getSession(id: string): Promise<SessionResponse>;
}
```

**FumbleBot Changes:**
- Remove auth controller and routes
- Use Core SDK for any auth needs
- Remove session middleware (Core handles sessions via cookies)

---

### Phase 2: Admin Dashboard API (Priority: High)

**What Moves:**
- Guild settings management
- Guild metrics/analytics
- Prompt partials CRUD
- Channel knowledge base management
- Activity timeline

**FumbleBot Files:**
```
src/controllers/admin.ts         (~317 lines)
src/controllers/prompts.ts       (~395 lines)
src/controllers/channel-kb.ts    (~200 lines)
```

**New Core Endpoints:**
```
# Guild Settings & Metrics
GET  /api/admin/guilds/:guildId/settings      - Get guild settings
POST /api/admin/guilds/:guildId/settings      - Update guild settings
GET  /api/admin/guilds/:guildId/metrics       - Get guild metrics
GET  /api/admin/guilds/:guildId/activity      - Get activity timeline

# Prompt Partials
GET    /api/admin/guilds/:guildId/prompts              - List prompts
GET    /api/admin/guilds/:guildId/prompts/:id          - Get prompt
GET    /api/admin/guilds/:guildId/prompts/for-context  - Get prompts for AI context
POST   /api/admin/guilds/:guildId/prompts              - Create prompt
PUT    /api/admin/guilds/:guildId/prompts/:id          - Update prompt
DELETE /api/admin/guilds/:guildId/prompts/:id          - Delete prompt

# Channel Knowledge Base
GET    /api/admin/guilds/:guildId/channels             - List guild channels
GET    /api/admin/guilds/:guildId/channel-kb           - List KB sources
GET    /api/admin/guilds/:guildId/channel-kb/:id       - Get KB source
POST   /api/admin/guilds/:guildId/channel-kb           - Create KB source
PUT    /api/admin/guilds/:guildId/channel-kb/:id       - Update KB source
DELETE /api/admin/guilds/:guildId/channel-kb/:id       - Delete KB source
POST   /api/admin/guilds/:guildId/channel-kb/:id/sync  - Trigger sync
```

**Core SDK Additions:**
```typescript
interface AdminApi {
  guilds: {
    getSettings(guildId: string): Promise<GuildSettings>;
    updateSettings(guildId: string, settings: Partial<GuildSettings>): Promise<GuildSettings>;
    getMetrics(guildId: string): Promise<GuildMetrics>;
    getActivity(guildId: string, options?: ActivityOptions): Promise<ActivityTimeline>;
  };
  prompts: {
    list(guildId: string): Promise<PromptPartial[]>;
    get(guildId: string, id: string): Promise<PromptPartial>;
    getForContext(guildId: string, context: PromptContext): Promise<PromptPartial[]>;
    create(guildId: string, data: CreatePromptRequest): Promise<PromptPartial>;
    update(guildId: string, id: string, data: UpdatePromptRequest): Promise<PromptPartial>;
    delete(guildId: string, id: string): Promise<void>;
  };
  channelKB: {
    listChannels(guildId: string): Promise<GuildChannel[]>;
    list(guildId: string): Promise<ChannelKBSource[]>;
    get(guildId: string, id: string): Promise<ChannelKBSource>;
    create(guildId: string, data: CreateKBSourceRequest): Promise<ChannelKBSource>;
    update(guildId: string, id: string, data: UpdateKBSourceRequest): Promise<ChannelKBSource>;
    delete(guildId: string, id: string): Promise<void>;
    sync(guildId: string, id: string): Promise<SyncResult>;
  };
}
```

**Database Models to Migrate:**
```prisma
model Guild {
  id              String   @id
  name            String?
  settings        Json     @default("{}")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model GuildMember {
  id        String   @id @default(cuid())
  guildId   String
  odId      String
  role      String   @default("member")
  joinedAt  DateTime @default(now())
  @@unique([guildId, odId])
}

model PromptPartial {
  id          String   @id @default(cuid())
  guildId     String
  name        String
  content     String   @db.Text
  type        String   // 'system', 'context', 'instruction'
  scope       String   // 'guild', 'channel', 'category', 'role'
  scopeId     String?  // channel/category/role ID if scoped
  priority    Int      @default(0)
  enabled     Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@index([guildId, scope])
}

model ChannelKBSource {
  id          String   @id @default(cuid())
  guildId     String
  channelId   String
  name        String
  description String?
  syncEnabled Boolean  @default(true)
  lastSyncAt  DateTime?
  messageCount Int     @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@unique([guildId, channelId])
}

model BotCommand {
  id          String   @id @default(cuid())
  guildId     String
  channelId   String
  userId      String
  command     String
  args        String?
  result      String?  @db.Text
  executedAt  DateTime @default(now())
  durationMs  Int?
  @@index([guildId, executedAt])
}

model DiceRoll {
  id          String   @id @default(cuid())
  guildId     String
  channelId   String
  userId      String
  characterId String?
  campaignId  String?
  notation    String   // e.g., "2d20kh1+5"
  rolls       Json     // individual die results
  total       Int
  reason      String?
  createdAt   DateTime @default(now())
  @@index([guildId, createdAt])
  @@index([userId, createdAt])
  @@index([characterId])
}

model GameSession {
  id          String   @id @default(cuid())
  campaignId  String
  guildId     String
  channelId   String?
  status      String   @default("active") // active, paused, ended
  startedAt   DateTime @default(now())
  endedAt     DateTime?
  events      Json     @default("[]") // session event log
  @@index([campaignId])
  @@index([guildId, status])
}
```

**FumbleBot Changes:**
- Remove admin, prompts, channel-kb controllers
- Call Core SDK `admin.prompts.getForContext()` when building AI prompts
- Remove database models (use Core as source of truth)

---

### Phase 3: Security & Middleware (Priority: High)

**What Moves:**
- CORS configuration
- Security headers (CSP, HSTS, etc.)
- Rate limiting
- Body parsing configuration

**FumbleBot Files:**
```
src/middleware.ts (security section)     (~200 lines)
src/middleware/proxy/cors.ts             (~91 lines)
src/middleware/proxy/security.ts         (~150 lines)
src/middleware/rate-limit.ts             (~141 lines)
src/middleware/proxy/rate-limit.ts       (~179 lines)
```

**Core Implementation:**
- Core already has middleware infrastructure
- Add Discord-specific CORS origins
- Add Activity iframe CSP directives
- Implement rate limiting with user/guild scoping

**CORS Allowed Origins:**
```typescript
const ALLOWED_ORIGINS = [
  'https://discord.com',
  'https://discordapp.com',
  'https://ptb.discord.com',
  'https://canary.discord.com',
  /\.discordsays\.com$/,
  /\.crit-fumble\.com$/,
  // Development
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
];
```

**CSP for Discord Activities:**
```typescript
const activityCSP = {
  'frame-ancestors': ["'self'", 'https://discord.com', 'https://*.discord.com'],
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'", 'https://discord.com'],
  'style-src': ["'self'", "'unsafe-inline'"],
  'connect-src': ["'self'", 'https://*.discord.com', 'wss://*.discord.gg'],
  'img-src': ["'self'", 'data:', 'https:', 'blob:'],
};
```

---

### Phase 4: Command & Chat API (Priority: Medium)

**What Moves:**
- HTTP API for command execution
- Chat message routing
- Command analytics logging

**FumbleBot Files:**
```
src/controllers/commands.ts      (~147 lines)
src/controllers/chat.ts          (~178 lines)
```

**Challenge:** These have AI coupling. Commands can trigger AI responses.

**Solution Architecture:**
```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│     Core     │────▶│  FumbleBot  │
│  (Discord)  │     │  (Routing)   │     │    (AI)     │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   Database   │
                    │  (Logging)   │
                    └──────────────┘
```

**New Core Endpoints:**
```
POST /api/commands              - Execute command (routes to FumbleBot if AI needed)
GET  /api/commands              - List available commands
POST /api/chat                  - Process chat message (routes to FumbleBot if AI needed)
```

**New FumbleBot Endpoints (Internal):**
```
POST /internal/ai/command       - Execute AI-powered command
POST /internal/ai/chat          - Process AI chat message
```

**Core SDK Additions:**
```typescript
interface CommandsApi {
  list(): Promise<CommandDefinition[]>;
  execute(command: string, context: CommandContext): Promise<CommandResult>;
}

interface ChatApi {
  send(message: ChatMessage, context: ChatContext): Promise<ChatResponse>;
}
```

---

### Phase 5: Proxy Removal (Priority: Medium)

**What's Removed:**
Once Core handles auth/admin/activities directly, FumbleBot no longer needs:

```
src/middleware/proxy/core-proxy.ts       - No longer proxying to Core
src/services/container/proxy.ts          - Container proxy (if containers move)
Activity proxy in middleware.ts          - Core serves activities directly
```

**Architecture Change:**
```
BEFORE:
  Discord Activity → FumbleBot (proxy) → Core → Response

AFTER:
  Discord Activity → Core → Response
  Discord Activity → Core → FumbleBot (AI only) → Core → Response
```

---

### Phase 6: Health & Status (Priority: Low)

**What Moves:**
- Health check endpoints
- Detailed health with dependency status

**New Core Endpoints:**
```
GET /health                     - Simple health check
GET /health/detailed            - Detailed health (DB, services, FumbleBot status)
```

**FumbleBot keeps:**
```
GET /health                     - FumbleBot-specific health (AI services, Discord)
```

---

## Data Ownership

### Core Owns (Source of Truth for Everything)

| Data Type | Description | SDK Namespace |
|-----------|-------------|---------------|
| **Authentication** | Users, sessions, OAuth tokens | `auth` |
| **Guild Settings** | Configuration for Discord guilds | `admin.guilds` |
| **Prompt Partials** | AI prompt templates | `admin.prompts` |
| **TTRPG Systems** | Rules, mechanics, system-specific content | `kb` |
| **Spells/Items/Monsters** | Game entity data | `kb` |
| **Campaigns** | Campaign management | `campaigns` |
| **Characters** | Character sheets, stats, inventory | `characters` |
| **Dice Rolls** | Roll history, statistics | `dice` |
| **Game Sessions** | Active session state, logs | `sessions` |
| **Channel KB** | Discord channel knowledge sources | `admin.channelKB` |

### FumbleBot Owns (AI Memory Database)

FumbleBot maintains a small local database for AI-specific data that shapes interactions:

| Data Type | Description | Persisted |
|-----------|-------------|-----------|
| **User Preferences** | AI interaction style, verbosity, tone | Yes |
| **User Personas** | Custom AI personas per user/guild | Yes |
| **Conversation Memory** | Long-term memory of past interactions | Yes |
| **User Context** | What the AI "knows" about a user | Yes |
| **Voice Preferences** | TTS voice, speed, language | Yes |
| **AI Conversation Context** | Recent message history for AI context | In-memory |
| **Voice Connection State** | Active Discord voice connections | Runtime only |

**FumbleBot Local Schema (AI Memory):**
```prisma
model UserAIPreferences {
  id              String   @id @default(cuid())
  odId        String   @unique  // Discord user ID
  guildId         String?          // Guild-specific overrides (null = global)

  // Interaction preferences
  verbosity       String   @default("normal")  // brief, normal, detailed
  tone            String   @default("friendly") // friendly, formal, playful, etc.
  preferredModel  String?          // claude, gpt-4, etc.

  // Voice preferences
  ttsVoice        String?          // Deepgram voice ID
  ttsSpeed        Float    @default(1.0)
  sttLanguage     String   @default("en")

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([odId, guildId])
  @@index([odId])
}

model UserPersona {
  id              String   @id @default(cuid())
  odId        String
  guildId         String?

  name            String           // e.g., "Dungeon Master", "Rules Lawyer"
  systemPrompt    String   @db.Text // Custom system prompt additions
  isActive        Boolean  @default(false)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([odId, guildId])
}

model UserMemory {
  id              String   @id @default(cuid())
  odId        String
  guildId         String?

  // What the AI remembers about this user
  facts           Json     @default("[]")  // ["prefers D&D 5e", "plays a wizard named Gandalf"]
  summary         String?  @db.Text        // AI-generated summary of interactions
  lastInteraction DateTime @default(now())
  interactionCount Int     @default(0)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([odId, guildId])
  @@index([odId])
}

model ConversationSummary {
  id              String   @id @default(cuid())
  odId        String
  guildId         String
  channelId       String

  // Summarized conversation history (for long-term context)
  summary         String   @db.Text
  messageCount    Int
  startedAt       DateTime
  endedAt         DateTime

  createdAt       DateTime @default(now())

  @@index([odId, guildId, channelId])
  @@index([guildId, channelId])
}
```

This data is **AI-interface specific** - it determines HOW FumbleBot talks to users, not WHAT game data exists. If this database is lost, users lose their AI customizations but no game state is affected.

---

## SDK Release Requirements

### @crit-fumble/core SDK (FumbleBot's Toolbox)

```typescript
// Complete SDK interface - Core as platform
export interface CoreApiClient {
  // Health & Status
  health(): Promise<HealthResponse>;

  // Infrastructure (existing)
  container: ContainerApi;

  // Authentication (Phase 1)
  auth: AuthApi;

  // Admin & Configuration (Phase 2)
  admin: AdminApi;

  // Game Data - Core owns all of this
  kb: KnowledgeBaseApi;        // TTRPG rules, spells, monsters, etc.
  dice: DiceApi;               // Roll dice, get history, statistics
  campaigns: CampaignsApi;     // Campaign CRUD, player management
  characters: CharactersApi;   // Character sheets, stats, inventory
  sessions: GameSessionsApi;   // Active game session state

  // Discord Integration (Phase 4)
  commands: CommandsApi;
  chat: ChatApi;
}
```

### Type Definitions Needed

```typescript
// Auth types
interface TokenExchangeRequest { code: string; }
interface TokenExchangeResponse { access_token: string; }
interface AuthMeResponse { user: User; discordProfile: DiscordUser | null; }
interface AuthGuildsResponse { guilds: Guild[]; }
interface AuthActivitiesResponse { activities: UserActivity[]; }

// Admin types
interface GuildSettings { /* ... */ }
interface GuildMetrics { commandCount: number; diceRolls: number; /* ... */ }
interface ActivityTimeline { events: ActivityEvent[]; }

// Prompt types
interface PromptPartial { id: string; name: string; content: string; /* ... */ }
interface PromptContext { channelId?: string; categoryId?: string; roleIds?: string[]; }
interface CreatePromptRequest { name: string; content: string; scope: string; /* ... */ }

// Channel KB types
interface ChannelKBSource { id: string; channelId: string; name: string; /* ... */ }
interface GuildChannel { id: string; name: string; type: number; /* ... */ }
interface SyncResult { success: boolean; messagesProcessed: number; /* ... */ }

// Command types
interface CommandDefinition { name: string; description: string; /* ... */ }
interface CommandContext { guildId: string; channelId: string; userId: string; /* ... */ }
interface CommandResult { success: boolean; output: string; /* ... */ }

// Chat types
interface ChatMessage { content: string; attachments?: Attachment[]; }
interface ChatContext { guildId: string; channelId: string; userId: string; /* ... */ }
interface ChatResponse { content: string; embeds?: Embed[]; /* ... */ }

// Dice types
interface DiceRollRequest { notation: string; reason?: string; characterId?: string; }
interface DiceRollResult { id: string; notation: string; rolls: number[]; total: number; /* ... */ }
interface DiceHistory { rolls: DiceRollResult[]; statistics: DiceStatistics; }

// Campaign types
interface Campaign { id: string; name: string; system: string; guildId: string; /* ... */ }
interface CreateCampaignRequest { name: string; system: string; description?: string; }
interface CampaignPlayer { userId: string; characterId?: string; role: 'gm' | 'player'; }

// Character types
interface Character { id: string; name: string; system: string; stats: Json; /* ... */ }
interface CreateCharacterRequest { name: string; system: string; campaignId?: string; }
interface CharacterUpdate { stats?: Json; inventory?: Json; notes?: string; }

// Game Session types
interface GameSession { id: string; campaignId: string; status: 'active' | 'paused' | 'ended'; }
interface SessionEvent { type: string; data: Json; timestamp: Date; }
interface CreateSessionRequest { campaignId: string; channelId?: string; }
```

---

## Migration Checklist

### Phase 1: Auth
- [ ] Core: Implement auth endpoints
- [ ] Core: Add session management
- [ ] Core: Add CSRF protection
- [ ] SDK: Add `auth` namespace
- [ ] FumbleBot: Remove auth controller
- [ ] FumbleBot: Remove session middleware
- [ ] Test: OAuth flow works end-to-end

### Phase 2: Admin
- [ ] Core: Implement admin endpoints
- [ ] Core: Migrate database models
- [ ] SDK: Add `admin` namespace
- [ ] FumbleBot: Remove admin controllers
- [ ] FumbleBot: Update AI service to call SDK for prompts
- [ ] Test: Admin dashboard works

### Phase 3: Security
- [ ] Core: Add Discord CORS origins
- [ ] Core: Add Activity CSP headers
- [ ] Core: Add rate limiting
- [ ] FumbleBot: Remove security middleware
- [ ] Test: Activities load in Discord iframe

### Phase 4: Commands/Chat
- [ ] Core: Implement command routing
- [ ] Core: Implement chat routing
- [ ] FumbleBot: Add internal AI endpoints
- [ ] SDK: Add `commands` and `chat` namespaces
- [ ] Test: Commands work via Core

### Phase 5: Proxy Removal
- [ ] Core: Serve activities directly
- [ ] Update DNS/routing if needed
- [ ] FumbleBot: Remove proxy code
- [ ] Test: All paths still work

### Phase 6: Cleanup
- [ ] FumbleBot: Remove unused dependencies
- [ ] FumbleBot: Update package.json
- [ ] Documentation: Update architecture docs
- [ ] Test: Full integration test

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Auth migration breaks Discord Activities | Medium | High | Feature flag, gradual rollout |
| Session data loss during migration | Low | Medium | Session migration script |
| Dice roll latency (FumbleBot → Core round-trip) | Medium | Medium | Core SDK connection pooling, local result caching |
| Game session state sync issues | Low | High | Optimistic updates, conflict resolution |
| FumbleBot restart loses AI context | Low | Low | Expected behavior - stateless design |
| Rate limiting mismatch | Medium | Low | Sync rate limit configs |
| CORS issues in production | Medium | Medium | Test in Discord PTB first |
| Data migration (existing dice rolls, etc.) | Low | Medium | Migration script, run in maintenance window |

---

## Questions to Resolve

1. **Session Storage:** Redis or database-backed sessions?
2. **Rate Limiting:** Shared rate limit state across instances?
3. **Command Routing:** Sync HTTP call to FumbleBot or async message queue?
4. **Activity Serving:** Same domain or subdomain for activities?
5. **FumbleBot-Core Communication:** Direct HTTP or message queue (Redis pub/sub, etc.)?
6. **Dice Roll Attribution:** How to link rolls to characters/campaigns in real-time?

---

## Appendix: File Inventory

### Files to Delete from FumbleBot (Post-Migration)

```
# Auth & Sessions
src/controllers/auth.ts
src/controllers/sessions.ts

# Admin & Configuration
src/controllers/admin.ts
src/controllers/prompts.ts
src/controllers/channel-kb.ts

# Game Data (moves to Core)
src/controllers/dice.ts
src/controllers/campaigns.ts
src/controllers/characters.ts
src/services/dice/*.ts
src/services/campaign/*.ts

# Routing (moves to Core)
src/controllers/commands.ts (partially - keep AI dispatch)
src/controllers/chat.ts (partially - keep AI dispatch)

# Proxy & Middleware (no longer needed)
src/middleware/proxy/core-proxy.ts
src/middleware/proxy/cors.ts
src/middleware/proxy/security.ts
src/middleware/proxy/rate-limit.ts
src/middleware/rate-limit.ts
src/services/container/proxy.ts
```

### Files to Modify in FumbleBot

```
src/routes.ts              - Remove migrated routes, keep Discord event handlers
src/middleware.ts          - Remove security middleware (Core handles it)
src/server.ts              - Simplify to Discord gateway + AI services only
src/config.ts              - Remove Core DB config, keep AI API keys + local DB
src/services/ai/*.ts       - Use Core SDK for game data (prompts, KB, dice, etc.)
prisma/schema.prisma       - REDUCE to AI Memory models only (UserAIPreferences, UserPersona, UserMemory, ConversationSummary)
package.json               - Remove express middleware deps, KEEP prisma for AI memory
```

### New Files in Core

```
# Auth
src/routes/auth.ts
src/controllers/auth.ts

# Admin
src/routes/admin.ts
src/controllers/admin.ts
src/controllers/prompts.ts
src/controllers/channel-kb.ts

# Game Data APIs
src/routes/dice.ts
src/routes/campaigns.ts
src/routes/characters.ts
src/routes/sessions.ts
src/controllers/dice.ts
src/controllers/campaigns.ts
src/controllers/characters.ts
src/controllers/sessions.ts

# Discord Integration
src/routes/commands.ts
src/routes/chat.ts
src/controllers/commands.ts
src/controllers/chat.ts

# Middleware
src/middleware/discord-cors.ts
src/middleware/activity-csp.ts
src/middleware/rate-limit.ts

# Database
prisma/schema.prisma       - All models (auth, admin, game data)
```
