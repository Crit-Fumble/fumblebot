# MCP Tools Awareness & Web Fetch Capability

**Date**: 2025-12-03
**Status**: Implemented with web search tools

## Overview

FumbleBot now has enhanced AI capabilities with:
1. **AI-Powered Classification** - Uses Haiku to intelligently detect D&D lookup requests
2. **Web Search Tools** - Searches 5e.tools, Cypher SRD, Forgotten Realms Wiki, and more
3. **Voice/Text Parity** - Same lookup features in both voice and text chat
4. **Text Embeds** - Voice responses always post text embeds with full content
5. **Pagination** - Interactive buttons for long content (◀ Previous | Next ▶)
6. **Screenshots** - Captures and embeds spell/monster images from 5e.tools
7. **Source Linkbacks** - Always includes direct links to reference sites

---

## What's New

### 1. AI-Powered Message Classification

The Discord text handler now uses **Claude Haiku** for intelligent lookup classification. When you mention FumbleBot with a question, it:

- Automatically detects if it's a D&D/TTRPG lookup request
- Determines the correct category (spells, bestiary, items, rules, etc.)
- Optimizes the search query for better results
- Falls back to regex patterns if AI unavailable

**Example Classifications:**
```
"Chase rules" → {"category":"actions","query":"chase"}
"What is a beholder" → {"category":"bestiary","query":"beholder"}
"Fireball spell" → {"category":"spells","query":"fireball"}
"How does grappling work" → {"category":"actions","query":"grapple"}
```

### 2. Voice Response Text Embeds

Voice responses now **always post a text embed** alongside the spoken response. This provides:

- **Full content** - Complete lookup results (voice is shortened)
- **Pagination** - Interactive buttons for long content (◀ Previous | Next ▶)
- **Screenshots** - Embedded images from 5e.tools where available
- **Source links** - Direct links to reference sites
- **Accessibility** - Fallback if voice is hard to hear

### 3. Web Search in Text Chat

Discord text chat now has **parity with voice** for web searches:

- Mention FumbleBot with a D&D question
- Haiku classifies and routes to the appropriate search tool
- Results displayed with pagination and source links

**Example Interactions:**

```
User: "@FumbleBot what's the range of Fireball?"
FumbleBot: [Posts embed with full spell details, screenshot, and 5e.tools link]

User: "@FumbleBot how does grappling work?"
FumbleBot: [Posts embed with action rules and pagination buttons]

User: "Generate an NPC tavern keeper"
FumbleBot: "I can generate a detailed NPC for that tavern keeper with backstory, personality, and stats..."
```

### 4. Web Tools

FumbleBot has multiple web tools for accessing TTRPG resources:

#### `web_fetch` - Direct URL Fetch
Fetches content from a specific URL with AI-powered extraction.

**Supported Sites:**
- **5e.tools** - D&D 5e reference
- **D&D Beyond** - Character sheets, spells, rules
- **FoundryVTT KB** - https://foundryvtt.com/kb/ (API docs, user guides)
- **Cypher System** - Cypher tools and references
- **General** - Any TTRPG website

**Usage:**
```typescript
{
  tool: "web_fetch",
  args: {
    url: "https://foundryvtt.com/kb/article/actors/",
    query: "How to create actors programmatically",
    site: "foundryvtt-kb"
  }
}
```

#### `web_search_5etools` - D&D 5e Search
Search 5e.tools for D&D 5e spells, items, monsters, classes, races, feats, etc.

**Categories:** spells, items, bestiary, classes, races, feats, backgrounds, conditions, actions

**Usage:**
```typescript
{
  tool: "web_search_5etools",
  args: { query: "fireball", category: "spells" }
}
```

#### `web_search_cypher_srd` - Cypher System Search
Search Old Gus' Cypher System SRD for rules, abilities, types, descriptors, foci, and cyphers.

**Usage:**
```typescript
{
  tool: "web_search_cypher_srd",
  args: { query: "bears a halo of fire" }
}
```

#### `web_search_forgotten_realms` - Lore Search
Search the Forgotten Realms Wiki for D&D lore, characters, locations, deities, and items.

**Usage:**
```typescript
{
  tool: "web_search_forgotten_realms",
  args: { query: "Waterdeep" }
}
```

#### `web_search_dndbeyond_support` - D&D Beyond Help
Search D&D Beyond Support for troubleshooting, account help, and FAQ.

**Usage:**
```typescript
{
  tool: "web_search_dndbeyond_support",
  args: { query: "share content with campaign" }
}
```

**Common Features:**
- AI-powered content extraction
- Markdown formatting
- Automatic source linkbacks
- Spell cards, NPC stat blocks, tables

### 5. Context-Specific Prompts

The system prompt adapts based on the question:

| Question Type | Prompt Enhancement |
|--------------|-------------------|
| Spell/class questions | "You have access to a KB with 338 D&D 5e spells and 12 classes" |
| Cypher System | "You have access to Cypher System articles in your KB" |
| FoundryVTT | "You have access to FoundryVTT tools (screenshots, chat, API docs)" |
| NPC/lore | "You can generate NPCs and lore. Suggest using these tools" |
| Default | Short prompt about available tools |

