/**
 * Channel KB Controller Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Request, Response } from 'express';

// Hoist mocks before any imports
const { mockPrisma, mockKbClient } = vi.hoisted(() => ({
  mockPrisma: {
    channelKBSource: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
  mockKbClient: {
    ingestDocuments: vi.fn(),
    deleteSource: vi.fn(),
  },
}));

vi.mock('../../../src/services/db/client.js', () => ({
  getPrisma: () => mockPrisma,
}));

vi.mock('../../../src/services/discord/index.js', () => ({
  getFumbleBotClient: vi.fn(),
}));

vi.mock('../../../src/lib/knowledge-base-client.js', () => ({
  isKnowledgeBaseConfigured: vi.fn(() => true),
  getKnowledgeBaseClient: vi.fn(() => mockKbClient),
}));

import * as channelKbController from '../../../src/controllers/channel-kb.js';
import * as kbClient from '../../../src/lib/knowledge-base-client.js';

describe('Channel KB Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRequest = {
      params: {},
      query: {},
      body: {},
      session: {
        user: {
          discordId: 'user-123',
          username: 'TestUser',
        },
      } as any,
    };

    mockResponse = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    };

    vi.mocked(kbClient.isKnowledgeBaseConfigured).mockReturnValue(true);
    vi.mocked(kbClient.getKnowledgeBaseClient).mockReturnValue(mockKbClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('handleListChannelKBSources', () => {
    it('should list all sources for a guild', async () => {
      const mockSources = [
        {
          id: 'source-1',
          guildId: 'guild-123',
          channelId: 'channel-1',
          channelName: 'house-rules',
          channelType: 'text',
          name: 'House Rules',
          description: 'Our custom rules',
          category: 'rules',
          syncEnabled: true,
          syncThreads: true,
          syncPinned: true,
          maxMessages: 100,
          createdBy: 'user-123',
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSyncAt: new Date(),
          lastSyncStatus: 'success',
          lastSyncError: null,
        },
      ];

      mockPrisma.channelKBSource.findMany.mockResolvedValue(mockSources);

      mockRequest.params = { guildId: 'guild-123' };

      await channelKbController.handleListChannelKBSources(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockPrisma.channelKBSource.findMany).toHaveBeenCalledWith({
        where: { guildId: 'guild-123' },
        orderBy: [{ channelType: 'asc' }, { name: 'asc' }],
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        sources: mockSources,
        count: 1,
      });
    });

    it('should filter by enabled status', async () => {
      mockPrisma.channelKBSource.findMany.mockResolvedValue([]);

      mockRequest.params = { guildId: 'guild-123' };
      mockRequest.query = { enabled: 'true' };

      await channelKbController.handleListChannelKBSources(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockPrisma.channelKBSource.findMany).toHaveBeenCalledWith({
        where: { guildId: 'guild-123', syncEnabled: true },
        orderBy: [{ channelType: 'asc' }, { name: 'asc' }],
      });
    });

    it('should handle errors', async () => {
      mockPrisma.channelKBSource.findMany.mockRejectedValue(new Error('Database error'));

      mockRequest.params = { guildId: 'guild-123' };

      await channelKbController.handleListChannelKBSources(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Failed to list channel KB sources',
      });
    });
  });

  describe('handleGetChannelKBSource', () => {
    it('should retrieve a specific source', async () => {
      const mockSource = {
        id: 'source-1',
        guildId: 'guild-123',
        channelId: 'channel-1',
        name: 'House Rules',
      };

      mockPrisma.channelKBSource.findFirst.mockResolvedValue(mockSource);

      mockRequest.params = { guildId: 'guild-123', id: 'source-1' };

      await channelKbController.handleGetChannelKBSource(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockPrisma.channelKBSource.findFirst).toHaveBeenCalledWith({
        where: { id: 'source-1', guildId: 'guild-123' },
      });

      expect(mockResponse.json).toHaveBeenCalledWith(mockSource);
    });

    it('should return 404 if source not found', async () => {
      mockPrisma.channelKBSource.findFirst.mockResolvedValue(null);

      mockRequest.params = { guildId: 'guild-123', id: 'source-1' };

      await channelKbController.handleGetChannelKBSource(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Channel KB source not found',
      });
    });
  });

  describe('handleCreateChannelKBSource', () => {
    it('should create a new source', async () => {
      const newSource = {
        channelId: 'channel-1',
        channelName: 'house-rules',
        channelType: 'text',
        name: 'House Rules',
        description: 'Our custom rules',
        category: 'rules',
        syncEnabled: true,
        syncThreads: true,
        syncPinned: true,
        maxMessages: 100,
      };

      const createdSource = {
        id: 'source-1',
        ...newSource,
        guildId: 'guild-123',
        createdBy: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSyncAt: null,
        lastSyncStatus: null,
        lastSyncError: null,
      };

      mockPrisma.channelKBSource.findFirst.mockResolvedValue(null); // No existing
      mockPrisma.channelKBSource.create.mockResolvedValue(createdSource);

      mockRequest.params = { guildId: 'guild-123' };
      mockRequest.body = newSource;

      await channelKbController.handleCreateChannelKBSource(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockPrisma.channelKBSource.create).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(createdSource);
    });

    it('should reject if channel already configured', async () => {
      mockPrisma.channelKBSource.findFirst.mockResolvedValue({
        id: 'existing-1',
        channelId: 'channel-1',
      });

      mockRequest.params = { guildId: 'guild-123' };
      mockRequest.body = {
        channelId: 'channel-1',
        name: 'Test',
      };

      await channelKbController.handleCreateChannelKBSource(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'This channel is already configured as a KB source',
      });
    });

    it('should validate request body', async () => {
      mockRequest.params = { guildId: 'guild-123' };
      mockRequest.body = {
        // Missing required fields
        channelId: '',
        name: '',
      };

      await channelKbController.handleCreateChannelKBSource(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid request',
        })
      );
    });

    it('should require authentication', async () => {
      mockRequest.session = undefined;

      mockRequest.params = { guildId: 'guild-123' };
      mockRequest.body = { channelId: 'channel-1', name: 'Test' };

      await channelKbController.handleCreateChannelKBSource(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Authentication required',
      });
    });
  });

  describe('handleUpdateChannelKBSource', () => {
    it('should update an existing source', async () => {
      const existingSource = {
        id: 'source-1',
        guildId: 'guild-123',
        name: 'Old Name',
      };

      const updatedSource = {
        ...existingSource,
        name: 'New Name',
      };

      mockPrisma.channelKBSource.findFirst.mockResolvedValue(existingSource);
      mockPrisma.channelKBSource.update.mockResolvedValue(updatedSource);

      mockRequest.params = { guildId: 'guild-123', id: 'source-1' };
      mockRequest.body = { name: 'New Name' };

      await channelKbController.handleUpdateChannelKBSource(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockPrisma.channelKBSource.update).toHaveBeenCalledWith({
        where: { id: 'source-1' },
        data: { name: 'New Name' },
      });

      expect(mockResponse.json).toHaveBeenCalledWith(updatedSource);
    });

    it('should return 404 if source not found', async () => {
      mockPrisma.channelKBSource.findFirst.mockResolvedValue(null);

      mockRequest.params = { guildId: 'guild-123', id: 'source-1' };
      mockRequest.body = { name: 'New Name' };

      await channelKbController.handleUpdateChannelKBSource(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  describe('handleDeleteChannelKBSource', () => {
    it('should delete a source and remove from KB', async () => {
      const existingSource = {
        id: 'source-1',
        guildId: 'guild-123',
      };

      mockPrisma.channelKBSource.findFirst.mockResolvedValue(existingSource);
      mockPrisma.channelKBSource.delete.mockResolvedValue(existingSource);
      mockKbClient.deleteSource.mockResolvedValue({
        success: true,
        deletedCount: 5,
      });

      mockRequest.params = { guildId: 'guild-123', id: 'source-1' };

      await channelKbController.handleDeleteChannelKBSource(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockPrisma.channelKBSource.delete).toHaveBeenCalledWith({
        where: { id: 'source-1' },
      });

      expect(mockKbClient.deleteSource).toHaveBeenCalledWith('source-1');

      expect(mockResponse.json).toHaveBeenCalledWith({
        deleted: true,
        id: 'source-1',
      });
    });

    it('should handle KB deletion errors gracefully', async () => {
      const existingSource = {
        id: 'source-1',
        guildId: 'guild-123',
      };

      mockPrisma.channelKBSource.findFirst.mockResolvedValue(existingSource);
      mockPrisma.channelKBSource.delete.mockResolvedValue(existingSource);
      mockKbClient.deleteSource.mockRejectedValue(new Error('KB error'));

      mockRequest.params = { guildId: 'guild-123', id: 'source-1' };

      await channelKbController.handleDeleteChannelKBSource(
        mockRequest as Request,
        mockResponse as Response
      );

      // Should still succeed even if KB deletion fails
      expect(mockResponse.json).toHaveBeenCalledWith({
        deleted: true,
        id: 'source-1',
      });
    });

    it('should work when KB is not configured', async () => {
      vi.mocked(kbClient.isKnowledgeBaseConfigured).mockReturnValue(false);

      const existingSource = {
        id: 'source-1',
        guildId: 'guild-123',
      };

      mockPrisma.channelKBSource.findFirst.mockResolvedValue(existingSource);
      mockPrisma.channelKBSource.delete.mockResolvedValue(existingSource);

      mockRequest.params = { guildId: 'guild-123', id: 'source-1' };

      await channelKbController.handleDeleteChannelKBSource(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockKbClient.deleteSource).not.toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        deleted: true,
        id: 'source-1',
      });
    });
  });
});
