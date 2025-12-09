# Old FumbleBot Features - Migration Plan

## Status: In Progress (Sprint 1 Complete)

This document tracks the migration of features from the legacy fumblebot implementation (C:\Users\hobda\Projects\Crit-Fumble\old-fumblebot-crit-fumble-com) to the current architecture.

## Overview

The old fumblebot was a discord.js v14 bot with MongoDB storage, featuring character roleplay systems, tactical grid rendering, event automation, and audio playback. This plan identifies valuable features to port into the current TypeScript/PostgreSQL/Prisma implementation.

---

## Feature Priority Matrix

### HIGH PRIORITY - Core Gameplay Features

#### 1. Character Management & Roleplay System

**Value Proposition:** Essential for tabletop RPG gameplay, enables immersive in-character interactions

**Old Implementation:**
- MongoDB character storage with per-user, per-guild tracking
- `/character create` - Create with name and token (avatar image)
- `/character select` - Activate character for current channel/thread
- `/character edit` - Modify name or token
- `/character remove` - Delete character
- Character Schema: `{id, userId, guildId, name, token: {url, attachment}, channelId?, threadId?}`

**Status: ✅ COMPLETED**

**Implementation:**
- [x] **Phase 1: Database Schema** ✅
  - [x] Added `Character` model to Prisma schema
  - [x] Fields: `id, userId, guildId, name, tokenUrl, activeChannelId, activeThreadId, createdAt, updatedAt`
  - [x] Added unique constraint on `[userId, guildId, name]` and indexes
  - [x] Migration ready (awaiting `npx prisma migrate dev`)

- [x] **Phase 2: Character Service** ✅
  - [x] Created `src/services/character/character-service.ts`
  - [x] CRUD operations: `create`, `getById`, `list`, `update`, `delete`
  - [x] `setActive(characterId, userId, guildId, channelId, threadId)` - Activate for channel/thread
  - [x] `getActive(userId, guildId, channelId, threadId)` - Get currently active character
  - [x] `search(userId, guildId, query)` - Search characters by name
  - [x] 17 comprehensive unit tests (all passing)

- [x] **Phase 3: Slash Commands** ✅
  - [x] Created `src/services/discord/commands/slash/character.ts` with all subcommands
  - [x] `create` - Create character with name and optional token URL
  - [x] `select` - Autocomplete list of user's characters with activation
  - [x] `edit` - Update character name or token URL
  - [x] `remove` - Delete character
  - [x] `list` - Display all user's characters
  - [x] `deactivate` - Clear active character in current channel
  - [x] Autocomplete handler for character selection

- [x] **Phase 4: Integration** ✅
  - [x] Registered commands in CommandRegistry
  - [x] CharacterService uses singleton pattern
  - [x] End-to-end flow tested via unit tests

**Files to Create:**
- `prisma/migrations/XXX_add_character_model.sql`
- `src/services/character/character-service.ts`
- `src/services/character/types.ts`
- `src/commands/character.ts`

**Dependencies:**
- Requires Discord.js attachment handling
- Requires image storage (Discord CDN or S3)
- May integrate with existing `UserPersona` system

---

#### 2. In-Character Commands (`/ic`)

**Value Proposition:** Brings characters to life with webhook-based messages displaying character avatars and names

**Old Implementation:**
- `/ic say <message>` - Speak as character using ephemeral webhooks
- `/ic do <action> [roll]` - Declare actions with optional dice
- `/ic move` - Interactive 9-button directional pad (↖️⬆️↗️⬅️🛑➡️↙️⬇️↘️)
- Webhook system: Create ephemeral webhook → Post as character → Delete webhook
- Automatic character association with channels/threads

**Status: ✅ COMPLETED**

**Implementation:**
- [x] **Phase 1: Webhook Service** ✅
  - [x] Created `src/services/discord/webhook-service.ts`
  - [x] `createEphemeralWebhook(channel)` - Create temporary webhook
  - [x] `sendAsCharacter(channel, character, message)` - Post with character identity
  - [x] `deleteWebhook(webhook)` - Cleanup after message
  - [x] Error handling for webhook creation failures
  - [x] Support for both text channels and threads
  - [x] 13 unit tests (all passing)

