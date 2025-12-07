# FumbleBot - Claude Code Reference

This document provides context for Claude Code sessions working on the FumbleBot project. It covers project structure, architecture, documentation organization, and common workflows.

---

## Project Overview

**FumbleBot** is a sophisticated multi-platform Discord bot for tabletop RPG communities, integrating AI assistants, voice processing, virtual tabletop management (Foundry VTT), and knowledge base systems.

### Tech Stack
- **Runtime:** Node.js 20.19.0+
- **Language:** TypeScript 5.6
- **Framework:** Express.js 4.21.2
- **Discord:** discord.js 14.16.3
- **Database:** PostgreSQL with Prisma ORM 7.0
- **AI:** Anthropic Claude (Sonnet/Haiku) + OpenAI GPT-4o
- **Voice:** Deepgram API (STT/TTS)
- **Testing:** Vitest (unit/integration) + Playwright (E2E)
- **MCP:** Model Context Protocol SDK 1.24.3

### Architecture Pattern

FumbleBot follows a **service-oriented architecture** with clear separation of concerns:

```
Discord/Web/MCP → Commands → Services → Database/External APIs
                          ↓
                    AI Orchestration
                          ↓
                   Core Integration
```

**Key Architectural Principles:**
1. **Core as Platform:** Core server is the central data repository; FumbleBot is a stateless AI interface layer
2. **Multi-Agent AI:** Smart orchestrator routes requests to specialized agents (Sonnet for reasoning, Haiku for rules lookup)
3. **Cross-Platform Commands:** Unified command system works across Discord and Web
4. **Knowledge Base Integration:** Discord channels, World Anvil, and web sources feed semantic search

---

## Project Structure

```
fumblebot.crit-fumble.com/
├── src/
│   ├── index.ts              # Module exports
│   ├── server.ts             # Express server
│   ├── routes.ts             # Route definitions
│   ├── middleware.ts         # Express middleware
│   ├── config.ts             # Environment configuration
│   ├── commands/             # Cross-platform command system
│   ├── controllers/          # API request handlers
│   ├── services/             # Business logic layer
│   │   ├── discord/          # Discord integration
│   │   ├── ai/               # AI/LLM services
│   │   ├── foundry/          # Foundry VTT integration
│   │   ├── voice/            # Voice features (STT/TTS)
│   │   ├── context/          # Context management
│   │   ├── db/               # Database client
│   │   ├── web/              # Web scraping/fetching
│   │   ├── worldanvil/       # World Anvil integration
│   │   ├── persona/          # Bot persona management
│   │   └── container/        # Foundry container management
│   ├── models/               # TypeScript type definitions
│   ├── lib/                  # Utility libraries
│   └── mcp/                  # MCP server implementation
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── migrations/           # Database migrations
├── tests/
│   ├── unit/                 # Unit tests (Vitest)
│   ├── integration/          # Integration tests (Vitest)
│   └── e2e/                  # End-to-end tests (Playwright)
├── docs/                     # Documentation root
│   ├── agent/                # Agent-generated docs (auto-updated)
│   └── plans/                # Feature planning documents
├── packages/
│   └── core-fumblebot/       # Core integration package
└── .claude/                  # Claude Code configuration
```

---

## Documentation Structure

### User-Written Documentation (docs/)

**Root-Level Strategic Documents:**
- [docs/CORE_MIGRATION_PLAN.md](docs/CORE_MIGRATION_PLAN.md) - Comprehensive plan to establish Core as central platform
- [docs/MULTI_AGENT_ARCHITECTURE.md](docs/MULTI_AGENT_ARCHITECTURE.md) - Multi-agent AI system design
- [docs/GUILD_CONFIG_MIGRATION.md](docs/GUILD_CONFIG_MIGRATION.md) - Guild configuration migration status

**Feature Planning (docs/plans/):**
- [docs/plans/channel-kb-sources.md](docs/plans/channel-kb-sources.md) - Discord channels as KB sources (Backend complete, Web UI pending)
- [docs/plans/old-fumblebot-features.md](docs/plans/old-fumblebot-features.md) - Migration plan for legacy features

