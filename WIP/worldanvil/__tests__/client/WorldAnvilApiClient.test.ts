/**
 * Tests for WorldAnvilApiClient
 */

import axios from 'axios';
import { WorldAnvilApiClient } from '../../client/WorldAnvilApiClient';
import { WorldAnvilUser } from '../../models/WorldAnvilUser';
import { WorldAnvilWorld } from '../../models/WorldAnvilWorld';

// Mock axios
jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

describe('WorldAnvilApiClient', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock for axios.create
    mockAxios.create.mockReturnValue({
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      interceptors: {
        request: {
          use: jest.fn((callback) => {
            // Simulate the interceptor by immediately calling the callback
            callback({
              headers: {}
            });
            return null;
          })
        }
      }
    } as any);
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      const client = new WorldAnvilApiClient();
      
      expect(mockAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://www.worldanvil.com/api/v1',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }
      });
    });

    it('should initialize with custom API URL', () => {
      const client = new WorldAnvilApiClient({
        apiUrl: 'https://custom.worldanvil.com/api/v2'
      });
      
      expect(mockAxios.create).toHaveBeenCalledWith(expect.objectContaining({
        baseURL: 'https://custom.worldanvil.com/api/v2'
      }));
    });
    
    it('should initialize with API key and access token', () => {
      const requestUseSpy = jest.fn((callback) => {
        const request = { headers: {} as Record<string, string> };
        callback(request);
        
        // Verify headers were added
        expect(request.headers['x-application-key']).toBe('test-api-key');
        expect(request.headers['Authorization']).toBe('Bearer test-token');
        
        return null;
      });
      
      mockAxios.create.mockReturnValue({
        interceptors: {
          request: {
            use: requestUseSpy
          }
        }
      } as any);
      
      const client = new WorldAnvilApiClient({
        apiKey: 'test-api-key',
        accessToken: 'test-token'
      });
      
      expect(requestUseSpy).toHaveBeenCalled();
    });
  });
  
  describe('authentication methods', () => {
    it('should set API key', () => {
      // Setup a mock implementation for axios.create that captures the interceptor
      let capturedInterceptor: any = null;
      mockAxios.create.mockReturnValue({
        interceptors: {
          request: {
            use: (interceptor: any) => {
              capturedInterceptor = interceptor;
              return null;
            }
          }
        }
      } as any);
      
      // Create client and set API key
      const client = new WorldAnvilApiClient();
      client.setApiKey('new-api-key');
      
      // Now test the interceptor directly
      const mockRequest = { headers: {} as Record<string, string> };
      capturedInterceptor(mockRequest);
      
      // Verify header was set
      expect(mockRequest.headers['x-application-key']).toBe('new-api-key');
    });
    
    it('should set access token', () => {
      // Setup a mock implementation for axios.create that captures the interceptor
      let capturedInterceptor: any = null;
      mockAxios.create.mockReturnValue({
        interceptors: {
          request: {
            use: (interceptor: any) => {
              capturedInterceptor = interceptor;
              return null;
            }
          }
        }
      } as any);
      
      // Create client and set access token
      const client = new WorldAnvilApiClient();
      client.setAccessToken('new-access-token');
      
      // Now test the interceptor directly
      const mockRequest = { headers: {} as Record<string, string> };
      capturedInterceptor(mockRequest);
      
      // Verify header was set
      expect(mockRequest.headers['Authorization']).toBe('Bearer new-access-token');
    });
  });
  
  describe('HTTP methods', () => {
    let client: WorldAnvilApiClient;
    let mockGet: jest.Mock;
    let mockPost: jest.Mock;
    let mockPut: jest.Mock;
    let mockDelete: jest.Mock;
    
    beforeEach(() => {
      mockGet = jest.fn();
      mockPost = jest.fn();
      mockPut = jest.fn();
      mockDelete = jest.fn();
      
      mockAxios.create.mockReturnValue({
        get: mockGet,
        post: mockPost,
        put: mockPut,
        delete: mockDelete,
        interceptors: {
          request: {
            use: jest.fn()
          }
        }
      } as any);
      
      client = new WorldAnvilApiClient();
    });
    
    it('should make GET requests', async () => {
      const mockResponse = { data: { id: '123', name: 'Test' } };
      mockGet.mockResolvedValue(mockResponse);
      
      const result = await client.get('/test', { params: { query: 'value' } });
      
      expect(mockGet).toHaveBeenCalledWith('/test', { params: { query: 'value' } });
      expect(result).toEqual(mockResponse.data);
    });
    
    it('should make POST requests', async () => {
      const mockResponse = { data: { id: '123', created: true } };
      mockPost.mockResolvedValue(mockResponse);
      
      const payload = { name: 'Test' };
      const result = await client.post('/test', payload, { timeout: 5000 });
      
      expect(mockPost).toHaveBeenCalledWith('/test', payload, { timeout: 5000 });
      expect(result).toEqual(mockResponse.data);
    });
    
    it('should make PUT requests', async () => {
      const mockResponse = { data: { id: '123', updated: true } };
      mockPut.mockResolvedValue(mockResponse);
      
      const payload = { name: 'Updated Test' };
      const result = await client.put('/test/123', payload);
      
      expect(mockPut).toHaveBeenCalledWith('/test/123', payload, undefined);
      expect(result).toEqual(mockResponse.data);
    });
    
    it('should make DELETE requests', async () => {
      const mockResponse = { data: { deleted: true } };
      mockDelete.mockResolvedValue(mockResponse);
      
      const result = await client.delete('/test/123');
      
      expect(mockDelete).toHaveBeenCalledWith('/test/123', undefined);
      expect(result).toEqual(mockResponse.data);
    });
    
    it('should handle API errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const mockError = {
        isAxiosError: true,
        response: {
          status: 401,
          data: { error: 'Unauthorized' }
        }
      };
      
      mockGet.mockRejectedValue(mockError);
      mockAxios.isAxiosError.mockReturnValue(true);
      
      await expect(client.get('/test')).rejects.toEqual(mockError);
      
      expect(consoleSpy).toHaveBeenCalledWith('Authentication failed. Please check your API key and access token.');
      
      // Test different error codes
      mockError.response.status = 403;
      await expect(client.get('/test')).rejects.toEqual(mockError);
      expect(consoleSpy).toHaveBeenCalledWith('You do not have permission to access this resource.');
      
      mockError.response.status = 429;
      await expect(client.get('/test')).rejects.toEqual(mockError);
      expect(consoleSpy).toHaveBeenCalledWith('Rate limit exceeded. Please try again later.');
      
      mockError.response.status = 500;
      await expect(client.get('/test')).rejects.toEqual(mockError);
      expect(consoleSpy).toHaveBeenCalledWith('API Error (500):', { error: 'Unauthorized' });
      
      consoleSpy.mockRestore();
    });
  });
  
  describe('Domain-specific methods', () => {
    let client: WorldAnvilApiClient;
    let mockGet: jest.Mock;
    
    beforeEach(() => {
      mockGet = jest.fn();
      
      mockAxios.create.mockReturnValue({
        get: mockGet,
        interceptors: {
          request: {
            use: jest.fn()
          }
        }
      } as any);
      
      client = new WorldAnvilApiClient();
    });
    
    it('should get current user profile', async () => {
      const mockUser: WorldAnvilUser = {
        id: '123',
        username: 'testuser',
        display_name: 'Test User',
        avatar_url: 'https://worldanvil.com/uploads/users/avatar-123.jpg'
      };
      
      mockGet.mockResolvedValue({ data: mockUser });
      
      const result = await client.getCurrentUser();
      
      expect(mockGet).toHaveBeenCalledWith('/user', undefined);
      expect(result).toEqual(mockUser);
    });
    
    it('should get user worlds', async () => {
      const mockWorlds: WorldAnvilWorld[] = [
        {
          id: 'world1',
          title: 'Test World 1',
          slug: 'test-world-1',
          description: 'A test world',
          image_url: 'https://worldanvil.com/uploads/images/test-world-1.jpg'
        },
        {
          id: 'world2',
          title: 'Test World 2',
          slug: 'test-world-2',
          description: 'Another test world',
          image_url: 'https://worldanvil.com/uploads/images/test-world-2.jpg'
        }
      ];
      
      mockGet.mockResolvedValue({ data: mockWorlds });
      
      const result = await client.getMyWorlds();
      
      expect(mockGet).toHaveBeenCalledWith('/user/worlds', undefined);
      expect(result).toEqual(mockWorlds);
    });
    
    it('should get world by ID', async () => {
      const mockWorld: WorldAnvilWorld = {
        id: 'world1',
        title: 'Test World 1',
        slug: 'test-world-1',
        description: 'A test world',
        image_url: 'https://worldanvil.com/uploads/images/test-world-1.jpg'
      };
      
      mockGet.mockResolvedValue({ data: mockWorld });
      
      const result = await client.getWorldById('world1');
      
      expect(mockGet).toHaveBeenCalledWith('/world/world1', undefined);
      expect(result).toEqual(mockWorld);
    });
  });
});
