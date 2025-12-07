# Multi-Agent AI Architecture

## Overview

FumbleBot's new architecture uses a **Main Agent** (Sonnet) that orchestrates **Lookup Agents** (also Sonnet) for context-aware information retrieval. This replaces the current Haiku-based classification with a smarter, more capable system.

## Current Problems (What We're Fixing)

1. **Haiku isn't smart enough** for initial context classification
2. **Full KB articles embedded** = too much noise in responses
3. **No context filtering** - D&D results returned when asking about Cypher
4. **No direct DB access** - relies on web scraping for 5e.tools lookups
5. **No campaign/game system memory** - each message is independent

## New Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MAIN AGENT (Sonnet)                                   │
│  Has: Conversation history, channel context, game system memory              │
│  Does: Understands intent, orchestrates lookups, synthesizes responses       │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                     CONTEXT MANAGER                                     │ │
│  │  • Active game system (5e, PF2e, Cypher, BitD, etc.)                   │ │
│  │  • Current campaign/setting                                             │ │
│  │  • Channel message history (last N messages)                            │ │
│  │  • User preferences & memory                                            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                         │
│                    ┌───────────────┼───────────────┐                         │
│                    ▼               ▼               ▼                         │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐             │
│  │  LOOKUP AGENT    │ │  LOOKUP AGENT    │ │  LOOKUP AGENT    │             │
│  │  (KB Search)     │ │  (Web Search)    │ │  (DB Query)      │             │
│  │                  │ │                  │ │                  │             │
│  │  Returns:        │ │  Returns:        │ │  Returns:        │             │
│  │  • 3-4 sentence  │ │  • 3-4 sentence  │ │  • Structured    │             │
│  │    summary       │ │    summary       │ │    data          │             │
│  │  • Hyperlink     │ │  • Source URL    │ │  • Quick facts   │             │
│  │  • Confidence    │ │  • Relevance     │ │                  │             │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Sonnet for Everything

**Why:** Haiku's cost savings aren't worth the quality loss for:
- Understanding nuanced TTRPG questions
- Filtering irrelevant game system results
- Generating quality summaries

**Trade-off:** Higher API costs, but much better user experience.

### 2. Summaries + Hyperlinks (Not Full Content)

**Before:**
```
[Full 2000-word spell description embedded in context]
```

**After:**
```
**Fireball** (3rd-level evocation)
Deals 8d6 fire damage in 20ft radius, DEX save for half.
Classic area damage spell, scales +1d6 per slot level above 3rd.
📖 [Full details](https://5e.tools/spells.html#fireball_phb)
```

**Why:**
- Reduces token usage by ~90%
- User can click through for full details
- AI has enough context to answer follow-ups
- Prevents noise from irrelevant sections

### 3. Context-Aware Filtering

The Main Agent maintains awareness of:
- **Active game system** (detected from conversation or explicitly set)
- **Campaign setting** (Forgotten Realms, Golarion, custom, etc.)
- **Conversation topics** (combat, roleplay, world-building, etc.)

This context is passed to Lookup Agents, which filter results accordingly.

### 4. Direct Database Access

FumbleBot gets read access to Core's game database for:
- Fast spell/monster/item lookups (no API calls)
- Complex queries (all 3rd-level wizard spells with fire damage)
- Cached common queries (popular spells, basic rules)

---

## Implementation Plan

### Phase 1: Context Manager Enhancement

**Goal:** Track game system and campaign context per channel

**Files to modify:**
- `src/services/context/guild-context-manager.ts` - Add game system tracking
- `src/services/context/types.ts` - Add GameContext interface

**New data structure:**
```typescript
interface ChannelGameContext {
  channelId: string;
  guildId: string;

  // Game system context
  activeSystem: string | null;      // "5e", "pf2e", "cypher", "bitd", etc.
  systemConfidence: number;         // 0-1, how sure we are
  systemSource: 'explicit' | 'inferred' | 'default';

  // Campaign context
  campaignId: string | null;        // Link to Core campaign
  campaignSetting: string | null;   // "Forgotten Realms", "Homebrew", etc.

  // Conversation topics (rolling window)
  recentTopics: string[];           // ["combat", "spells", "character-creation"]

  // Last updated
  lastActivity: Date;
}
```

**Detection logic:**
1. Explicit: User says "we're playing Pathfinder 2e"
2. Inferred: User asks about "focus points" (PF2e-specific term)
3. Default: Guild-level default or "5e" as fallback

### Phase 2: Lookup Agent Implementation

**Goal:** Create focused Sonnet agents that return summaries

**New file:** `src/services/ai/lookup-agent.ts`

```typescript
interface LookupResult {
  found: boolean;
  summary: string;           // 3-4 sentences max
  sourceUrl: string | null;  // Hyperlink to full content
  sourceType: 'kb' | 'web' | 'database';
  confidence: number;        // 0-1
  gameSystem: string;        // What system this result is for
  relevanceScore: number;    // How relevant to the query
}

interface LookupRequest {
  query: string;
  gameContext: ChannelGameContext;
  lookupType: 'rules' | 'spell' | 'monster' | 'item' | 'lore' | 'general';
}

class LookupAgent {
  async lookup(request: LookupRequest): Promise<LookupResult> {
    // 1. Search appropriate source based on lookupType
    // 2. Filter results by gameContext.activeSystem
    // 3. Use Sonnet to generate 3-4 sentence summary
    // 4. Return structured result with hyperlink
  }
}
```

