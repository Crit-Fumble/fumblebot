# FumbleBot HTTP API Implementation Guide

This guide explains how to add an HTTP API to FumbleBot so it can receive chat messages from the Crit-Fumble website.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Crit-Fumble Website                      │
│                                                              │
│  User logs in with Discord OAuth                             │
│           ↓                                                  │
│  User sends chat message                                     │
│           ↓                                                  │
│  POST /api/fumblebot/chat                                    │
│    - Verifies user session                                   │
│    - Gets user's Discord ID from account                     │
│    - Forwards to FumbleBot with dual-factor auth             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ HTTP Request
                           │ Headers:
                           │   X-Bot-Secret: <shared secret>
                           │   X-Discord-User-Id: <user's Discord ID>
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                        FumbleBot                             │
│                                                              │
│  HTTP Server (Express/Fastify)                               │
│    - Validates X-Bot-Secret matches BOT_API_SECRET env       │
│    - Uses X-Discord-User-Id to identify user                 │
│    - Processes message through same AI/logic as Discord      │
│    - Returns response                                        │
│                                                              │
│  Discord.js Bot (existing)                                   │
│    - Continues handling Discord messages normally            │
│    - Shares user context/sessions with HTTP API              │
└─────────────────────────────────────────────────────────────┘
```

## Step 1: Add HTTP Server Dependencies

```bash
npm install express cors
npm install -D @types/express @types/cors
```

Or with Fastify (lighter weight):
```bash
npm install fastify @fastify/cors
```

## Step 2: Create HTTP Server Module

Create `src/http/server.ts`:

```typescript
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';

const app = express();

// Middleware
app.use(cors({
  origin: [
    'https://crit-fumble.com',
    'https://www.crit-fumble.com',
    'https://staging.crit-fumble.com',
    process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '',
  ].filter(Boolean),
  credentials: true,
}));
app.use(express.json());

// Auth middleware - validates dual-factor authentication
function validateAuth(req: Request, res: Response, next: NextFunction) {
  const botSecret = req.headers['x-bot-secret'];
  const discordUserId = req.headers['x-discord-user-id'];

  // Factor 1: Validate shared secret
  if (botSecret !== process.env.BOT_API_SECRET) {
    return res.status(401).json({ error: 'Invalid bot secret' });
  }

  // Factor 2: Require Discord user ID
  if (!discordUserId || typeof discordUserId !== 'string') {
    return res.status(401).json({ error: 'Missing Discord user ID' });
  }

  // Attach user info to request
  (req as any).discordUserId = discordUserId;
  next();
}

