# Data Flow Architecture

This document describes how data flows between Core, FumbleBot, and connected platforms.

## Core as Source of Truth

Core server owns all persistent data. FumbleBot is a service layer that:
- Processes requests
- Interfaces with external platforms
- Provides AI capabilities
- Reports back to Core for storage

```
┌──────────────────────────────────────────────────────────────────────┐
│                            Core Server                                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │
│  │   Users     │ │  Campaigns  │ │ Characters  │ │    Rolls    │    │
│  │  Database   │ │  Database   │ │  Database   │ │  Database   │    │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │  @crit-fumble/        │
                    │  core-fumblebot SDK   │
                    └───────────┬───────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                           FumbleBot                                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │
│  │ Discord Bot │ │ AI Service  │ │ VTT Bridge  │ │ Activities  │    │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
        │                   │                │               │
        ▼                   ▼                ▼               ▼
   ┌─────────┐        ┌─────────┐      ┌─────────┐    ┌─────────────┐
   │ Discord │        │ OpenAI/ │      │  Roll20 │    │   Discord   │
   │   API   │        │Anthropic│      │D&DBeyond│    │ Activities  │
   └─────────┘        └─────────┘      │ Foundry │    └─────────────┘
                                       └─────────┘
```

## Flow: Dice Roll from Discord

```
User types: /roll 2d20kh1+5 "Attack"
                │
                ▼
┌─────────────────────────────┐
│      Discord Gateway        │
│  (FumbleBot receives cmd)   │
└─────────────────────────────┘
                │
                ▼
┌─────────────────────────────┐
│     FumbleBot Bot Service   │
│  1. Parse dice notation     │
│  2. Execute roll            │
│  3. Format response         │
└─────────────────────────────┘
                │
        ┌───────┴───────┐
        ▼               ▼
┌───────────────┐ ┌─────────────────┐
│ Send Discord  │ │ Report to Core  │
│ Response      │ │ POST /rolls     │
└───────────────┘ └─────────────────┘
                          │
                          ▼
                  ┌─────────────────┐
                  │ Core stores in  │
                  │ Roll database   │
                  └─────────────────┘
```

## Flow: Dice Roll from VTT (Roll20)

```
User rolls in Roll20 game
                │
                ▼
┌─────────────────────────────┐
│   Browser Extension         │
│   (Content Script)          │
│   Detects roll in chat      │
└─────────────────────────────┘
                │
                ▼
┌─────────────────────────────┐
│     FumbleBot VTT Bridge    │
│  1. Receive roll via SSE    │
│  2. Parse Roll20 format     │
│  3. Convert to standard     │
└─────────────────────────────┘
                │
        ┌───────┴───────┐
        ▼               ▼
┌───────────────┐ ┌─────────────────┐
│ Relay to      │ │ Report to Core  │
│ Discord       │ │ POST /rolls     │
└───────────────┘ └─────────────────┘
                          │
                          ▼
                  ┌─────────────────┐
                  │ Core stores in  │
                  │ Roll database   │
                  │ Links to VTT    │
                  │ game session    │
                  └─────────────────┘
```

## Flow: AI Chat Request

```
User asks AI a question
                │
                ▼
┌─────────────────────────────┐
│     Core API Endpoint       │
│  1. Fetch campaign context  │
│  2. Fetch character data    │
│  3. Build context object    │
└─────────────────────────────┘
                │
                ▼
┌─────────────────────────────┐
│   FumbleBot via SDK         │
│   fumblebot.chat({          │
│     messages: [...],        │
│     context: {...}          │
│   })                        │
└─────────────────────────────┘
                │
                ▼
┌─────────────────────────────┐
│     FumbleBot AI Service    │
│  1. Add system prompts      │
│  2. Include game context    │
│  3. Call OpenAI/Anthropic   │
│  4. Track token usage       │
└─────────────────────────────┘
                │
                ▼
┌─────────────────────────────┐
│   Response to Core          │
│   {                         │
│     content: "...",         │
│     model: "gpt-4",         │
│     usage: {...}            │
│   }                         │
└─────────────────────────────┘
                │
                ▼
┌─────────────────────────────┐
│     Core Processes          │
│  1. Log token usage         │
│  2. Store conversation      │
│  3. Return to user          │
└─────────────────────────────┘
```

## Flow: VTT Account Linking

```
User clicks "Link Roll20" in web app
                │
                ▼
┌─────────────────────────────┐
│     Core Web App            │
│  Shows browser extension    │
│  install prompt             │
└─────────────────────────────┘
                │
                ▼
┌─────────────────────────────┐
│   Browser Extension         │
│  1. User logs into Roll20   │
│  2. Extension detects auth  │
│  3. Extracts player ID      │
└─────────────────────────────┘
                │
                ▼
┌─────────────────────────────┐
│     FumbleBot API           │
│  POST /vtt/accounts/link    │
│  with encrypted credentials │
└─────────────────────────────┘
                │
                ▼
┌─────────────────────────────┐
│     Core via Webhook        │
│  1. Verify user owns acct   │
│  2. Store VTT account link  │
│  3. Enable sync features    │
└─────────────────────────────┘
```

## Flow: Bidirectional Chat Sync

```
Message sent in Discord #campaign-chat
                │
                ▼
┌─────────────────────────────┐
│     FumbleBot Bot           │
│  1. Check for game link     │
│  2. Format for VTT          │
└─────────────────────────────┘
                │
                ▼
┌─────────────────────────────┐
│     Push to Extension       │
│  via Server-Sent Events     │
└─────────────────────────────┘
                │
                ▼
┌─────────────────────────────┐
│   Browser Extension         │
│  Injects message into       │
│  Roll20 chat                │
└─────────────────────────────┘

────────────────────────────────────────

Message sent in Roll20 chat
                │
                ▼
┌─────────────────────────────┐
│   Browser Extension         │
│  Detects new message        │
└─────────────────────────────┘
                │
                ▼
┌─────────────────────────────┐
│     FumbleBot VTT Bridge    │
│  POST /vtt/chat             │
└─────────────────────────────┘
                │
                ▼
┌─────────────────────────────┐
│     FumbleBot Bot           │
│  Sends to Discord channel   │
│  via linked game            │
└─────────────────────────────┘
```

## Data Stored by Each System

### Core Server Stores:
- User accounts (Discord OAuth)
- VTT account links
- Campaign data
- Character sheets
- Roll history (permanent)
- AI conversation logs
- Token usage tracking
- Game session records

### FumbleBot Stores:
- Active session state (temporary)
- Rate limiting counters
- AI conversation cache (short-term)
- Extension connection state
- Nothing persistent that Core doesn't also have

### Browser Extension Stores:
- Auth tokens (secure storage)
- User preferences
- VTT connection state
- Nothing sensitive or permanent

## Security Considerations

1. **API Keys**: Core uses a dedicated API key to communicate with FumbleBot
2. **Webhooks**: FumbleBot signs webhooks to Core with HMAC
3. **Extension**: Uses OAuth, never stores passwords
4. **Data**: Sensitive data stays in Core, FumbleBot processes but doesn't persist
5. **Tokens**: AI API keys only in FumbleBot, never exposed to clients
