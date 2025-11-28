# WorldAnvilManuscriptService

The `WorldAnvilManuscriptService` provides a comprehensive interface for working with World Anvil's manuscript system, allowing you to create and manage writing projects, versions, parts, beats, and bookmarks.

## Initialization

```typescript
import { WorldAnvilManuscriptService } from '@crit-fumble/worldanvil';

// Basic initialization
const manuscriptService = new WorldAnvilManuscriptService();
manuscriptService.setAccessToken('user-access-token');

// With dependency injection for testing
import { WorldAnvilApiClient } from '@crit-fumble/worldanvil';
const mockClient = new WorldAnvilApiClient();
const testService = new WorldAnvilManuscriptService(mockClient);
```

## Manuscripts

Manuscripts are the top-level containers for writing projects.

### Get Manuscripts by World

Retrieves all manuscripts associated with a specific world.

```typescript
const manuscripts = await manuscriptService.getManuscriptsByWorld('world-id');
```

### Get Manuscript by ID

Retrieves a single manuscript by its ID with the specified granularity level (0-3).

```typescript
const manuscript = await manuscriptService.getManuscriptById('manuscript-id', '1');
```

### Create Manuscript

Creates a new manuscript in a world.

```typescript
const newManuscript = await manuscriptService.createManuscript({
  title: 'My New Novel',
  world: { id: 'world-id' }
});
```

### Update Manuscript

Updates an existing manuscript's properties.

```typescript
const updatedManuscript = await manuscriptService.updateManuscript({
  id: 'manuscript-id',
  title: 'Updated Novel Title'
});
```

### Delete Manuscript

Deletes a manuscript by ID.

```typescript
await manuscriptService.deleteManuscript('manuscript-id');
```

## Versions

Versions allow you to maintain different drafts of a manuscript.

### Get Versions by Manuscript

Retrieves all versions of a specific manuscript.

```typescript
const versions = await manuscriptService.getVersionsByManuscript('manuscript-id');
```

### Get Version by ID

Retrieves a specific version by its ID.

```typescript
const version = await manuscriptService.getManuscriptVersionById('version-id');
```

### Create Version

Creates a new version for a manuscript.

```typescript
const newVersion = await manuscriptService.createManuscriptVersion({
  title: 'First Draft',
  manuscript: { id: 'manuscript-id' }
});
```

### Update Version

Updates an existing version.

```typescript
const updatedVersion = await manuscriptService.updateManuscriptVersion({
  id: 'version-id',
  title: 'Revised First Draft'
});
```

### Delete Version

Deletes a version by ID.

```typescript
await manuscriptService.deleteManuscriptVersion('version-id');
```

## Parts

Parts allow you to organize a version into sections (like chapters).

### Get Parts by Version

Retrieves all parts belonging to a version.

```typescript
const parts = await manuscriptService.getPartsByVersion('version-id');
```

### Get Part by ID

Retrieves a specific part by its ID.

```typescript
const part = await manuscriptService.getManuscriptPartById('part-id');
```

### Create Part

Creates a new part in a version.

```typescript
const newPart = await manuscriptService.createManuscriptPart({
  title: 'Chapter 1',
  version: { id: 'version-id' }
});
```

### Update Part

Updates an existing part.

```typescript
const updatedPart = await manuscriptService.updateManuscriptPart({
  id: 'part-id',
  title: 'Chapter 1: The Beginning'
});
```

### Delete Part

Deletes a part by ID.

```typescript
await manuscriptService.deleteManuscriptPart('part-id');
```

## Beats

Beats are the smallest units of content within a part (like scenes).

### Get Beats by Part

Retrieves all beats belonging to a part.

```typescript
const beats = await manuscriptService.getBeatsByPart('part-id');
```

### Get Beat by ID

Retrieves a specific beat by its ID.

```typescript
const beat = await manuscriptService.getManuscriptBeatById('beat-id');
```

### Create Beat

Creates a new beat in a part.

