# FumbleBot API Endpoints

Reference for all FumbleBot API endpoints that this SDK interfaces with.

## Authentication

All requests require an API key in the Authorization header:

```
Authorization: Bearer <api-key>
```

API keys are issued per-service. Core server should have its own dedicated key.

## Base URL

- Production: `https://fumblebot.crit-fumble.com/api`
- Development: `http://localhost:3001/api`

---

## Health & Status

### GET /health

Check API health status.

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0"
}
```

---

## Dice Rolling

### POST /dice/roll

Execute a dice roll.

**Request:**
```json
{
  "notation": "2d20kh1+5",
  "label": "Attack Roll",
  "context": {
    "userId": "user123",
    "guildId": "guild456",
    "sessionId": "session789"
  }
}
```

**Response:**
```json
{
  "notation": "2d20kh1+5",
  "rolls": [18, 7],
  "modifier": 5,
  "total": 23,
  "isCrit": false,
  "isFumble": false,
  "label": "Attack Roll"
}
```

### GET /dice/history

Get roll history.

**Query Parameters:**
- `userId` - Filter by user
- `sessionId` - Filter by session
- `limit` - Max results (default: 20)
- `page` - Page number

**Response:**
```json
{
  "items": [...],
  "total": 150,
  "page": 1,
  "pageSize": 20,
  "hasMore": true
}
```

---

## AI Assistant

### POST /ai/chat

Send a chat message to the AI assistant.

**Request:**
```json
{
  "messages": [
    { "role": "user", "content": "How does grappling work?" }
  ],
  "systemPrompt": "You are a helpful D&D assistant.",
  "context": {
    "guildId": "guild123",
    "userId": "user456",
    "gameSystem": "dnd5e",
    "campaignId": "campaign789"
  },
  "options": {
    "maxTokens": 1000,
    "temperature": 0.7
  }
}
```

**Response:**
```json
{
  "content": "Grappling in D&D 5e works as follows...",
  "model": "gpt-4",
  "usage": {
    "promptTokens": 150,
    "completionTokens": 300,
    "totalTokens": 450
  }
}
```

### POST /ai/lookup

Lookup rules or lore.

**Request:**
```json
{
  "query": "fireball spell",
  "context": "player wants to cast in a small room",
  "gameSystem": "dnd5e",
  "maxTokens": 500
}
```

---

## AI Generators

### POST /ai/generate/npc

Generate an NPC.

**Request:**
```json
{
  "type": "blacksmith",
  "setting": "medieval fantasy",
  "gameSystem": "dnd5e",
  "requirements": "dwarf, grumpy but secretly kind"
}
```

**Response:**
```json
{
  "content": "Thorin Ironforge is a...",
  "npc": {
    "name": "Thorin Ironforge",
    "race": "Dwarf",
    "occupation": "Blacksmith",
    "traits": ["grumpy", "meticulous", "secretly kind"],
    "quirk": "Always hums while working",
    "secret": "Lost his family to orc raiders",
    "quote": "Ye want it done right or done fast? Can't have both."
  },
  "model": "gpt-4"
}
```

### POST /ai/generate/dungeon

Generate a dungeon.

**Request:**
```json
{
  "theme": "ancient dwarven mine",
  "size": "medium",
  "level": 5,
  "style": "exploration with combat",
  "gameSystem": "dnd5e"
}
```

### POST /ai/generate/encounter

Generate an encounter.

**Request:**
```json
{
  "terrain": "forest",
  "difficulty": "hard",
  "partyLevel": 5,
  "partySize": 4,
  "gameSystem": "dnd5e"
}
```

### POST /ai/generate/image

Generate an image using DALL-E.

**Request:**
```json
{
  "prompt": "A fierce red dragon perched on a mountain",
  "style": "fantasy",
  "size": "1024x1024"
}
```

**Response:**
```json
{
  "url": "https://...",
  "revisedPrompt": "A majestic red dragon..."
}
```

---

## Commands

### POST /commands/execute

Execute a FumbleBot command.

**Request:**
```json
{
  "command": "roll",
  "args": {
    "notation": "2d20kh1"
  },
  "context": {
    "userId": "user123",
    "username": "Player1",
    "guildId": "guild456",
    "channelId": "channel789",
    "platform": "discord"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "🎲 **Player1** rolled 2d20kh1: [18, 7] = **18**",
  "embed": {
    "title": "Dice Roll",
    "color": 5814783,
    "fields": [...]
  },
  "data": {
    "rolls": [18, 7],
    "total": 18
  }
}
```

---

## VTT Integration

### POST /vtt/accounts/link

Link a VTT account.

**Request:**
```json
{
  "userId": "crit-user-123",
  "platform": "roll20",
  "platformUserId": "roll20-id-456",
  "platformUsername": "PlayerName"
}
```

### GET /vtt/accounts/:userId

Get linked VTT accounts for a user.

### DELETE /vtt/accounts/:accountId

Unlink a VTT account.

### POST /vtt/links

Create a game link between VTT and Discord.

**Request:**
```json
{
  "platform": "roll20",
  "gameId": "roll20-game-123",
  "gameName": "Curse of Strahd",
  "guildId": "discord-guild-123",
  "channelId": "discord-channel-456",
  "campaignId": "core-campaign-789",
  "syncChat": true,
  "syncRolls": true,
  "createdBy": "user123"
}
```

### GET /vtt/links/guild/:guildId

Get game links for a Discord guild.

### PUT /vtt/links/:linkId

Update game link settings.

### DELETE /vtt/links/:linkId

Delete a game link.

---

## Activities

### POST /activities

Create an activity session.

**Request:**
```json
{
  "guildId": "guild123",
  "channelId": "channel456",
  "userId": "user789",
  "activityType": "dice-roller"
}
```

### GET /activities/:sessionId

Get activity session.

### PUT /activities/:sessionId/state

Update activity state.

### DELETE /activities/:sessionId

End activity session.

---

## Voice Sessions

### POST /voice/sessions

Start a voice session.

**Request:**
```json
{
  "guildId": "guild123",
  "channelId": "voice-channel-456",
  "userId": "user789"
}
```

### GET /voice/sessions/:guildId/:channelId

Get active voice session.

### DELETE /voice/sessions/:sessionId

End voice session.

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional context"
  }
}
```

**Common Error Codes:**
- `VALIDATION_ERROR` - Invalid request data
- `UNAUTHORIZED` - Invalid or missing API key
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `RATE_LIMITED` - Too many requests
- `INTERNAL_ERROR` - Server error
