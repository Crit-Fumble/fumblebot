# Old FumbleBot Features - Migration Plan

## Status: Planning

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

**Proposed Implementation:**
- [ ] **Phase 1: Database Schema** (Est: 1-2 hours)
  - [ ] Add `Character` model to Prisma schema
  - [ ] Fields: `id, userId, guildId, name, tokenUrl, tokenAttachment, activeChannelId, activeThreadId, createdAt, updatedAt`
  - [ ] Add relation to `Guild` and index on `[userId, guildId]`
  - [ ] Migration to PostgreSQL

- [ ] **Phase 2: Character Service** (Est: 2-3 hours)
  - [ ] Create `src/services/character/character-service.ts`
  - [ ] CRUD operations: `create`, `get`, `list`, `update`, `delete`
  - [ ] `setActiveCharacter(userId, guildId, channelId, characterId)` - Activate for channel
  - [ ] `getActiveCharacter(userId, guildId, channelId)` - Get current active
  - [ ] Image upload handling for character tokens

- [ ] **Phase 3: Slash Commands** (Est: 2-3 hours)
  - [ ] Create `src/commands/character.ts` with subcommands
  - [ ] `create` - Modal for name + attachment upload
  - [ ] `select` - Autocomplete list of user's characters
  - [ ] `edit` - Modal for updating name/token
  - [ ] `remove` - Confirmation button + delete
  - [ ] Autocomplete handler for character selection

- [ ] **Phase 4: Integration** (Est: 1 hour)
  - [ ] Register commands with Discord API
  - [ ] Add character service to dependency container
  - [ ] Test end-to-end flow

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

**Proposed Implementation:**
- [ ] **Phase 1: Webhook Service** (Est: 2-3 hours)
  - [ ] Create `src/services/discord/webhook-service.ts`
  - [ ] `createEphemeralWebhook(channel)` - Create temporary webhook
  - [ ] `sendAsCharacter(webhook, character, message)` - Post with character identity
  - [ ] `deleteWebhook(webhook)` - Cleanup after message
  - [ ] Error handling for webhook creation failures

- [ ] **Phase 2: IC Say Command** (Est: 1-2 hours)
  - [ ] Create `src/commands/ic/say.ts`
  - [ ] Check for active character in current channel
  - [ ] Create webhook with character name and token
  - [ ] Send message as character
  - [ ] Clean up webhook

- [ ] **Phase 3: IC Do Command** (Est: 2-3 hours)
  - [ ] Create `src/commands/ic/do.ts`
  - [ ] Parse action text and optional dice notation
  - [ ] Roll dice if notation provided (use existing roll service)
  - [ ] Format message: "**[Action]** *rolls 1d20+5* → **18**"
  - [ ] Send via webhook as character

- [ ] **Phase 4: IC Move Command** (Est: 3-4 hours)
  - [ ] Create `src/commands/ic/move.ts`
  - [ ] Build 9-button directional pad component
  - [ ] Button emojis: ↖️⬆️↗️⬅️🛑➡️↙️⬇️↘️
  - [ ] Store character position (in-memory or database)
  - [ ] Update position on button click
  - [ ] Send movement message as character
  - [ ] Optional: Integrate with tactical grid rendering

- [ ] **Phase 5: Command Registration** (Est: 1 hour)
  - [ ] Create `/ic` command with subcommands
  - [ ] Wire up handlers
  - [ ] Test interactions

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

### Sprint 1: Character System (Week 1)
1. Character Management (Database, Service, Commands)
2. In-Character Say/Do Commands

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