- [x] **Phase 2: IC Say Command** ✅
  - [x] Created IC say subcommand in `src/services/discord/commands/slash/ic.ts`
  - [x] Checks for active character in current channel/thread
  - [x] Creates webhook with character name and token
  - [x] Sends message as character
  - [x] Automatic webhook cleanup

- [x] **Phase 3: IC Do Command** ✅
  - [x] Created IC do subcommand
  - [x] Parses action text and optional dice notation
  - [x] Rolls dice using existing roll service
  - [x] Formats message: "*[Action]* \n🎲 Rolls **1d20+5**: 12 + 5 = **17**"
  - [x] Sends via webhook as character

- [x] **Phase 4: IC Move Command** ✅
  - [x] Created IC move subcommand
  - [x] Built 9-button directional pad component (↖️⬆️↗️⬅️🛑➡️↙️⬇️↘️)
  - [x] Created button handler in `src/services/discord/handlers/button.ts`
  - [x] Sends movement message as character via webhook
  - [x] 12 IC button handler tests (all passing)
  - [x] Note: Position tracking not implemented (for future tactical grid integration)

- [x] **Phase 5: Command Registration** ✅
  - [x] Created `/ic` command with all subcommands
  - [x] Registered in CommandRegistry
  - [x] Initialized WebhookService on bot startup
  - [x] All interactions tested via unit tests

**Files to Create:**
- `src/services/discord/webhook-service.ts`
- `src/commands/ic/say.ts`
- `src/commands/ic/do.ts`
- `src/commands/ic/move.ts`
- `src/commands/ic/index.ts` (parent command)

**Dependencies:**
- Requires Phase 1 (Character Management) to be complete
- May integrate with tactical grid system (see below)
- Discord.js webhook API permissions

**Design Considerations:**
- Should webhooks be pooled/reused or always ephemeral?
- Should we track character positions in database or in-memory?
- How to handle webhook rate limits?

---

### MEDIUM PRIORITY - Tactical & Event Features

#### 3. Canvas-Based Tactical Grid System

**Value Proposition:** Visual tactical combat without Foundry VTT, useful for theater-of-mind games

**Old Implementation:**
- 850x650px canvas with 50px tiles (17x13 grid)
- Character token rendering on grid
- Real-time position updates via button interactions
- Uses `@napi-rs/canvas` for rendering
- `/test canvas` command for development

**Proposed Implementation:**
- [ ] **Phase 1: Canvas Service** (Est: 3-4 hours)
  - [ ] Install `@napi-rs/canvas` dependency
  - [ ] Create `src/services/canvas/grid-renderer.ts`
  - [ ] `renderGrid(width, height, tileSize)` - Draw grid lines
  - [ ] `renderToken(canvas, x, y, imageUrl)` - Place character token
  - [ ] `renderScene(characters)` - Full scene with multiple tokens
  - [ ] Export as PNG buffer for Discord attachment

- [ ] **Phase 2: Position Tracking** (Est: 2-3 hours)
  - [ ] Add to Prisma schema or in-memory store
  - [ ] `CharacterPosition` model: `{characterId, guildId, channelId, x, y, sessionId?}`
  - [ ] Position service CRUD operations
  - [ ] Session management (reset positions per encounter)

- [ ] **Phase 3: Grid Command** (Est: 2-3 hours)
  - [ ] Create `/grid show` - Render current tactical grid
  - [ ] Create `/grid reset` - Clear all positions
  - [ ] Create `/grid set <character> <position>` - Manually place token
  - [ ] Integrate with `/ic move` for interactive updates

- [ ] **Phase 4: Integration** (Est: 2-3 hours)
  - [ ] Connect `/ic move` buttons to grid updates
  - [ ] Auto-render grid after movement
  - [ ] Add "Show Grid" button to movement responses
  - [ ] Test with multiple characters

**Files to Create:**
- `src/services/canvas/grid-renderer.ts`
- `src/services/canvas/position-service.ts`
- `src/commands/grid.ts`
- `prisma/migrations/XXX_add_character_position.sql` (optional)

**Dependencies:**
- `@napi-rs/canvas` package
- Requires Character Management (Phase 1)
- Optional: Integrate with Foundry screenshots for hybrid approach

