# @crit-fumble/core-fumblebot

FumbleBot SDK for Core server integration. Provides TypeScript types and an HTTP client for Core to communicate with FumbleBot's API.

## Installation

```bash
npm install @crit-fumble/core-fumblebot
```

## Quick Start

```typescript
import { createFumbleBotClient } from '@crit-fumble/core-fumblebot';

const fumblebot = createFumbleBotClient({
  baseUrl: process.env.FUMBLEBOT_API_URL,
  apiKey: process.env.FUMBLEBOT_API_KEY,
});

// Execute a dice roll
const result = await fumblebot.roll({
  notation: '2d20kh1+5',
  label: 'Attack Roll',
});

console.log(`Rolled ${result.total} (${result.isCrit ? 'CRIT!' : result.isFumble ? 'FUMBLE!' : 'normal'})`);
```

## Features

- **Dice Rolling** - Execute and track dice rolls with full notation support
- **AI Assistant** - Chat with FumbleBot's AI for rules lookup, NPC generation, etc.
- **VTT Integration** - Link VTT accounts (Roll20, D&D Beyond, Foundry) to Discord
- **Activities** - Manage Discord Activity sessions (dice roller, initiative tracker, etc.)
- **Voice Sessions** - Control voice-enabled AI assistant sessions

## API Reference

### Client Configuration

```typescript
interface FumbleBotClientConfig {
  baseUrl: string;     // FumbleBot API URL
  apiKey: string;      // Server-to-server API key
  timeout?: number;    // Request timeout (default: 30000ms)
}
```

### Dice Rolling

```typescript
// Roll dice
const result = await fumblebot.roll({
  notation: '4d6kh3',  // Roll 4d6, keep highest 3
  label: 'Ability Score',
  context: { userId: 'user123', guildId: 'guild456' },
});

// Get roll history
const history = await fumblebot.getRollHistory({
  userId: 'user123',
  limit: 10,
});
```

### AI Assistant

```typescript
// Chat with AI
const response = await fumblebot.chat({
  messages: [
    { role: 'user', content: 'How does grappling work in 5e?' }
  ],
  context: {
    gameSystem: 'dnd5e',
    userId: 'user123',
  },
});

// Lookup rules/lore
const lookup = await fumblebot.lookup({
  query: 'fireball spell',
  gameSystem: 'dnd5e',
});

// Generate NPC
const npc = await fumblebot.generateNPC({
  type: 'tavern keeper',
  setting: 'medieval fantasy',
  gameSystem: 'dnd5e',
});
```

### VTT Integration

```typescript
// Link VTT account
const account = await fumblebot.linkVTTAccount(
  'crit-user-123',
  'roll20',
  'roll20-player-id',
  'PlayerUsername'
);

// Create game link
const link = await fumblebot.createGameLink({
  platform: 'roll20',
  gameId: 'roll20-game-123',
  gameName: 'Curse of Strahd',
  guildId: 'discord-guild-123',
  channelId: 'discord-channel-456',
  syncChat: true,
  syncRolls: true,
  createdBy: 'user123',
});
```

### Error Handling

```typescript
import { FumbleBotError } from '@crit-fumble/core-fumblebot';

try {
  await fumblebot.roll({ notation: 'invalid' });
} catch (error) {
  if (error instanceof FumbleBotError) {
    if (error.isValidationError()) {
      console.error('Invalid dice notation:', error.message);
    } else if (error.isAuthError()) {
      console.error('Authentication failed');
    } else if (error.isRateLimitError()) {
      console.error('Rate limited, retry later');
    }
  }
}
```

## Types

Import types directly:

```typescript
import type {
  DiceRollResult,
  AIChatRequest,
  AIChatResponse,
  VTTAccount,
  VTTGameLink,
  Platform,
  CommandContext,
} from '@crit-fumble/core-fumblebot';
```

Or from the types subpath:

```typescript
import type { DiceRollResult } from '@crit-fumble/core-fumblebot/types';
```

## Documentation

See the [docs/](./docs/) directory for detailed integration guides:

- [Core Integration Guide](./docs/CORE_INTEGRATION.md) - How Core should use this SDK
- [API Endpoints](./docs/API_ENDPOINTS.md) - FumbleBot API endpoint reference
- [Data Flow](./docs/DATA_FLOW.md) - Architecture and data ownership

## License

Apache-2.0
