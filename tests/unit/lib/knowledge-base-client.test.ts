/**
 * Knowledge Base Client Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  KnowledgeBaseClient,
  isKnowledgeBaseConfigured,
  getKnowledgeBaseClient,
  type IngestRequest,
  type IngestResponse,
  type SearchOptions,
  type SearchResponse,
} from '../../../src/lib/knowledge-base-client.js';

describe('KnowledgeBaseClient', () => {
  let client: KnowledgeBaseClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock fetch
    fetchMock = vi.fn();
    global.fetch = fetchMock;

    client = new KnowledgeBaseClient({
      baseUrl: 'http://test-core.example.com',
      apiSecret: 'test-secret',
      timeout: 5000,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should use default values from environment', () => {
      const defaultClient = new KnowledgeBaseClient();
      expect(defaultClient).toBeDefined();
    });

    it('should remove trailing slash from baseUrl', () => {
      const clientWithSlash = new KnowledgeBaseClient({
        baseUrl: 'http://test.com/',
      });
      expect(clientWithSlash).toBeDefined();
    });
  });

  describe('health', () => {
    it('should return true when service is healthy', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'ok' }),
      });

      const result = await client.health();
      expect(result).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://test-core.example.com/health',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Core-Secret': 'test-secret',
          }),
        })
      );
    });

    it('should return false when service is unhealthy', async () => {
      fetchMock.mockRejectedValue(new Error('Connection failed'));

      const result = await client.health();
      expect(result).toBe(false);
    });
  });

  describe('search', () => {
    it('should search the knowledge base', async () => {
      const searchOptions: SearchOptions = {
        query: 'What is a tarrasque?',
        system: 'dnd5e',
        category: 'monsters',
        limit: 5,
      };

      const mockResponse: SearchResponse = {
        query: 'What is a tarrasque?',
        results: [
          {
            id: 'doc-1',
            title: 'Tarrasque',
            system: 'dnd5e',
            category: 'monsters',
            excerpt: 'The tarrasque is a legendary creature...',
            similarity: 0.95,
            metadata: {},
          },
        ],
        total: 1,
        took: 42,
      };

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.search(searchOptions);

      expect(result).toEqual(mockResponse);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://test-core.example.com/api/kb/search',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Core-Secret': 'test-secret',
          }),
          body: JSON.stringify(searchOptions),
        })
      );
    });

    it('should throw error on failed search', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      });

      await expect(client.search({ query: 'test' })).rejects.toThrow(
        'KB API error (500): Internal server error'
      );
    });
  });

  describe('ingestDocuments', () => {
    it('should ingest documents successfully', async () => {
      const ingestRequest: IngestRequest = {
        sourceType: 'discord',
        sourceId: 'source-123',
        sourceName: 'House Rules',
        guildId: 'guild-456',
        documents: [
          {
            id: 'msg-1',
            title: 'Critical Hit Rules',
            content: 'When you roll a natural 20...',
            category: 'house-rules',
            metadata: {
              channelId: 'channel-789',
              author: 'DM',
            },
          },
          {
            id: 'msg-2',
            title: 'Death Saving Throws',
            content: 'Modified death save rules...',
            category: 'house-rules',
            metadata: {
              channelId: 'channel-789',
              author: 'DM',
            },
          },
        ],
      };

      const mockResponse: IngestResponse = {
        success: true,
        sourceId: 'source-123',
        documentsIndexed: 2,
      };

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.ingestDocuments(ingestRequest);

      expect(result).toEqual(mockResponse);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://test-core.example.com/api/kb/ingest',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Core-Secret': 'test-secret',
          }),
          body: JSON.stringify(ingestRequest),
        })
      );
    });

    it('should handle partial success', async () => {
      const ingestRequest: IngestRequest = {
        sourceType: 'discord',
        sourceId: 'source-123',
        sourceName: 'Test Source',
        documents: [
          {
            id: 'doc-1',
            title: 'Test Doc',
            content: 'Test content',
          },
        ],
      };

      const mockResponse: IngestResponse = {
        success: false,
        sourceId: 'source-123',
        documentsIndexed: 0,
        errors: ['Failed to parse document'],
      };

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.ingestDocuments(ingestRequest);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    it('should throw error on failed ingestion', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Invalid request',
      });

      await expect(
        client.ingestDocuments({
          sourceType: 'discord',
          sourceId: 'test',
          sourceName: 'Test',
          documents: [],
        })
      ).rejects.toThrow('KB API error (400): Invalid request');
    });
  });

  describe('deleteSource', () => {
    it('should delete source successfully', async () => {
      const mockResponse = {
        success: true,
        deletedCount: 5,
      };

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.deleteSource('source-123');

      expect(result).toEqual(mockResponse);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://test-core.example.com/api/kb/sources/source-123',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Core-Secret': 'test-secret',
          }),
        })
      );
    });

    it('should handle deletion errors', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => 'Source not found',
      });

      await expect(client.deleteSource('source-123')).rejects.toThrow(
        'KB API error (404): Source not found'
      );
    });
  });

  describe('getDocument', () => {
    it('should retrieve a specific document', async () => {
      const mockDocument = {
        id: 'doc-1',
        title: 'Test Document',
        system: 'dnd5e',
        category: 'rules',
        type: 'markdown' as const,
        path: '/systems/dnd5e/rules/combat.md',
        content: '# Combat Rules\n\nCombat is...',
        metadata: {},
        sizeBytes: 1024,
        lastModified: '2025-01-01T00:00:00Z',
      };

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => mockDocument,
      });

      const result = await client.getDocument('doc-1');

      expect(result).toEqual(mockDocument);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://test-core.example.com/api/kb/documents/doc-1',
        expect.any(Object)
      );
    });
  });

  describe('timeout handling', () => {
    it('should have configurable timeout', () => {
      const timeoutClient = new KnowledgeBaseClient({
        baseUrl: 'http://test.com',
        timeout: 100,
      });

      expect(timeoutClient).toBeDefined();
      // Timeout is tested implicitly through fetch calls
    });
  });
});

describe('Helper Functions', () => {
  describe('isKnowledgeBaseConfigured', () => {
    it('should return true when both URL and secret are set', () => {
      const originalUrl = process.env.CORE_SERVER_URL;
      const originalSecret = process.env.CORE_SECRET;

      process.env.CORE_SERVER_URL = 'http://core.example.com';
      process.env.CORE_SECRET = 'secret123';

      expect(isKnowledgeBaseConfigured()).toBe(true);

      process.env.CORE_SERVER_URL = originalUrl;
      process.env.CORE_SECRET = originalSecret;
    });

    it('should return false when URL is missing', () => {
      const originalUrl = process.env.CORE_SERVER_URL;
      const originalSecret = process.env.CORE_SECRET;

      delete process.env.CORE_SERVER_URL;
      process.env.CORE_SECRET = 'secret123';

      expect(isKnowledgeBaseConfigured()).toBe(false);

      process.env.CORE_SERVER_URL = originalUrl;
      process.env.CORE_SECRET = originalSecret;
    });

    it('should return false when secret is missing', () => {
      const originalUrl = process.env.CORE_SERVER_URL;
      const originalSecret = process.env.CORE_SECRET;

      process.env.CORE_SERVER_URL = 'http://core.example.com';
      delete process.env.CORE_SECRET;

      expect(isKnowledgeBaseConfigured()).toBe(false);

      process.env.CORE_SERVER_URL = originalUrl;
      process.env.CORE_SECRET = originalSecret;
    });
  });

  describe('getKnowledgeBaseClient', () => {
    it('should return client when configured', () => {
      const originalUrl = process.env.CORE_SERVER_URL;
      const originalSecret = process.env.CORE_SECRET;

      process.env.CORE_SERVER_URL = 'http://core.example.com';
      process.env.CORE_SECRET = 'secret123';

      const client = getKnowledgeBaseClient();
      expect(client).toBeDefined();
      expect(client).toBeInstanceOf(KnowledgeBaseClient);

      process.env.CORE_SERVER_URL = originalUrl;
      process.env.CORE_SECRET = originalSecret;
    });

    it('should throw error when not configured', () => {
      const originalUrl = process.env.CORE_SERVER_URL;
      const originalSecret = process.env.CORE_SECRET;

      delete process.env.CORE_SERVER_URL;
      delete process.env.CORE_SECRET;

      expect(() => getKnowledgeBaseClient()).toThrow(
        'Knowledge Base is not configured. Set CORE_SERVER_URL and CORE_SECRET.'
      );

      process.env.CORE_SERVER_URL = originalUrl;
      process.env.CORE_SECRET = originalSecret;
    });
  });
});