**Lookup sources by type:**
| Type | Primary Source | Fallback |
|------|---------------|----------|
| spell | Core DB → KB | 5e.tools |
| monster | Core DB → KB | 5e.tools |
| item | Core DB → KB | 5e.tools |
| rules | KB | Web search |
| lore | KB → WorldAnvil | Fandom wiki |
| general | KB | Web search |

### Phase 3: Main Agent Refactor

**Goal:** Replace Haiku classification with Sonnet orchestration

**Files to modify:**
- `src/services/discord/handlers/message.ts` - New message flow
- `src/services/ai/service.ts` - Add orchestration methods

**New flow:**
```
1. Message received
2. Load channel context (game system, recent messages, user memory)
3. Main Agent (Sonnet) analyzes with full context:
   - What is the user asking?
   - What game system is this about?
   - Do we need to look anything up?
   - What lookup type(s)?
4. If lookup needed:
   - Spawn Lookup Agent(s) with context
   - Receive summaries + links
5. Main Agent synthesizes response
6. Update channel context (topics, game system confidence)
7. Send response
```

**Main Agent system prompt additions:**
```
You are FumbleBot, a TTRPG assistant. You have access to lookup tools that
return summaries of rules, spells, monsters, and lore.

CURRENT CONTEXT:
- Game System: {activeSystem} (confidence: {systemConfidence})
- Campaign: {campaignSetting}
- Recent Topics: {recentTopics}

IMPORTANT:
- Only return results relevant to the current game system
- If system is unclear, ask for clarification
- Use lookup tools to get summaries, don't make up rules
- Always include hyperlinks to source material
```

### Phase 4: Direct Database Access

**Goal:** FumbleBot reads from Core's game database directly

**Option A: Core SDK with DB read access**
- Add `db.query()` method to Core SDK
- Core exposes read-only views for game data
- FumbleBot queries via SDK

**Option B: Replicated read database**
- Core syncs game data to FumbleBot's local DB
- FumbleBot has instant access
- Updates on schedule (hourly?)

**Recommendation:** Option A (SDK access) for now, Option B later for performance.

**New Core SDK methods:**
```typescript
// In @crit-fumble/core SDK
interface GameDataClient {
  spells: {
    search(query: string, system?: string): Promise<SpellSummary[]>;
    get(id: string): Promise<Spell>;
  };
  monsters: {
    search(query: string, system?: string): Promise<MonsterSummary[]>;
    get(id: string): Promise<Monster>;
  };
  items: {
    search(query: string, system?: string): Promise<ItemSummary[]>;
    get(id: string): Promise<Item>;
  };
  rules: {
    search(query: string, system?: string): Promise<RuleSummary[]>;
    get(id: string): Promise<Rule>;
  };
}
```

### Phase 5: Memory Integration

**Goal:** Remember game system preferences per channel/guild

**Use existing schema:**
- `UserMemory.facts` - Store user's preferred systems
- `ConversationSummary.keyTopics` - Track what was discussed
- New: `ChannelContext` in `GuildContext` table

**Memory triggers:**
- User explicitly sets system: Store as fact with high confidence
- AI infers system: Store with lower confidence
- Campaign linked: Store campaign + setting info

---

## Success Metrics

1. **Relevance:** <5% of lookups return wrong-system results
2. **Response quality:** Users get actionable summaries, not walls of text
3. **Speed:** Lookups complete in <3 seconds
4. **Context retention:** System correctly remembers game system across sessions

---

## Implementation Order

1. **Phase 1: Context Manager** (foundation for everything)
2. **Phase 2: Lookup Agents** (new lookup pattern)
3. **Phase 3: Main Agent Refactor** (orchestration)
4. **Phase 4: Direct DB Access** (performance)
5. **Phase 5: Memory Integration** (persistence)

Each phase is independently deployable and testable.

---

## FumbleBot's Requested Features (Mapped to Phases)

| Feature Request | Phase | Notes |
|----------------|-------|-------|
| Internal SQL DB access | Phase 4 | Core SDK with game data queries |
| Cached common queries | Phase 4 | Popular spells/features pre-cached |
| More game systems | Phase 1-2 | Context tracking + multi-system lookups |
| Complex dice expressions | Separate | Already in dice roller, may need enhancement |
| Initiative tracker | Separate | New tool, not part of this architecture |
| Statblock generation | Phase 2 | Lookup agent returns structured data |
| Campaign memory | Phase 5 | Channel context persistence |
| Character sheet access | Separate | WorldAnvil/Core integration |

---

## Next Steps

1. Start with Phase 1: Add `ChannelGameContext` to context manager
2. Create detection logic for game systems
3. Test with explicit system setting ("we're playing 5e")
4. Add inference logic for system-specific terms
