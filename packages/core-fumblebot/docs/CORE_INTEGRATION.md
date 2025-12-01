# Core Integration Guide

This guide explains how Core server should integrate with FumbleBot using this SDK.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                       Core Server                            │
│  (Source of Truth: Users, Campaigns, Characters, Rolls)     │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ @crit-fumble/core-fumblebot
                              │ (this SDK)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       FumbleBot                              │
│  (Assistant GM: AI, Discord Bot, VTT Bridge, Activities)    │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         ┌────────┐     ┌─────────┐     ┌──────────┐
         │Discord │     │ VTT     │     │ Browser  │
         │  Bot   │     │Platforms│     │Extension │
         └────────┘     └─────────┘     └──────────┘
```

## Data Ownership

**Core owns:**
- User accounts and authentication
- Campaign data
- Character sheets
- Roll history (permanent storage)
- VTT account linkage records
- Game session logs

**FumbleBot handles:**
- AI-powered responses
- Discord bot interactions
- VTT bridge communication
- Activity session management
- Real-time roll execution
- Voice transcription

## Setup

### 1. Install the SDK

```bash
npm install @crit-fumble/core-fumblebot
```

### 2. Configure Environment

```bash
# .env
FUMBLEBOT_API_URL=https://fumblebot.crit-fumble.com/api
FUMBLEBOT_API_KEY=your-server-api-key
```

### 3. Create Client Instance

```typescript
// lib/fumblebot.ts
import { createFumbleBotClient } from '@crit-fumble/core-fumblebot';

export const fumblebot = createFumbleBotClient({
  baseUrl: process.env.FUMBLEBOT_API_URL!,
  apiKey: process.env.FUMBLEBOT_API_KEY!,
  timeout: 30000,
});
```

## Common Integration Patterns

### Recording Rolls from VTT

When FumbleBot receives a roll from a VTT platform, it should relay to Core:

```typescript
// FumbleBot webhook handler
app.post('/webhook/vtt-roll', async (req, res) => {
  const { roll, vttAccount, gameLink } = req.body;

  // FumbleBot processes the roll, then Core stores it
  // Core should expose an endpoint for FumbleBot to call
});

// Core should provide a webhook for FumbleBot:
// POST /api/fumblebot/rolls - Store roll in database
```

### AI Chat with Context

```typescript
// In Core API route
import { fumblebot } from '@/lib/fumblebot';

export async function POST(req: Request) {
  const { message, campaignId, userId } = await req.json();

  // Fetch campaign context from Core's database
  const campaign = await db.campaign.findUnique({ where: { id: campaignId } });

  const response = await fumblebot.chat({
    messages: [{ role: 'user', content: message }],
    context: {
      userId,
      campaignId,
      gameSystem: campaign.gameSystem,
      metadata: {
        campaignName: campaign.name,
        setting: campaign.setting,
      },
    },
  });

  return Response.json(response);
}
```

### Syncing VTT Accounts

```typescript
// When user links their Roll20 account via browser extension
export async function linkVTTAccount(
  userId: string,
  platform: 'roll20' | 'dndbeyond' | 'foundry',
  platformData: { userId: string; username: string }
) {
  // 1. Store in Core's database
  const vttAccount = await db.vttAccount.create({
    data: {
      userId,
      platform,
      platformUserId: platformData.userId,
      platformUsername: platformData.username,
    },
  });

  // 2. Notify FumbleBot so it can set up VTT bridge
  await fumblebot.linkVTTAccount(
    userId,
    platform,
    platformData.userId,
    platformData.username
  );

  return vttAccount;
}
```

## Error Handling Best Practices

```typescript
import { FumbleBotError } from '@crit-fumble/core-fumblebot';

async function safeAIChat(messages: AIMessage[]) {
  try {
    return await fumblebot.chat({ messages });
  } catch (error) {
    if (error instanceof FumbleBotError) {
      // Log for monitoring
      logger.error('FumbleBot API error', {
        status: error.status,
        code: error.code,
        message: error.message,
      });

      // Handle specific cases
      if (error.isRateLimitError()) {
        // Queue for retry
        await retryQueue.add({ messages }, { delay: 60000 });
        return { content: 'FumbleBot is busy, your request has been queued.' };
      }

      if (error.isNetworkError()) {
        // FumbleBot might be down
        return { content: 'FumbleBot is temporarily unavailable.' };
      }
    }

    throw error;
  }
}
```

## Webhook Security

FumbleBot will call Core's webhooks. Verify the requests:

```typescript
// Core webhook handler
export async function POST(req: Request) {
  const signature = req.headers.get('X-FumbleBot-Signature');
  const body = await req.text();

  // Verify HMAC signature
  const expected = crypto
    .createHmac('sha256', process.env.FUMBLEBOT_WEBHOOK_SECRET!)
    .update(body)
    .digest('hex');

  if (signature !== expected) {
    return new Response('Invalid signature', { status: 401 });
  }

  // Process webhook...
}
```

## Health Monitoring

```typescript
// Health check endpoint that verifies FumbleBot connectivity
export async function GET() {
  try {
    const health = await fumblebot.health();
    return Response.json({
      status: 'healthy',
      fumblebot: health,
    });
  } catch {
    return Response.json({
      status: 'degraded',
      fumblebot: { status: 'unreachable' },
    }, { status: 503 });
  }
}
```