```typescript
const newBeat = await manuscriptService.createManuscriptBeat({
  title: 'Introduction Scene',
  content: 'Scene content goes here...',
  part: { id: 'part-id' }
});
```

### Update Beat

Updates an existing beat.

```typescript
const updatedBeat = await manuscriptService.updateManuscriptBeat({
  id: 'beat-id',
  title: 'Introduction Scene - Revised',
  content: 'Updated scene content...'
});
```

### Delete Beat

Deletes a beat by ID.

```typescript
await manuscriptService.deleteManuscriptBeat('beat-id');
```

## Bookmarks

Bookmarks allow users to mark important locations within a manuscript.

### Get Bookmarks by Manuscript

Retrieves all bookmarks for a manuscript.

```typescript
const bookmarks = await manuscriptService.getBookmarksByManuscript('manuscript-id');
```

### Get Bookmark by ID

Retrieves a specific bookmark by its ID.

```typescript
const bookmark = await manuscriptService.getManuscriptBookmarkById('bookmark-id');
```

### Create Bookmark

Creates a new bookmark in a manuscript.

```typescript
const newBookmark = await manuscriptService.createManuscriptBookmark({
  title: 'Important Plot Point',
  manuscript: { id: 'manuscript-id' },
  beat: { id: 'beat-id' }
});
```

### Update Bookmark

Updates an existing bookmark.

```typescript
const updatedBookmark = await manuscriptService.updateManuscriptBookmark({
  id: 'bookmark-id',
  title: 'Crucial Plot Point'
});
```

### Delete Bookmark

Deletes a bookmark by ID.

```typescript
await manuscriptService.deleteManuscriptBookmark('bookmark-id');
```

## Response Types

Most methods in the manuscript service return objects with the following structure:

```typescript
interface Manuscript {
  id: string;
  title: string;
  slug?: string;
  world_id: string;
  user_id: string;
  created_at?: string;
  updated_at?: string;
  // Additional properties depending on granularity
}

interface ManuscriptVersion {
  id: string;
  title: string;
  manuscript: { id: string };
  created_at?: string;
  updated_at?: string;
}

interface ManuscriptPart {
  id: string;
  title: string;
  version: { id: string };
  position?: number;
  created_at?: string;
  updated_at?: string;
}

interface ManuscriptBeat {
  id: string;
  title: string;
  content: string;
  part: { id: string };
  position?: number;
  created_at?: string;
  updated_at?: string;
}

interface ManuscriptBookmark {
  id: string;
  title: string;
  manuscript: { id: string };
  beat?: { id: string };
  created_at?: string;
  updated_at?: string;
}
```

## Error Handling

The service throws typed errors for common failure scenarios:

```typescript
try {
  const manuscript = await manuscriptService.getManuscriptById('non-existent-id');
} catch (error) {
  if (error.code === 'ENTITY_NOT_FOUND') {
    console.log('Manuscript not found');
  } else if (error.code === 'UNAUTHORIZED') {
    console.log('Authentication required');
  } else {
    console.log('An unexpected error occurred:', error.message);
  }
}
```

## Testing

For testing, you can inject a mock API client:

```typescript
import { WorldAnvilManuscriptService } from '@crit-fumble/worldanvil';
import { jest } from '@jest/globals';

describe('ManuscriptService', () => {
  let mockClient;
  let service;
  
  beforeEach(() => {
    mockClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      setAccessToken: jest.fn()
    };
    
    service = new WorldAnvilManuscriptService(mockClient);
  });
  
  it('should get manuscript by ID', async () => {
    const mockResponse = { id: 'manuscript-1', title: 'Test Manuscript' };
    mockClient.get.mockResolvedValue(mockResponse);
    
    const result = await service.getManuscriptById('manuscript-1');
    
    expect(mockClient.get).toHaveBeenCalledWith('/manuscript/manuscript-1', { granularity: '0' });
    expect(result).toEqual(mockResponse);
  });
});
```
