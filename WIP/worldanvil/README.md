# @crit-fumble/worldanvil

A TypeScript client library for the World Anvil API (Boromir specification), designed for Crit-Fumble applications.

## Installation

```bash
npm install @crit-fumble/worldanvil
```

## Features

- TypeScript definitions for World Anvil API responses aligned with the Boromir specification
- HTTP client implementation for World Anvil API endpoints 
- User authentication and OAuth token management
- Type-safe API client with automatic error handling
- Comprehensive models for worlds, articles, maps, timelines, notes, markers, and more

## What's Included

- **WorldAnvilApiClient**: HTTP client for World Anvil API with OAuth support
- **TypeScript Models**: Complete type definitions for all World Anvil API responses
- **Configuration Support**: Environment-based configuration management

## Usage

### Configuration

Configure the package by setting up the client with your API credentials:

```typescript
import { WorldAnvilApiClient } from '@crit-fumble/worldanvil';

// Create client with configuration
const client = new WorldAnvilApiClient({
  apiUrl: 'https://www.worldanvil.com/api/aragorn',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  accessToken: 'your-access-token' // Optional
});
```

### Authentication

```typescript
// Generate authorization URL
const authUrl = client.getAuthorizationUrl('your-redirect-uri');
// Redirect user to authUrl

// After OAuth redirect, exchange code for tokens
const tokens = await client.getAccessToken('auth-code-from-redirect', 'your-redirect-uri');

// Set access token for authenticated requests
client.setAccessToken(tokens.access_token);
```

### API Operations

#### User Operations

```typescript
// Get current authenticated user
const currentUser = await client.getCurrentUser();
console.log(`Hello, ${currentUser.username}!`);

// Get user by ID or username
const userById = await client.getUserById('user-id');
const userByName = await client.getUserByUsername('username');
```

#### World Operations

```typescript
// Get worlds for the authenticated user
const myWorlds = await client.getMyWorlds();

// Get worlds by user ID
const userWorlds = await client.getWorldsByUser('user-id');

// Get world by ID or slug
const world = await client.getWorldById('world-id');
const worldBySlug = await client.getWorldBySlug('world-slug');
```

#### Article Operations

```typescript
// Get articles by world
const articles = await client.getArticlesByWorld('world-id');

// Get specific article
const article = await client.getArticleById('article-id');
```

#### Map Operations

```typescript
// Get maps for a world
const maps = await client.getMapsByWorld('world-id');

// Get map details
const map = await client.getMapById('map-id');

// Working with layers
const layers = await client.getLayersByMap('map-id');
const layer = await client.getLayerById('layer-id');

// Working with markers and marker types
const markerTypes = await client.getMarkerTypes();
const markerType = await client.getMarkerTypeById('marker-type-id');
const markers = await client.getMarkersByMap('map-id');
const marker = await client.getMarkerById('marker-id');

// Working with marker groups
const markerGroups = await client.getMarkerGroupsByMap('map-id');
const groupMarkers = await client.getMarkersByMarkerGroup('marker-group-id');
```

#### Notebook Operations

```typescript
// Working with notebooks
const notebooks = await client.getNotebooksByWorld('world-id');
const notebook = await client.getNotebookById('notebook-id');

// Working with note sections
const sections = await client.getNoteSectionsByNotebook('notebook-id');
const section = await client.getNoteSectionById('section-id');

// Working with notes
const notes = await client.getNotesByNoteSection('section-id');
const note = await client.getNoteById('note-id');
```

#### Timeline Operations

```typescript
// Get timelines for a world
const timelines = await client.getTimelinesByWorld('world-id');

// Get timeline details
const timeline = await client.getTimelineById('timeline-id');

// Working with timeline eras and events
const eras = await client.getErasByTimeline('timeline-id');
const events = await client.getEventsByTimeline('timeline-id');
```

## TypeScript Support

This package is written in TypeScript and includes comprehensive type definitions for all World Anvil API responses. Import types as needed:

```typescript
import type { 
  WorldAnvilUser, 
  WorldAnvilWorld, 
  WorldAnvilArticle,
  WorldAnvilMap,
  WorldAnvilTimeline 
} from '@crit-fumble/worldanvil';
```

## Error Handling

The client includes automatic error handling and throws typed errors:

```typescript
try {
  const user = await client.getCurrentUser();
} catch (error) {
  if (error instanceof WorldAnvilApiError) {
    console.error('API Error:', error.message, error.statusCode);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Configuration Models

The package includes configuration models for easy setup:

```typescript
import type { WorldAnvilConfig } from '@crit-fumble/worldanvil';

const config: WorldAnvilConfig = {
  apiUrl: 'https://www.worldanvil.com/api/aragorn',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret'
};
```

## License

MIT

## Contributing

This package is part of the Crit-Fumble ecosystem. For contribution guidelines, please see the main repository.