**Design Considerations:**
- Should positions persist across sessions or be ephemeral?
- Should we support grid backgrounds/maps?
- Should we support fog of war or visibility?
- Performance: Can we cache rendered grids?

---

#### 4. Event Management & Automation

**Value Proposition:** Automate Discord scheduled events for recurring games

**Old Implementation:**
- `/event clone` - Clone existing scheduled event with optional date modification
- Cron job system (minute-by-minute execution)
- Auto-start events when scheduled time arrives
- Auto-complete events when voice channel empties
- Natural language date parsing with `chrono-node`
- Autocomplete for event selection with formatted timestamps

**Proposed Implementation:**
- [ ] **Phase 1: Event Clone Command** (Est: 2-3 hours)
  - [ ] Create `src/commands/event.ts`
  - [ ] `/event clone` with autocomplete for existing events
  - [ ] Date modification using `chrono-node`
  - [ ] Clone event with new date/time
  - [ ] Error handling for invalid dates

- [ ] **Phase 2: Event Automation Service** (Est: 3-4 hours)
  - [ ] Create `src/services/discord/event-automation.ts`
  - [ ] Cron job to check scheduled events every minute
  - [ ] Auto-start events within 60 seconds of scheduled time
  - [ ] Monitor voice state changes
  - [ ] Auto-complete events when voice channel empties

- [ ] **Phase 3: Database Tracking** (Est: 1-2 hours)
  - [ ] Add `EventAutomation` model to track automation rules
  - [ ] Fields: `{id, guildId, eventId, autoStart, autoComplete, createdAt}`
  - [ ] Store automation preferences per event

- [ ] **Phase 4: Integration** (Est: 1-2 hours)
  - [ ] Initialize automation service on bot startup
  - [ ] Add configuration commands for automation settings
  - [ ] Test event lifecycle

**Files to Create:**
- `src/commands/event.ts`
- `src/services/discord/event-automation.ts`
- `prisma/migrations/XXX_add_event_automation.sql`

**Dependencies:**
- `chrono-node` for date parsing
- Discord.js scheduled events API
- Node.js setInterval or cron library

**Design Considerations:**
- Should automation be opt-in or opt-out?
- Should we support recurring event templates?
- How to handle timezone conversions?

---

#### 5. Audio File Playback System

**Value Proposition:** Play ambient sounds, music, or sound effects during gameplay

**Old Implementation:**
- `/audio play <attachment>` - Upload and play audio file
- `/audio pause/unpause/stop` - Playback controls
- FFmpeg integration via `ffmpeg-static`
- Discord voice connection via `@discordjs/voice`

**Current State:**
- Current bot has voice features but focused on transcription/TTS
- Already has `@discordjs/voice` integration
- Deepgram TTS for AI responses

**Proposed Implementation:**
- [ ] **Phase 1: Audio Player Service** (Est: 2-3 hours)
  - [ ] Create `src/services/discord/voice/audio-player.ts`
  - [ ] `playFile(voiceConnection, audioUrl)` - Stream audio file
  - [ ] `pause()`, `unpause()`, `stop()` - Playback control
  - [ ] Queue management for multiple files
  - [ ] FFmpeg integration for format support

- [ ] **Phase 2: Audio Commands** (Est: 2-3 hours)
  - [ ] Create `/audio play` - Upload attachment or URL
  - [ ] Create `/audio pause`, `/audio unpause`, `/audio stop`
  - [ ] Create `/audio queue` - Show current queue
  - [ ] File validation (size, format, duration)

- [ ] **Phase 3: Persistence** (Est: 1-2 hours)
  - [ ] Add `AudioLibrary` model to store uploaded sounds
  - [ ] Fields: `{id, guildId, name, url, uploadedBy, createdAt}`
  - [ ] `/audio library` - Browse saved sounds
  - [ ] `/audio save <name>` - Save current playing track

- [ ] **Phase 4: Integration** (Est: 1-2 hours)
  - [ ] Integrate with existing voice session management
  - [ ] Handle conflicts with transcription/TTS
  - [ ] Add playback controls as message buttons

**Files to Create:**
- `src/services/discord/voice/audio-player.ts`
- `src/commands/audio.ts`
- `prisma/migrations/XXX_add_audio_library.sql`

**Dependencies:**
- `ffmpeg-static` or `ffmpeg` binary
- `@discordjs/voice` (already installed)
- File upload handling

