# Guild Configuration Migration

## Summary

Successfully split FumbleBot guild configuration into:
- **General settings** → Core Admin API (prefix, timezone, feature flags)
- **AI-specific settings** → FumbleBot `GuildAIConfig` table (models, temperature, thinking)

## Changes Made

### 1. Database Schema ([prisma/schema.prisma](../prisma/schema.prisma:18-69))

Added new `GuildAIConfig` model for AI-specific settings:
- Model selection (primary, lookup, thinking)
- Temperature & max tokens
- AI feature toggles (thinking, lookup, context, memory)
- Context configuration
- Custom settings (extensible JSON)

Deprecated `Guild.settings` JSON field - will be phased out after migration.

### 2. Configuration Service ([src/services/config/guild-config.ts](../src/services/config/guild-config.ts:1-257))

Created unified configuration service with:
- `getGuildConfig(guildId)` - Get complete config (general + AI)
- `getGuildGeneralConfig(guildId)` - Fetch from Core Admin API
- `getGuildAIConfig(guildId)` - Fetch from FumbleBot database
- `updateGuildGeneralConfig(guildId, updates)` - Update Core settings
- `updateGuildAIConfig(guildId, updates)` - Update AI settings
- Convenience helpers: `getGuildPrefix()`, `getGuildAIModels()`

Includes automatic fallback to defaults if Core is unavailable.

### 3. Migration Script ([scripts/migrate-guild-config.ts](../scripts/migrate-guild-config.ts:1-247))

Automated migration script that:
- Reads existing `Guild.settings` JSON
- Splits into general settings (→ Core) and AI settings (→ GuildAIConfig)
- Preserves custom settings in AI config
- Supports dry-run mode for safety
- Can migrate all guilds or a specific guild

### 4. Tests ([src/services/config/guild-config.test.ts](../src/services/config/guild-config.test.ts:1-282))

Comprehensive unit tests (9 tests, all passing):
- Config fetching from both sources
- Fallback to defaults on errors
- Config updates
- Convenience helpers

## Next Steps

### Step 1: Run Database Migration

When you're ready to apply the schema changes:

```bash
# Set your database URL
export FUMBLEBOT_DATABASE_URL="postgresql://..."

# Create the migration
npx prisma migrate dev --name add_guild_ai_config

# Or just generate the client for now
npx prisma generate
```

### Step 2: Run Migration Script (Dry Run First!)

Test the migration without making changes:

```bash
# Dry run - see what would be migrated
tsx scripts/migrate-guild-config.ts --dry-run

# Dry run for a specific guild
tsx scripts/migrate-guild-config.ts --dry-run --guild 123456789

# Actually perform the migration
tsx scripts/migrate-guild-config.ts

# Migrate a specific guild
tsx scripts/migrate-guild-config.ts --guild 123456789
```

### Step 3: Update Code to Use New Config System

Replace direct `Guild.settings` access with the config service:

**Before:**
```typescript
const guild = await prisma.guild.findUnique({ where: { guildId } })
const prefix = guild.settings.prefix || '!'
```

**After:**
```typescript
import { getGuildPrefix } from './services/config/guild-config.js'

const prefix = await getGuildPrefix(guildId)
```

**AI Model Configuration:**
```typescript
import { getGuildAIModels } from './services/config/guild-config.js'

const { primaryModel, temperature, maxTokens } = await getGuildAIModels(guildId)
```

### Step 4: Verify Migration

1. Check Core Admin API has the guild configs:
   ```bash
   curl -H "X-Core-Secret: $CORE_SECRET" \\
     http://core.internal:4000/api/admin/guilds/123456789/config
   ```

2. Check FumbleBot has AI configs:
   ```typescript
   const aiConfig = await prisma.guildAIConfig.findMany()
   console.log(aiConfig)
   ```

3. Run tests to ensure everything works:
   ```bash
   npm run test:unit
   ```

## Configuration Reference