### Agent-Generated Documentation (docs/agent/)

**IMPORTANT:** Agent-generated docs are maintained in `docs/agent/` and should be regenerated/updated each iteration. Always confirm conflicting information against user-written docs at the root of `docs/`.

Current agent docs:
- [docs/agent/CORE_READONLY_API_SPEC.md](docs/agent/CORE_READONLY_API_SPEC.md) - Core API specification
- [docs/agent/FUMBLEBOT_HTTP_API.md](docs/agent/FUMBLEBOT_HTTP_API.md) - HTTP API guide
- [docs/agent/DISCORD_ACTIVITY.md](docs/agent/DISCORD_ACTIVITY.md) - Discord Activity SDK integration
- [docs/agent/DISCORD_ACTIVITY_DEBUG.md](docs/agent/DISCORD_ACTIVITY_DEBUG.md) - Activity debugging
- [docs/agent/MCP_KB_INTEGRATION.md](docs/agent/MCP_KB_INTEGRATION.md) - MCP and KB integration
- [docs/agent/MCP_TOOLS_AND_WEB_FETCH.md](docs/agent/MCP_TOOLS_AND_WEB_FETCH.md) - MCP tools reference
- [docs/agent/KB_DISCORD_EXAMPLES.md](docs/agent/KB_DISCORD_EXAMPLES.md) - KB query examples
- [docs/agent/DEPLOYMENT.md](docs/agent/DEPLOYMENT.md) - Deployment procedures

### Supporting Documentation

- [.claude/README.md](.claude/README.md) - Claude Code project configuration
- [tests/README.md](tests/README.md) - Testing guide (unit, integration, E2E)
- [packages/core-fumblebot/docs/](packages/core-fumblebot/docs/) - Core integration docs
- [README.md](README.md) - Project README (user-facing)

---

## Key Concepts

### 1. Service Layer Pattern

All business logic lives in `src/services/`. Services are singleton instances that encapsulate:
- External API interactions (Discord, AI, Foundry, etc.)
- Complex business logic
- State management
- Error handling

**Example Service Structure:**
```typescript
// src/services/example/example-service.ts
class ExampleService {
  private static instance: ExampleService;

  private constructor() {
    // Initialize
  }

  static getInstance(): ExampleService {
    if (!ExampleService.instance) {
      ExampleService.instance = new ExampleService();
    }
    return ExampleService.instance;
  }

  async doSomething(): Promise<Result> {
    // Business logic
  }
}

export default ExampleService.getInstance();
```

### 2. Command Executor Pattern

Commands are cross-platform (Discord + Web) and follow a unified interface:

```typescript
// src/commands/example.ts
export const exampleCommand: Command = {
  name: 'example',
  description: 'Example command',
  options: [
    {
      name: 'param',
      description: 'Parameter',
      type: 'string',
      required: true,
    },
  ],
  async execute(context: CommandContext): Promise<CommandResult> {
    // Command logic
    return {
      content: 'Response',
      embeds: [],
    };
  },
};
```

Commands are registered in `src/commands/executor.ts` and executed via:
- Discord: Slash command interactions
- Web: HTTP API endpoints
- MCP: Tool calls from AI agents

### 3. AI Orchestration

The **SmartOrchestrator** routes AI requests to appropriate models:

- **Claude Sonnet:** General chat, DM responses, NPC generation, lore
- **Claude Haiku:** Rules lookup, core concepts, quick queries
- **OpenAI GPT-4o:** Content generation, function calling

**Usage:**
```typescript
import aiService from '@/services/ai/ai-service';

const response = await aiService.chat({
  messages: [{role: 'user', content: 'What is a saving throw?'}],
  model: 'sonnet', // or 'haiku', 'gpt-4o'
});
```

### 4. Knowledge Base Integration

FumbleBot queries multiple knowledge sources:

1. **Discord Channels:** Text/forum channels as KB sources (see [channel-kb-sources.md](docs/plans/channel-kb-sources.md))
2. **World Anvil:** Campaign world content via API
3. **Web Search:** Fallback for queries not in KB
4. **Core KB API:** Centralized semantic search

