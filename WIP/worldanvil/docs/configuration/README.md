# WorldAnvil Package Configuration

This document describes how to configure the WorldAnvil package in your host application.

## Overview

The WorldAnvil package provides a configuration system that allows:

1. Programmatically setting configuration from the host application
2. Dependency injection for easier testing

## Configuration Options

The main configuration interface is `WorldAnvilConfig`:

```typescript
interface WorldAnvilConfig {
  /**
   * World Anvil API URL
   */
  apiUrl: string;
  
  /**
   * World Anvil API Key
   */
  apiKey: string;
  
  /**
   * Optional access token for authenticated requests
   */
  accessToken?: string;
}
```


## Host Application Configuration

In your host application, you can configure the WorldAnvil package using the `setWorldAnvilConfig` function:

```typescript
import { setWorldAnvilConfig } from '@crit-fumble/worldanvil/server/configs';

// Set configuration
setWorldAnvilConfig({
  apiUrl: 'https://www.worldanvil.com/api/v1', // Required
  apiKey: 'your-api-key',                      // Required
  accessToken: 'user-access-token'             // Optional
});
```

The configuration is stored in a singleton and will be used by all WorldAnvil services and clients throughout your application.

After setting the configuration, you can use the services directly:

```typescript
import { WorldAnvilUserService, WorldAnvilWorldService, WorldAnvilIdentityService } from '@crit-fumble/worldanvil/server/services';

const userService = new WorldAnvilUserService();
const worldService = new WorldAnvilWorldService();
const identityService = new WorldAnvilIdentityService();

// Use the services...
```

## Dependency Injection for Testing

For easier testing, all WorldAnvil services support dependency injection:

### Client-level Injection

```typescript
import { WorldAnvilApiClient, IWorldAnvilHttpClient } from '@crit-fumble/worldanvil/server/clients';

// Create a mock HTTP client for testing
const mockHttpClient: IWorldAnvilHttpClient = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn()
};

// Inject the mock client
const client = new WorldAnvilApiClient({
  apiKey: 'test-key',
  apiUrl: 'https://test-api.worldanvil.com'
}, mockHttpClient);
```

### Service-level Injection

```typescript
import { WorldAnvilUserService } from '@crit-fumble/worldanvil/server/services';
import { WorldAnvilApiClient } from '@crit-fumble/worldanvil/server/clients';

// Mock the client
const mockClient = jest.fn<WorldAnvilApiClient>(() => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  setApiKey: jest.fn(),
  setAccessToken: jest.fn()
}))();

// Create service with mock client
const userService = new WorldAnvilUserService(mockClient);
```

## Testing Utilities

For test environments, a special utility function is provided to reset the configuration between tests:

```typescript
import { resetWorldAnvilConfigForTests } from '@crit-fumble/worldanvil/server/configs';

beforeEach(() => {
  // Reset the configuration to default values
  resetWorldAnvilConfigForTests();
});
```

This function will only work in test environments (when `process.env.NODE_ENV === 'test'`).

## Available Services

The package includes the following services:

- `WorldAnvilApiClient`: Low-level HTTP client for World Anvil API
- `WorldAnvilArticleService`: For article management and content
- `WorldAnvilAuthService`: For authentication and OAuth token management
- `WorldAnvilBlockService`: For content block operations
- `WorldAnvilBlockTemplateService`: For managing block templates
- `WorldAnvilCanvasService`: For canvas functionality
- `WorldAnvilCategoryService`: For category organization
- `WorldAnvilEntityService`: For entity management
- `WorldAnvilIdentityService`: For verifying user sessions and identity
- `WorldAnvilImageService`: For image upload and management
- `WorldAnvilItemService`: For item management
- `WorldAnvilManuscriptService`: For manuscript handling and writing tools
- `WorldAnvilMapService`: For maps and map pins management
- `WorldAnvilNotebookService`: For notebook operations
- `WorldAnvilRpgSystemService`: For accessing RPG system information
- `WorldAnvilSecretService`: For secret content management
- `WorldAnvilSubscriberGroupService`: For subscriber group management
- `WorldAnvilTimelineService`: For timeline operations
- `WorldAnvilUserService`: For user authentication and profile management
- `WorldAnvilVariableService`: For variable management
- `WorldAnvilWorldService`: For managing worlds and their content

### Manuscript Service

The `WorldAnvilManuscriptService` provides comprehensive tools for managing writing projects and manuscripts. It supports:

- Creating, updating, and deleting manuscripts
- Managing manuscript versions for tracking drafts
- Organizing content with parts and beats
- Adding bookmarks for quick navigation

Example usage:

```typescript
import { WorldAnvilManuscriptService } from '@crit-fumble/worldanvil';

// Create instance with default config
const manuscriptService = new WorldAnvilManuscriptService();

// Or with dependency injection for testing
const mockClient = /* your mock client */;
const testService = new WorldAnvilManuscriptService(mockClient);

// Set access token if not provided in constructor
manuscriptService.setAccessToken('user-access-token');

// Work with manuscripts and their components
const manuscripts = await manuscriptService.getManuscriptsByWorld('world-id');
```
