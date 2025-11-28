# WorldAnvil API HTTP Methods Guide

## Overview

This document describes the HTTP methods used by the WorldAnvil API (Boromir specification) and how they are implemented in the Crit-Fumble WorldAnvil package.

## HTTP Methods

The WorldAnvil API uses standard HTTP methods for operations:

- `GET`: Retrieve resources
- `POST`: Create new resources
- `PUT`: Replace/update resources completely
- `PATCH`: Update resources partially
- `DELETE`: Remove resources

## PATCH Method Implementation

As specified in the Boromir documentation, the PATCH method is used for partial updates to resources. This is particularly important for user and world entities.

### Key Usage Points

1. **Parameter Placement**: 
   - Resource ID should be in query parameters, not in the body
   - Update data should be in the request body

2. **Service Implementations**:
   - `WorldAnvilUserService.updateUser()`: Uses PATCH with userId as query parameter
   - `WorldAnvilWorldService.updateWorld()`: Uses PATCH with worldId as query parameter
   - `WorldAnvilSecretService.updateSecret()`: Uses PATCH with secretId as query parameter

### Client Implementation

In the `WorldAnvilApiClient`, the PATCH method is implemented as:

```typescript
async patch<T>(path: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
  try {
    const response = await this.axiosInstance.patch<T>(path, data, config);
    return response.data;
  } catch (error) {
    this.handleApiError(error);
    throw error;
  }
}
```

### Example Usage

```typescript
// Update a user
const updatedUser = await apiClient.patch('/user', 
  { displayName: 'New Display Name' },
  { params: { id: 'user-id' } }
);

// Update a world
const updatedWorld = await apiClient.patch('/world',
  { title: 'Updated World Title', description: 'New description' },
  { params: { id: 'world-id' } }
);
```

## Testing

When mocking the API client for tests, ensure the mock includes the `patch` method:

```typescript
const mockApiClient = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
  setApiKey: jest.fn(),
  setAccessToken: jest.fn()
};
```

Test expectations should verify that:
1. The correct HTTP method is called (patch)
2. The endpoint path is correct
3. The request body contains the update data
4. The query parameters include the resource ID

```typescript
// Example test verification
expect(mockApiClient.patch).toHaveBeenCalledWith('/user', 
  { displayName: 'New Name' }, 
  { params: { id: 'user-id' } }
);
```

## Common Issues

1. **Missing Patch in Mock Client**: When testing services that use PATCH, ensure the mock client includes a patch method.

2. **Incorrect Parameter Placement**: Resource IDs should be in query parameters, not the request body.

3. **API Alignment**: Service methods should match the HTTP methods required by the API specification.