**Flow:**
```
User Question → KB Query → Relevant Context → AI Response with Sources
```

### 5. Database Schema Organization

Prisma schema is organized into logical sections:

- **Guild Management:** Guild, GuildMember
- **Gaming & Sessions:** DiceRoll, Session
- **AI & Persona:** BotPersona, BotSkill, BotMemory, UserPersona, UserAIPreferences
- **Conversation & Context:** ConversationSummary, AIThought, ChannelGameContext
- **Prompt Customization:** PromptPartial (channel/category/thread/role-specific prompts)
- **Knowledge Base:** ChannelKBSource
- **Cache & Context:** CachedUser, CachedCategory, CachedChannel, CachedMessage
- **Authentication:** AuthUser, AuthSession, AuthAccount, ExpressSession
- **Analytics:** BotCommand, UserSettings

**Key Relationships:**
- Guild has many Members, Sessions, Personas, KB Sources
- User has many Characters, Personas, AI Preferences, Settings
- Channel has many KB Sources, Cached Messages

---

## Common Workflows

### Adding a New Slash Command

1. **Create command file:** `src/commands/my-command.ts`
   ```typescript
   import { Command } from './types';

   export const myCommand: Command = {
     name: 'mycommand',
     description: 'Does something cool',
     options: [...],
     async execute(context) {
       // Implementation
     },
   };
   ```

2. **Register command:** Add to `src/commands/executor.ts`
   ```typescript
   import { myCommand } from './my-command';

   export const commands = {
     // ... existing
     mycommand: myCommand,
   };
   ```

3. **Deploy to Discord:** Run `npm run deploy-commands` (or let bot auto-register on startup)

4. **Test:** Use `/mycommand` in Discord or call via HTTP API

### Adding a New Service

1. **Create service file:** `src/services/category/my-service.ts`
   ```typescript
   class MyService {
     private static instance: MyService;

     private constructor() {}

     static getInstance(): MyService {
       if (!MyService.instance) {
         MyService.instance = new MyService();
       }
       return MyService.instance;
     }

     async doWork(): Promise<void> {
       // Implementation
     }
   }

   export default MyService.getInstance();
   ```

2. **Create types:** `src/services/category/types.ts`

3. **Import and use:** `import myService from '@/services/category/my-service';`

### Adding a Database Model

1. **Update Prisma schema:** `prisma/schema.prisma`
   ```prisma
   model MyModel {
     id        String   @id @default(cuid())
     guildId   String
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt

     guild Guild @relation(fields: [guildId], references: [guildId], onDelete: Cascade)

     @@index([guildId])
   }
   ```

2. **Update Guild model:** Add relation
   ```prisma
   model Guild {
     // ... existing
     myModels MyModel[]
   }
   ```

3. **Create migration:** `npx prisma migrate dev --name add_my_model`

4. **Generate client:** `npx prisma generate` (happens automatically)

5. **Use in code:**
   ```typescript
   import prisma from '@/services/db/client';

   const data = await prisma.myModel.findMany({
     where: { guildId },
   });
   ```

### Running Tests

**Unit Tests:**
```bash
npm run test:unit              # All unit tests
npm run test:unit -- my-file   # Specific file
npm run test:unit:coverage     # With coverage
```

**Integration Tests:**
```bash
npm run test:integration       # All integration tests
npm run test:integration:ui    # With Vitest UI
```

**E2E Tests:**
```bash
npm run test:e2e              # All E2E tests
npm run test:e2e:headed       # With browser visible
npm run test:e2e:ui           # Playwright UI mode
npm run test:e2e:capture      # With screenshots/video
```

**IMPORTANT:** Use integration tests frequently and review their results. If screenshots/videos don't match expected output or tests run very slow, something is wrong.

### Using MCP Server

The project includes an MCP server for background test execution during development.

**Start server:**
```bash
npm run mcp:up
```

**Check status:**
```bash
npm run mcp:status
```

**Stop server:**
```bash
npm run mcp:down
```

