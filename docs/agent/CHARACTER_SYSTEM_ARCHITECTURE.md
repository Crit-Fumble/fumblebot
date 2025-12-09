# Character System Architecture

**Status:** Implementation Ready
**Last Updated:** 2025-12-08

## Overview

This document describes how FumbleBot integrates with Core's character management system to provide Discord-based character roleplay features without duplicating data.

## Architectural Principle

**Core as Source of Truth:** Core API manages all persistent character data. FumbleBot is a stateless Discord interface that queries Core and maintains only ephemeral Discord-specific state.

```
┌─────────────────┐
│  Discord User   │
└────────┬────────┘
         │ /character create
         │ /ic say "Hello!"
         ▼
┌─────────────────┐
│   FumbleBot     │
│  (Discord Bot)  │
├─────────────────┤
│ • Commands UI   │
│ • Webhooks      │
│ • Active Char   │◄─── Ephemeral state only
│   Cache         │
└────────┬────────┘
         │ HTTP API calls
         ▼
┌─────────────────┐
│   Core Server   │
│  (PostgreSQL)   │
├─────────────────┤
│ • Campaigns     │
│ • Players       │
│ • Characters    │◄─── Source of truth
│ • Sessions      │
│ • Messages      │
└─────────────────┘
```

## Core's Character Model

Core provides these types (from `@crit-fumble/core/types/campaign`):

### Campaign
```typescript
interface Campaign {
  id: string
  guildId: string
  name: string
  description: string | null
  foundrySystemId: string | null
  members: Record<string, CampaignMember>
  // ... world anvil, container, etc
}
```

### Character
```typescript
interface Character {
  id: string
  campaignId: string          // Belongs to campaign
  name: string
  type: CharacterType         // 'pc' | 'npc' | 'familiar' | 'companion' | 'monster'
  avatarUrl: string | null    // ← Used for Discord webhooks
  ownerId: string            // User who owns character
  foundryActorId: string | null
  sheetData: Record<string, unknown>
  isActive: boolean
  isRetired: boolean
  createdAt: Date
  updatedAt: Date
}
```

### SessionMessage
```typescript
interface SessionMessage {
  id: string
  sessionId: string
  discordId: string
  characterId: string | null  // ← Links to character
  content: string
  messageType: 'ic' | 'ooc' | 'narration' | 'roll' | 'system'
  discordMessageId: string | null
  timestamp: Date
}
```

## Core API Endpoints

FumbleBot uses these Core APIs:

### Characters API
```typescript
const coreApi = new CoreApiClient({ baseUrl, serviceSecret })

// List all characters for a campaign
const { characters } = await coreApi.characters.list(campaignId)

// Get specific character
const { character } = await coreApi.characters.get(campaignId, characterId)

// Create new character
const { character } = await coreApi.characters.create(campaignId, {
  name: 'Gandalf',
  type: 'pc',
  avatarUrl: 'https://cdn.discordapp.com/attachments/...',
  ownerId: discordUserId,
  sheetData: {}
})

// Update character
const { character } = await coreApi.characters.update(campaignId, characterId, {
  name: 'Gandalf the Grey',
  avatarUrl: newAvatarUrl
})

// Delete character
await coreApi.characters.delete(campaignId, characterId)
```

### Sessions & Messages API
```typescript
// Get or create active session for channel
const { sessions } = await coreApi.sessions.list({
  campaignId,
  channelId,
  status: 'active'
})

// Log IC message
const { message } = await coreApi.messages.log(sessionId, {
  discordId: userId,
  characterId: characterId,
  content: 'I cast fireball!',
  messageType: 'ic',
  discordMessageId: message.id
})
```

## FumbleBot's Responsibilities

### 1. Active Character Cache (Ephemeral)

FumbleBot tracks "which character is active for user X in channel Y":

