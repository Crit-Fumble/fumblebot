# MCP Tools Awareness & Web Fetch Capability

**Date**: 2025-12-01
**Status**: Implemented, pending Deepgram API key

## Overview

FumbleBot now has enhanced AI capabilities with:
1. **MCP Tools Awareness** - Voice assistant knows about its available tools
2. **Web Fetch Capability** - Can access external TTRPG sites for reference
3. **Source Linkbacks** - Always includes source citations
4. **Rich Embeds** - Formats spell cards, NPC stat blocks, and tables

---

## What's New

### 1. MCP Tools Awareness

The voice assistant now has an internal system prompt that makes it aware of all available MCP tools. When you ask questions, it can:

- Suggest searching the knowledge base for spells/rules
- Offer to generate NPCs or lore
- Mention Foundry VTT capabilities
- Recommend fetching from external sites

**Example Interactions:**

```
User: "Hey FumbleBot, what's the range of Fireball?"
FumbleBot: "Fireball has a range of 150 feet. I have the full spell description in my knowledge base if you need it."

User: "Hey FumbleBot, how does grappling work?"
FumbleBot: "I can search my knowledge base for the grappling rules. Let me fetch that for you..."

User: "Generate an NPC tavern keeper"
FumbleBot: "I can generate a detailed NPC for that tavern keeper with backstory, personality, and stats..."
```

### 2. Web Fetch Tool

New `web_fetch` MCP tool allows FumbleBot to access external TTRPG resources:

**Supported Sites:**
- **5e.tools** - D&D 5e reference
- **D&D Beyond** - Character sheets, spells, rules
- **FoundryVTT KB** - https://foundryvtt.com/kb/ (API docs, user guides)
- **Cypher System** - Cypher tools and references
- **General** - Any TTRPG website

**Features:**
- AI-powered content extraction
- Markdown formatting
- Automatic source linkbacks
- Spell cards, NPC stat blocks, tables

**Usage via MCP:**
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

### 3. Context-Specific Prompts

The system prompt adapts based on the question:

| Question Type | Prompt Enhancement |
|--------------|-------------------|
| Spell/class questions | "You have access to a KB with 338 D&D 5e spells and 12 classes" |
| Cypher System | "You have access to Cypher System articles in your KB" |
| FoundryVTT | "You have access to FoundryVTT tools (screenshots, chat, API docs)" |
| NPC/lore | "You can generate NPCs and lore. Suggest using these tools" |
| Default | Short prompt about available tools |

### 4. Source Linkbacks & Rich Formatting

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
✅ **CORE_SERVER_URL** - Set to `http://10.108.0.4` (Core VPC IP)
✅ **CORE_SECRET** - Configured for service-to-service auth
✅ **CORE_SERVER_PORT** - Set to `4000`

---

## File Changes

### New Files
- **src/services/discord/voice/mcp-tools-prompt.ts** - MCP tools system prompt
- **docs/agent/MCP_TOOLS_AND_WEB_FETCH.md** - This documentation

### Modified Files
- **src/services/discord/voice/assistant.ts** - Added MCP context prompts
- **src/mcp/fumblebot-mcp-server.ts** - Added web_fetch tool
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
| `web_*` | fetch | External TTRPG sites |

---

## Benefits

✅ **Smarter Responses** - Voice assistant knows what tools it has
✅ **External Resources** - Can fetch from 5e.tools, D&D Beyond, FoundryVTT KB
✅ **Source Citations** - Always links back to original source
✅ **Rich Formatting** - Spell cards, NPC stat blocks, tables
✅ **Context-Aware** - Adapts prompt based on question type
✅ **362 KB Articles** - Internal knowledge base ready
✅ **Multi-System** - D&D 5e, Cypher, FoundryVTT, PC games
✅ **Tool Suggestions** - Proactively suggests relevant tools

---

## Next Steps

1. **Add Deepgram API key** to complete voice assistant setup
2. **Test voice commands** in Discord
3. **Try web_fetch** via MCP for external sites
4. **Monitor responses** for tool awareness
5. **Adjust prompts** based on user feedback

---

**Status**: Core functionality complete, awaiting Deepgram API key
**Last Updated**: 2025-12-01