**Available MCP tools:**
- `run_playwright_tests` - Start test run in background
- `get_test_status` - Check test status
- `get_test_output` - View test logs
- `list_test_runs` - List all runs
- `get_test_artifacts` - Get screenshots/videos/traces

See [.claude/README.md](.claude/README.md) for detailed MCP usage.

---

## Important Files

### Configuration
- [src/config.ts](src/config.ts) - Environment variable loading and validation
- [.env.example](.env.example) - Required environment variables
- [tsconfig.json](tsconfig.json) - TypeScript configuration
- [vitest.config.ts](vitest.config.ts) - Vitest configuration
- [playwright.config.ts](playwright.config.ts) - Playwright configuration

### Entry Points
- [src/server.ts](src/server.ts) - Express server initialization
- [src/index.ts](src/index.ts) - Module exports
- [src/routes.ts](src/routes.ts) - Route definitions

### Core Services
- [src/services/discord/fumblebot-client.ts](src/services/discord/fumblebot-client.ts) - Discord bot client
- [src/services/ai/ai-service.ts](src/services/ai/ai-service.ts) - AI service (Anthropic + OpenAI)
- [src/services/ai/smart-orchestrator.ts](src/services/ai/smart-orchestrator.ts) - AI routing logic
- [src/services/db/client.ts](src/services/db/client.ts) - Prisma client
- [src/lib/core-client.ts](src/lib/core-client.ts) - Core server HTTP client

### Command System
- [src/commands/executor.ts](src/commands/executor.ts) - Command registry and executor
- [src/commands/roll.ts](src/commands/roll.ts) - Dice rolling (example command)
- [src/services/discord/handlers/interaction.ts](src/services/discord/handlers/interaction.ts) - Discord interaction router

### Database
- [prisma/schema.prisma](prisma/schema.prisma) - Database schema
- [prisma/migrations/](prisma/migrations/) - Migration history

---

## Environment Configuration

**Required Variables:**
- `SESSION_SECRET` - Secure session management
- `FUMBLEBOT_ADMIN_IDS` - Admin Discord user IDs (comma-separated)
- `FUMBLEBOT_DISCORD_CLIENT_ID` - Discord application ID
- `FUMBLEBOT_DISCORD_TOKEN` - Discord bot token
- `FUMBLEBOT_DISCORD_CLIENT_SECRET` - OAuth2 secret
- `FUMBLEBOT_DISCORD_PUBLIC_KEY` - Interaction verification
- `FUMBLEBOT_OPENAI_API_KEY` - OpenAI API key
- `FUMBLEBOT_ANTHROPIC_API_KEY` - Anthropic API key
- `FUMBLEBOT_DATABASE_URL` - PostgreSQL connection string

**Optional Variables:**
- `FUMBLEBOT_DEEPGRAM_API_KEY` - Voice features (STT/TTS)
- `FUMBLEBOT_AI_SECRET` - External service calls
- `CORE_SERVER_URL` - Core integration URL
- `CORE_SECRET` - Service-to-service auth
- `FUMBLEBOT_DISCORD_GUILD_ID` - Dev server for testing

See [.env.example](.env.example) for complete list with descriptions.

---

## Current Development Status

### Completed Features
- ✅ Discord slash commands (/roll, /voice, /settings)
- ✅ Voice transcription and TTS with Deepgram
- ✅ Multi-agent AI orchestration (Sonnet + Haiku)
- ✅ Foundry VTT integration and container management
- ✅ MCP server for AI tool access
- ✅ World Anvil integration
- ✅ Admin portal and API
- ✅ Guild configuration and settings
- ✅ Knowledge base query system
- ✅ Channel KB sources backend (Web UI pending)

### In Progress
- 🔄 Channel KB sources Web UI (Backend complete)
- 🔄 Old fumblebot feature migration (Planning phase - see [old-fumblebot-features.md](docs/plans/old-fumblebot-features.md))

### Planned Features
See [docs/plans/old-fumblebot-features.md](docs/plans/old-fumblebot-features.md) for detailed migration plan:
1. Character Management & Roleplay System
2. In-Character Commands (/ic say, /ic do, /ic move)
3. Canvas-Based Tactical Grid System
4. Event Management & Automation
5. Audio File Playback System
6. Explicit AI Generation Commands (/write, /imagine)
7. Auto-Mention Response System
8. Timestamp Converter Utility