### 6. Source Linkbacks & Rich Formatting

All responses now include:
- **Linkbacks**: `Source: [URL](URL)` for external content
- **Spell Cards**: Level, school, components, duration, description
- **NPC Stat Blocks**: Stats, abilities, actions
- **Tables**: Markdown formatted tables

---

## Configuration Required

### Missing Environment Variable

**FUMBLEBOT_DEEPGRAM_API_KEY** is not yet configured in production. This is required for voice transcription.

**To complete setup:**

1. **Get Deepgram API Key:**
   - Go to https://console.deepgram.com/
   - Create account or sign in
   - Create a new API key
   - Copy the key

2. **Add to production environment:**
   ```bash
   doctl compute ssh fumblebot --ssh-command \
     "echo 'FUMBLEBOT_DEEPGRAM_API_KEY=your_key_here' >> /root/fumblebot/.env && systemctl restart fumblebot"
   ```

3. **Update local .env.fumblebot:**
   - Add the key to line 53:
   ```bash
   FUMBLEBOT_DEEPGRAM_API_KEY=your_key_here
   ```

### Already Configured

✅ **FUMBLEBOT_ADMIN_IDS** - Already set (4 admin users)
✅ **CORE_SERVER_URL** - Set to Core server URL (internal VPC)
✅ **CORE_SECRET** - Configured for service-to-service auth
✅ **CORE_SERVER_PORT** - Set to `4000`

---

## File Changes

### New Files
- **src/services/discord/voice/mcp-tools-prompt.ts** - MCP tools system prompt
- **src/services/discord/utils/pagination.ts** - Pagination utilities for long content
- **src/services/web/screenshot.ts** - Screenshot capture for 5e.tools pages
- **docs/agent/MCP_TOOLS_AND_WEB_FETCH.md** - This documentation

### Modified Files
- **src/services/discord/voice/assistant.ts** - Voice response text embeds, pagination, web search integration
- **src/services/discord/handlers/message.ts** - Haiku-based lookup classification, web search in text chat
- **src/mcp/fumblebot-mcp-server.ts** - Web search tool handlers
- **src/mcp/handlers/web.ts** - Web search implementations
- **src/mcp/tools/definitions.ts** - New web_search_* tool definitions
- **src/services/web/fetch.ts** - Enhanced web fetch with screenshot support
- **.env.example** - Added voice configuration section
- **.env.fumblebot** - Added Core proxy and voice config

### Environment Updates
- Added `FUMBLEBOT_DEEPGRAM_API_KEY` (required for voice)
- Added `FUMBLEBOT_DISCORD_TEST_GUILD_ID` (optional)
- Added `CORE_SERVER_URL`, `CORE_SECRET`, `CORE_SERVER_PORT`

---

## Testing Voice Assistant

Once Deepgram API key is added:

1. **Join voice channel in Discord**
2. **Run command:**
   ```
   /voice assistant
   ```
3. **Test wake words:**
   ```
   "Hey FumbleBot, what is Fireball?"
   "Hey FumbleBot, roll initiative"
   "Hey FumbleBot, fetch the FoundryVTT Actor API docs"
   ```

4. **Verify responses:**
   - ✅ Mentions available tools
   - ✅ Provides concise answers
   - ✅ Includes source linkbacks
   - ✅ Suggests using tools when appropriate

---

## MCP Tool Categories

FumbleBot's MCP server now exposes 8 categories of tools:

| Category | Tools | Description |
|----------|-------|-------------|
| `foundry_*` | screenshots, chat | Foundry VTT operations |
| `foundry_*_container` | create, list, stop | On-demand Foundry instances |
| `anthropic_*` | sonnet, haiku | Claude AI operations |
| `openai_*` | gpt4o, dalle | OpenAI operations |
| `container_*` | terminal | Sandboxed containers |
| `fumble_*` | dice, NPC, lore | FumbleBot utilities |
| `kb_*` | search, get, list | Knowledge base (362 articles) |
| `web_*` | fetch, search_5etools, search_cypher_srd, search_forgotten_realms, search_dndbeyond_support | External TTRPG sites & search |

---

## Benefits

✅ **AI Classification** - Haiku intelligently routes lookups to correct search
✅ **Voice/Text Parity** - Same powerful search in voice and text chat
✅ **Text Embeds** - Every voice response includes full text for accessibility
✅ **Pagination** - Long content split into navigable pages with buttons
✅ **Screenshots** - 5e.tools spell cards and monster stat blocks embedded
✅ **External Search** - 5e.tools, Cypher SRD, Forgotten Realms, D&D Beyond Support
✅ **Source Citations** - Always links back to original source
✅ **Rich Formatting** - Spell cards, NPC stat blocks, tables
✅ **362 KB Articles** - Internal knowledge base ready
✅ **Multi-System** - D&D 5e, Cypher, FoundryVTT, PC games

---

## Next Steps

1. **Add Deepgram API key** to complete voice assistant setup
2. **Test voice commands** in Discord
3. **Try web_fetch** via MCP for external sites
4. **Monitor responses** for tool awareness
5. **Adjust prompts** based on user feedback

---

**Status**: Complete with web search tools
**Last Updated**: 2025-12-03