### General Settings (Core Admin API)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `prefix` | string | `"!"` | Command prefix |
| `language` | string | `"en"` | Bot language |
| `timezone` | string | `"UTC"` | Guild timezone |
| `allowDMs` | boolean | `true` | Allow DM commands |
| `diceRolling` | boolean | `true` | Enable dice rolling |
| `voiceCommands` | boolean | `false` | Enable voice commands |
| `aiAssistant` | boolean | `true` | Enable AI features |
| `knowledgeBase` | boolean | `true` | Enable KB lookups |
| `scheduling` | boolean | `true` | Enable session scheduling |

### AI Settings (FumbleBot)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `primaryModel` | string | `"claude-sonnet-4-20250514"` | Main reasoning model |
| `lookupModel` | string | `"claude-haiku-4-20250514"` | Quick lookup model |
| `thinkingModel` | string | `"claude-sonnet-4-20250514"` | Thinking/analysis model |
| `temperature` | number | `0.7` | Response creativity (0-1) |
| `maxTokens` | number | `2000` | Max response length |
| `enableThinking` | boolean | `true` | Show AI thinking |
| `enableLookup` | boolean | `true` | Enable KB lookups |
| `enableContext` | boolean | `true` | Use conversation context |
| `enableMemory` | boolean | `true` | Remember users |
| `maxContextMessages` | number | `20` | Context window size |
| `contextWindowHours` | number | `24` | Context time window |

## Example Usage

### Get Complete Guild Config

```typescript
import { getGuildConfig } from './services/config/guild-config.js'

const config = await getGuildConfig(guildId)

console.log(config.general.prefix)       // "!"
console.log(config.ai.primaryModel)      // "claude-sonnet-4-20250514"
console.log(config.ai.temperature)       // 0.7
```

### Update General Settings

```typescript
import { updateGuildGeneralConfig } from './services/config/guild-config.js'

await updateGuildGeneralConfig(guildId, {
  prefix: '?',
  timezone: 'America/New_York',
  aiAssistant: true,
})
```

### Update AI Settings

```typescript
import { updateGuildAIConfig } from './services/config/guild-config.js'

await updateGuildAIConfig(guildId, {
  primaryModel: 'claude-opus-4-20241113',
  temperature: 0.8,
  enableThinking: false,
})
```

## Architecture Benefits

### Before (Monolithic JSON)
```
Guild.settings = {
  prefix: "!",
  timezone: "UTC",
  aiModel: "claude-sonnet",
  temperature: 0.7,
  customThing: "value"
}
```
❌ All settings mixed together
❌ No structure or validation
❌ Hard to manage across services

### After (Split Architecture)
```
Core Admin API                     FumbleBot GuildAIConfig
├─ prefix: "!"                     ├─ primaryModel: "claude-sonnet"
├─ timezone: "UTC"                 ├─ temperature: 0.7
├─ aiAssistant: true               ├─ enableThinking: true
└─ ...                             └─ customSettings: { ... }
```
✅ Clear separation of concerns
✅ Strongly typed
✅ Centralized general config in Core
✅ AI settings stay with AI logic

## Rollback Plan

If issues arise, the old `Guild.settings` field is still present (deprecated).

To temporarily fall back:
```typescript
// Fallback helper
async function getGuildPrefixLegacy(guildId: string): Promise<string> {
  try {
    // Try new system first
    return await getGuildPrefix(guildId)
  } catch (error) {
    // Fall back to old system
    const guild = await prisma.guild.findUnique({ where: { guildId } })
    return guild?.settings?.prefix || '!'
  }
}
```

## Support

For questions or issues:
- Check test examples: [guild-config.test.ts](../src/services/config/guild-config.test.ts:1-282)
- Review Core migration guide: [FUMBLEBOT_MIGRATION_GUIDE.md](../../core.crit-fumble.com/docs/FUMBLEBOT_MIGRATION_GUIDE.md)
- Test Core API: `curl -H "X-Core-Secret: $CORE_SECRET" http://core.internal:4000/api/admin/guilds/{guildId}/config`