---

## Git Workflow

**Branches:**
- `main` - Production-ready code
- Feature branches - `feature/description`
- Fix branches - `fix/description`

**Commits:**
- Use conventional commit format: `type(scope): description`
- Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`
- Example: `feat(commands): add character management system`

**Pull Requests:**
- Title: Clear description of changes
- Description: Summary, test plan, related issues
- Review: Required before merge to main

---

## Troubleshooting

### Common Issues

**Database Connection Errors:**
```bash
# Check PostgreSQL is running
npm run db:status

# Reset database (CAUTION: Deletes all data)
npm run db:reset

# Apply pending migrations
npx prisma migrate dev
```

**Discord Bot Not Responding:**
- Check `FUMBLEBOT_DISCORD_TOKEN` is set correctly
- Verify bot has required intents in Discord Developer Portal
- Check bot permissions in server
- Review logs for error messages

**AI Service Errors:**
- Verify `FUMBLEBOT_ANTHROPIC_API_KEY` and `FUMBLEBOT_OPENAI_API_KEY`
- Check API quota/rate limits
- Review token limits in requests

**Voice Features Not Working:**
- Verify `FUMBLEBOT_DEEPGRAM_API_KEY` is set
- Check bot has voice permissions in Discord
- Ensure user is in voice channel

**Tests Failing:**
- Run `npm run test:integration` and review screenshots
- Check test artifacts in `test-results/`
- Verify MCP server is running for background tests
- Review [tests/README.md](tests/README.md) for debugging tips

### Logs

**Application Logs:**
- Console output during development
- Check for stack traces and error messages

**Test Artifacts:**
- `test-results/` - Playwright screenshots, videos, traces
- `playwright-report/` - HTML test reports
- `coverage/` - Code coverage reports

### Getting Help

1. **Check Documentation:**
   - [docs/](docs/) for architectural guidance
   - [docs/agent/](docs/agent/) for API specs and integration guides
   - [tests/README.md](tests/README.md) for testing help

2. **Review Examples:**
   - Existing commands in [src/commands/](src/commands/)
   - Service implementations in [src/services/](src/services/)
   - Tests in [tests/](tests/)

3. **Ask Questions:**
   - Reference this file (CLAUDE.md) for context
   - Specify which feature or service you're working on
   - Include relevant error messages or logs

---

## Tips for Claude Code Sessions

1. **Always check documentation first** - User-written docs in `docs/` are authoritative
2. **Use integration tests frequently** - Review screenshots/videos for sanity checks
3. **Follow existing patterns** - Check similar implementations before creating new ones
4. **Update agent docs** - Regenerate docs in `docs/agent/` after significant changes
5. **Test incrementally** - Don't wait until completion to run tests
6. **Ask for clarification** - If requirements are ambiguous, ask before implementing
7. **Document as you go** - Update relevant docs when adding features
8. **Check for conflicts** - Verify agent docs don't conflict with user docs

---

## Version Information

- **Node.js:** 20.19.0+
- **TypeScript:** 5.6
- **Discord.js:** 14.16.3
- **Prisma:** 7.0
- **Anthropic SDK:** ^0.32.1
- **OpenAI SDK:** ^6.9.1
- **Vitest:** Latest
- **Playwright:** Latest

---

## Quick Reference

**Start Development:**
```bash
npm install
npm run dev
```

**Run Tests:**
```bash
npm run test:unit
npm run test:integration
npm run test:e2e
```

**Database Operations:**
```bash
npx prisma migrate dev
npx prisma studio
npx prisma generate
```

**Deploy Commands:**
```bash
npm run deploy-commands
```

**MCP Server:**
```bash
npm run mcp:up
npm run mcp:status
npm run mcp:down
```

---

This document is maintained as the authoritative reference for Claude Code sessions. When in doubt, consult this file and the user-written documentation in [docs/](docs/).

Last updated: 2025-12-06