// Health check (no auth required)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Chat endpoint
app.post('/api/chat', validateAuth, async (req, res) => {
  try {
    const { message, sessionId, user } = req.body;
    const discordUserId = (req as any).discordUserId;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Process the message through your AI/chat logic
    // This should use the SAME logic as your Discord message handler
    const response = await processMessage({
      discordUserId,
      message,
      sessionId,
      userName: user?.name,
      source: 'web', // Distinguish from 'discord' if needed
    });

    res.json({
      response: response.text,
      sessionId: response.sessionId,
    });
  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get chat history
app.get('/api/chat/history', validateAuth, async (req, res) => {
  try {
    const discordUserId = (req as any).discordUserId;
    const sessionId = req.query.sessionId as string;

    const history = await getChatHistory({
      discordUserId,
      sessionId,
    });

    res.json({ messages: history });
  } catch (error) {
    console.error('History API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
const PORT = process.env.HTTP_PORT || 3001;

export function startHttpServer() {
  app.listen(PORT, () => {
    console.log(`FumbleBot HTTP API listening on port ${PORT}`);
  });
}

// Placeholder functions - implement with your actual logic
async function processMessage(params: {
  discordUserId: string;
  message: string;
  sessionId?: string;
  userName?: string;
  source: 'web' | 'discord';
}) {
  // TODO: Implement using your existing AI/chat logic
  // This should:
  // 1. Look up or create a session for this user
  // 2. Add the message to conversation history
  // 3. Send to your AI provider (Claude, OpenAI, etc.)
  // 4. Return the response

  return {
    text: `Echo: ${params.message}`,
    sessionId: params.sessionId || 'new-session-id',
  };
}

async function getChatHistory(params: {
  discordUserId: string;
  sessionId?: string;
}) {
  // TODO: Implement - fetch from your session storage
  return [];
}
```

## Step 3: Update Main Entry Point

In your main bot file (e.g., `src/index.ts`):

```typescript
import { Client, GatewayIntentBits } from 'discord.js';
import { startHttpServer } from './http/server';

// Existing Discord bot setup
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    // ... your existing intents
  ],
});

// Start Discord bot
client.login(process.env.DISCORD_TOKEN);

// Start HTTP server alongside Discord bot
startHttpServer();
```

## Step 4: Environment Variables

Add to your `.env`:

```env
# Shared secret with Crit-Fumble website (must match)
BOT_API_SECRET=your-secure-random-secret

# Port for HTTP API
HTTP_PORT=3001

# Your existing Discord bot token
DISCORD_TOKEN=...
```

## Step 5: Shared Session Management

To allow users to continue conversations across Discord and web, use a shared session store:

```typescript
// src/sessions/SessionManager.ts

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  source: 'web' | 'discord';
}

interface UserSession {
  discordUserId: string;
  messages: ChatMessage[];
  createdAt: Date;
  lastActivity: Date;
}

class SessionManager {
  private sessions: Map<string, UserSession> = new Map();

  getOrCreateSession(discordUserId: string): UserSession {
    let session = this.sessions.get(discordUserId);

    if (!session) {
      session = {
        discordUserId,
        messages: [],
        createdAt: new Date(),
        lastActivity: new Date(),
      };
      this.sessions.set(discordUserId, session);
    }

    session.lastActivity = new Date();
    return session;
  }

  addMessage(discordUserId: string, message: ChatMessage) {
    const session = this.getOrCreateSession(discordUserId);
    session.messages.push(message);

    // Keep only last N messages to prevent memory bloat
    if (session.messages.length > 50) {
      session.messages = session.messages.slice(-50);
    }
  }

  getHistory(discordUserId: string): ChatMessage[] {
    return this.getOrCreateSession(discordUserId).messages;
  }
}

export const sessionManager = new SessionManager();
```

## Step 6: Deployment Considerations

### Option A: Same Process (Simple)
Run HTTP server in the same process as Discord bot. Good for small deployments.

### Option B: Separate Processes
Run HTTP server separately for better scaling:
- Discord bot: Handles Discord events
- HTTP API: Handles web requests
- Share state via Redis or database

### Exposing the API

For production, you'll need to expose the HTTP API publicly. Options:

1. **Separate subdomain**: `api.fumblebot.yourhost.com`
2. **Same host, different port**: Use a reverse proxy (nginx/caddy)
3. **Cloud Functions**: Deploy the HTTP handler as a serverless function

Example nginx config:
```nginx
server {
    listen 443 ssl;
    server_name api.fumblebot.example.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Step 7: Testing

Test the API locally:

```bash
# Health check
curl http://localhost:3001/api/health

# Send a chat message (with auth headers)
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -H "X-Bot-Secret: your-secret" \
  -H "X-Discord-User-Id: 123456789" \
  -d '{"message": "Hello FumbleBot!", "sessionId": "test-session"}'
```

## Security Notes

1. **BOT_API_SECRET** must be a strong, random string (32+ characters)
2. **Never expose** BOT_API_SECRET in client-side code
3. **Rate limit** the HTTP API to prevent abuse
4. **Validate** all input data
5. **Log** authentication failures for monitoring

## Website Environment Variable

The website needs to know where to reach FumbleBot. Add to Vercel:

```
FUMBLEBOT_API_URL=https://api.fumblebot.yourhost.com
```

The website already has `BOT_API_SECRET` configured.