```typescript
// In-memory cache (lost on restart - that's OK!)
interface ActiveCharacterCache {
  [userId_channelId: string]: {
    characterId: string
    campaignId: string
    cachedAt: Date
    expiresAt: Date
  }
}

// Example usage
const key = `${userId}_${channelId}`
activeCharacters[key] = {
  characterId: 'char_123',
  campaignId: 'camp_456',
  cachedAt: new Date(),
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h
}
```

**Why ephemeral?**
- No persistence needed - users can re-select character if bot restarts
- Avoids database duplication
- Simple LRU cache or Redis for scaling

### 2. Discord Commands

FumbleBot provides Discord slash commands that call Core API:

#### `/character create <name> [avatar]`
1. Check if active campaign exists for guild
2. Call `coreApi.characters.create(campaignId, { name, avatarUrl, ownerId })`
3. Set as active character in cache
4. Reply with success embed

#### `/character select <character>`
1. Fetch user's characters from `coreApi.characters.list(campaignId)`
2. Autocomplete with character names
3. Update active character cache
4. Reply with confirmation

#### `/character edit [name] [avatar]`
1. Get active character from cache
2. Call `coreApi.characters.update(campaignId, characterId, updates)`
3. Reply with success

#### `/character remove <character>`
1. Confirm with button
2. Call `coreApi.characters.delete(campaignId, characterId)`
3. Clear from active cache if it was active
4. Reply with success

### 3. Webhook-Based IC Messages

When user sends `/ic say <message>`:

1. **Get Active Character:**
   ```typescript
   const active = activeCharacters[`${userId}_${channelId}`]
   const { character } = await coreApi.characters.get(
     active.campaignId,
     active.characterId
   )
   ```

2. **Create Ephemeral Webhook:**
   ```typescript
   const webhook = await channel.createWebhook({
     name: character.name,
     avatar: character.avatarUrl,
     reason: 'IC message'
   })
   ```

3. **Send Message:**
   ```typescript
   const webhookMessage = await webhook.send({
     content: message,
     username: character.name,
     avatarURL: character.avatarUrl
   })
   ```

4. **Delete Webhook:**
   ```typescript
   await webhook.delete()
   ```

5. **Log to Core:**
   ```typescript
   await coreApi.messages.log(sessionId, {
     discordId: userId,
     characterId: character.id,
     content: message,
     messageType: 'ic',
     discordMessageId: webhookMessage.id
   })
   ```

## Data Flow Examples

### Example 1: Create Character

```
User: /character create name:"Gandalf" avatar:<attachment>
  ↓
FumbleBot:
  1. Upload attachment to Discord CDN
  2. POST /api/campaigns/{campaignId}/characters
     {
       name: "Gandalf",
       type: "pc",
       avatarUrl: "https://cdn.discordapp.com/...",
       ownerId: "discord_user_123"
     }
  ↓
Core:
  1. Validate campaign exists
  2. Insert into Characters table
  3. Return { character: {...} }
  ↓
FumbleBot:
  1. Cache as active character
  2. Reply: "✅ Created Gandalf! Use /ic say to speak as this character."
```

### Example 2: In-Character Message

```
User: /ic say message:"I cast fireball!"
  ↓
FumbleBot:
  1. Check active character cache
  2. GET /api/campaigns/{campaignId}/characters/{characterId}
  ↓
Core:
  Returns { character: { name: "Gandalf", avatarUrl: "..." } }
  ↓
FumbleBot:
  1. Create webhook with Gandalf's name + avatar
  2. Send "I cast fireball!" via webhook
  3. Delete webhook
  4. POST /api/sessions/{sessionId}/messages
     {
       discordId: "user_123",
       characterId: "char_456",
       content: "I cast fireball!",
       messageType: "ic"
     }
  ↓
User sees: [Gandalf avatar] Gandalf: I cast fireball!
```

## Campaign Association

### How Characters Link to Campaigns

Characters belong to Campaigns in Core. FumbleBot needs to:

1. **Find or Create Campaign for Guild:**
   ```typescript
   async function getOrCreateGuildCampaign(guildId: string) {
     // Try to find existing active campaign
     const { campaigns } = await coreApi.campaigns.list({ guildId })

     if (campaigns.length > 0) {
       return campaigns[0]
     }

     // Create default campaign for guild
     const { campaign } = await coreApi.campaigns.create({
       guildId,
       name: `${guild.name} Campaign`,
       createdBy: 'fumblebot'
     })

     return campaign
   }
   ```

2. **Allow Users to Switch Campaigns:**
   ```typescript
   // Future: /campaign select <campaign>
   // For now: One campaign per guild
   ```

## Session Management

### Auto-Create Sessions

When an IC message is sent:

```typescript
async function getOrCreateActiveSession(
  campaignId: string,
  channelId: string,
  startedBy: string
): Promise<Session> {
  // Check for active session in this channel
  const { sessions } = await coreApi.sessions.list({
    campaignId,
    channelId,
    status: 'active',
    limit: 1
  })

  if (sessions.length > 0) {
    return sessions[0]
  }

  // Create new session
  const { session } = await coreApi.sessions.create(campaignId, {
    channelId,
    startedBy,
    name: `Session ${new Date().toLocaleDateString()}`
  })

  return session
}
```

### End Sessions

```typescript
// /session end command
async function endSession(sessionId: string, summary?: string) {
  await coreApi.sessions.end(sessionId, { summary })

  // Clear any session-related cache
}
```

## Implementation Files

### Services
- `src/services/character/character-cache.ts` - Active character cache (in-memory)
- `src/services/character/character-service.ts` - Wrapper around Core API
- `src/services/discord/webhook-service.ts` - Webhook creation/cleanup

### Commands
- `src/commands/character.ts` - Character CRUD commands
- `src/commands/ic/say.ts` - In-character speech
- `src/commands/ic/do.ts` - In-character actions with dice
- `src/commands/ic/move.ts` - Movement with directional pad

### No Database Changes Needed
FumbleBot does NOT need:
- ❌ Character model in Prisma
- ❌ Campaign model in Prisma
- ❌ Session model in Prisma

Only potential addition:
- ✅ Redis cache for active characters (optional, for scaling)

## Testing Strategy

### Unit Tests
- `character-cache.test.ts` - Cache CRUD operations
- `character-service.test.ts` - Core API wrapper (mocked)
- `webhook-service.test.ts` - Webhook creation/cleanup

### Integration Tests
- Test full `/character create` flow with Core
- Test `/ic say` message logging
- Test session auto-creation

### E2E Tests
- Playwright tests for Discord interactions
- Verify webhooks appear correctly
- Verify Core receives logged messages

## Migration from Old FumbleBot

Old FumbleBot stored characters in MongoDB:
```javascript
{
  id: ObjectId,
  userId: String,
  guildId: String,
  name: String,
  token: { url: String, attachment: Object },
  channelId: String,  // Active channel
  threadId: String    // Active thread
}
```

**Migration Path:**
1. Export old MongoDB characters to JSON
2. For each character:
   - Find/create campaign for guildId in Core
   - Create character in Core with avatarUrl from token.url
3. No need to migrate active channel state (users can re-select)

## Future Enhancements

1. **Multiple Campaigns per Guild** - Allow `/campaign switch`
2. **Character Sheets Integration** - Pull from Foundry or D&D Beyond
3. **Character Portraits** - Gallery of avatars per character
4. **Shared Characters** - NPCs shared across campaigns
5. **Character Templates** - Quick create from templates

## Related Documentation

- [Core Campaign API](https://core.crit-fumble.com/docs/api/campaigns)
- [Core Characters API](https://core.crit-fumble.com/docs/api/characters)
- [Old FumbleBot Features](../plans/old-fumblebot-features.md)