**Design Considerations:**
- Should audio playback pause transcription or coexist?
- Should we support streaming from URLs (YouTube, Spotify)?
- Should we limit file sizes or durations?
- Should we support audio effects (volume, speed)?

---

### LOW PRIORITY - Utility Features

#### 6. Explicit AI Generation Commands

**Value Proposition:** Some users prefer explicit commands over conversational AI

**Old Implementation:**
- `/write <prompt>` - GPT-3.5-turbo text generation (400 token max)
- `/imagine <prompt> [size]` - DALL-E image generation (256x256, 512x512, 1024x1024)
- Direct OpenAI API calls

**Current State:**
- Current bot has conversational AI integrated into message flow
- Uses Anthropic Claude and OpenAI GPT-4o
- AI is context-aware and multi-agent

**Proposed Implementation:**
- [ ] **Phase 1: Write Command** (Est: 1-2 hours)
  - [ ] Create `/write <prompt>` command
  - [ ] Use existing AI service (Claude or GPT)
  - [ ] Support options: model, max_tokens, temperature
  - [ ] Format response as embed or code block

- [ ] **Phase 2: Imagine Command** (Est: 2-3 hours)
  - [ ] Create `/imagine <prompt> [size]` command
  - [ ] Use OpenAI DALL-E API
  - [ ] Size options: 256x256, 512x512, 1024x1024
  - [ ] Generate and attach image
  - [ ] Save to database for library

- [ ] **Phase 3: Advanced Options** (Est: 1-2 hours)
  - [ ] `/write` - Add style, tone, length parameters
  - [ ] `/imagine` - Add style presets (realistic, fantasy, anime)
  - [ ] Token/credit tracking per user
  - [ ] Rate limiting

**Files to Create:**
- `src/commands/write.ts`
- `src/commands/imagine.ts`

**Dependencies:**
- Existing AI service
- OpenAI DALL-E API access

**Design Considerations:**
- Should these be admin-only or public?
- Should we track usage/costs per user?
- Should generated content be saved to KB?

---

#### 7. Auto-Mention Response System

**Value Proposition:** Auto-engage when bot is mentioned, providing helpful context-aware responses

**Old Implementation:**
- Listen for @FumbleBot mentions
- Fetch up to 32 recent messages for context
- Token counting and smart trimming (3500 token max)
- Chronological conversation assembly
- Role assignment (user/assistant) for GPT

**Current State:**
- Current bot has DM handling and admin channel support
- Message handlers in `src/services/discord/handlers/message.ts`
- Context management via `GuildContextManager`

**Proposed Implementation:**
- [ ] **Phase 1: Mention Handler** (Est: 1-2 hours)
  - [ ] Update `src/services/discord/handlers/message.ts`
  - [ ] Detect @mention in `messageCreate` event
  - [ ] Skip if DM or admin channel (already handled)
  - [ ] Fetch recent message history (configurable limit)

- [ ] **Phase 2: Context Assembly** (Est: 2-3 hours)
  - [ ] Use existing `MessageCache` service
  - [ ] Token counting for context (use AI service token counter)
  - [ ] Smart trimming to stay under limit
  - [ ] Chronological ordering with role assignment

- [ ] **Phase 3: Response Generation** (Est: 1 hour)
  - [ ] Use `SmartOrchestrator` for AI response
  - [ ] Include channel context and game system
  - [ ] Reply to mention with threaded message
  - [ ] Handle long responses (chunking)

- [ ] **Phase 4: Configuration** (Est: 1 hour)
  - [ ] Add guild setting: `mentionResponseEnabled`
  - [ ] Add per-channel override
  - [ ] Configurable context window size
  - [ ] Rate limiting per user/channel

**Files to Modify:**
- `src/services/discord/handlers/message.ts`
- `prisma/schema.prisma` (add guild settings)

**Dependencies:**
- Existing AI and context services
- Token counting utilities

**Design Considerations:**
- Should we respond to every mention or only direct questions?
- Should responses be threaded or inline?
- How to handle spam mentions?

---

#### 8. Timestamp Converter Utility

**Value Proposition:** Quick utility for generating Discord-formatted timestamps

**Old Implementation:**
- `/timestamp <natural language date>` - Convert to Discord timestamp format
- Uses `chrono-node` for parsing

**Proposed Implementation:**
- [ ] **Phase 1: Command** (Est: 30 minutes)
  - [ ] Create `/timestamp <input>` command
  - [ ] Parse with `chrono-node`
  - [ ] Generate all Discord timestamp formats:
    - `<t:UNIX>` - Short time
    - `<t:UNIX:t>` - Short time
    - `<t:UNIX:T>` - Long time
    - `<t:UNIX:d>` - Short date
    - `<t:UNIX:D>` - Long date
    - `<t:UNIX:f>` - Short date/time
    - `<t:UNIX:F>` - Long date/time
    - `<t:UNIX:R>` - Relative time
  - [ ] Display all formats in embed for copy-paste

**Files to Create:**
- `src/commands/timestamp.ts`

**Dependencies:**
- `chrono-node` package

---

## Implementation Order

### Sprint 1: Character System ✅ COMPLETED
1. ✅ Character Management (Database, Service, Commands)
2. ✅ In-Character Say/Do/Move Commands
   - 42 unit tests added (17 character service + 13 webhook service + 12 IC button handler)
   - All tests passing (1064 total)
   - Database migration ready (awaiting `npx prisma migrate dev`)

### Sprint 2: Advanced Roleplay (Week 2)
3. In-Character Move Command
4. Canvas Grid System (Basic)

### Sprint 3: Automation & Audio (Week 3)
5. Event Clone & Automation
6. Audio Playback System

### Sprint 4: Polish & Utilities (Week 4)
7. AI Generation Commands
8. Mention Response System
9. Timestamp Utility

---

## Migration Notes

### Technology Changes
- **Database:** MongoDB → PostgreSQL with Prisma ORM
- **Architecture:** Standalone bot → Multi-service platform (FumbleBot + Core)
- **AI:** OpenAI GPT-3.5 → Anthropic Claude + OpenAI GPT-4o (multi-agent)
- **Commands:** Basic discord.js → Sophisticated command registry with cross-platform support

### Breaking Changes
- Character data structure changes (MongoDB UUID → PostgreSQL CUID)
- No direct migration path for old character data
- Will need manual data export/import scripts if preserving old characters

### Opportunities for Enhancement
- **Character System:** Integrate with `UserPersona` system for richer character profiles
- **Grid System:** Hybrid Foundry + Canvas for mixed VTT/theater gameplay
- **Audio:** Integrate with Core's asset storage for persistent audio library
- **AI Commands:** Leverage multi-agent system for better responses
- **Events:** Integration with Core's campaign scheduling

---

## Testing Plan

Each feature should include:
1. **Unit Tests:** Service layer logic
2. **Integration Tests:** Command execution flow
3. **E2E Tests:** Discord interaction simulation
4. **Manual Testing:** Real Discord server validation

---

## Documentation Updates Required

After implementation, update:
- `docs/agent/FUMBLEBOT_HTTP_API.md` - New API endpoints
- `CLAUDE.md` - New features and architecture
- `README.md` - User-facing feature list
- `.claude/README.md` - Developer notes on new services

---

## Open Questions

1. **Character Tokens:** Store images in Discord CDN, S3, or Core asset storage?
2. **Grid Rendering:** Should we support custom map backgrounds?
3. **Audio Library:** Should audio files be per-guild or global?
4. **AI Commands:** Should `/write` and `/imagine` be public or admin-only?
5. **Mention Responses:** Should we use threads or inline replies?
6. **Data Migration:** Should we build tools to import old MongoDB character data?

---

## Resources

- **Old Codebase:** `C:\Users\hobda\Projects\Crit-Fumble\old-fumblebot-crit-fumble-com`
- **Old Character Service:** `old-fumblebot-crit-fumble-com/src/managers/DatabaseManager.js`
- **Old IC Commands:** `old-fumblebot-crit-fumble-com/src/commands/player/IC.js`
- **Old Canvas Renderer:** `old-fumblebot-crit-fumble-com/src/commands/dev/Test.js`
- **Old Event Automation:** `old-fumblebot-crit-fumble-com/src/cron-jobs/EventScheduler.js`
- **Old Audio System:** `old-fumblebot-crit-fumble-com/src/commands/general/Audio.js`
