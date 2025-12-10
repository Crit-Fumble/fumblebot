/**
 * Foundry Container Handler Tests
 * Tests for Foundry VTT container management MCP tools
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create hoisted mocks
const { mockGetCoreClient, mockFoundry } = vi.hoisted(() => ({
  mockGetCoreClient: vi.fn(),
  mockFoundry: {
    createContainer: vi.fn(),
    listContainers: vi.fn(),
    listGuildContainers: vi.fn(),
    getContainer: vi.fn(),
    stopContainer: vi.fn(),
    listWorlds: vi.fn(),
    getWorld: vi.fn(),
    backupWorld: vi.fn(),
    listModules: vi.fn(),
    installModule: vi.fn(),
    uninstallModule: vi.fn(),
    listSystems: vi.fn(),
    listUsers: vi.fn(),
  },
}));

// Mock core-client
vi.mock('../../../src/lib/core-client.js', () => ({
  getCoreClient: mockGetCoreClient,
}));

// Import after mocks
import { FoundryContainerHandler } from '../../../src/mcp/handlers/foundry-container.js';

describe('FoundryContainerHandler', () => {
  let handler: FoundryContainerHandler;
  let mockCoreClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new FoundryContainerHandler();
    mockCoreClient = { foundry: mockFoundry };
    mockGetCoreClient.mockReturnValue(mockCoreClient);
  });

  describe('error handling', () => {
    it('should throw when Core API is not configured', async () => {
      mockGetCoreClient.mockImplementation(() => {
        throw new Error('Core API not configured');
      });

      await expect(handler.handle('foundry_list_containers', {})).rejects.toThrow(
        'Foundry Container management not available: Core API not configured'
      );
    });

    it('should throw for unknown tool names', async () => {
      await expect(handler.handle('unknown_tool', {})).rejects.toThrow(
        'Unknown Foundry container tool: unknown_tool'
      );
    });
  });

  describe('foundry_create_container', () => {
    it('should create container successfully', async () => {
      mockFoundry.createContainer.mockResolvedValue({
        container: {
          success: true,
          containerId: 'container-123',
          accessUrl: 'https://foundry.example.com',
          licenseSource: 'pool',
          port: 30000,
        },
      });

      const result = await handler.handle('foundry_create_container', {
        guildId: 'guild-1',
        campaignId: 'campaign-1',
        worldName: 'TestWorld',
      });

      expect(mockFoundry.createContainer).toHaveBeenCalledWith({
        guildId: 'guild-1',
        campaignId: 'campaign-1',
        worldName: 'TestWorld',
        foundryVersion: '12',
        maxIdleMinutes: 120,
      });
      expect(result.content[0].text).toContain('created successfully');
      expect(result.content[0].text).toContain('container-123');
      expect(result.isError).toBeUndefined();
    });

    it('should handle creation failure', async () => {
      mockFoundry.createContainer.mockResolvedValue({
        container: {
          success: false,
          error: 'License unavailable',
        },
      });

      const result = await handler.handle('foundry_create_container', {
        guildId: 'guild-1',
        campaignId: 'campaign-1',
        worldName: 'TestWorld',
      });

      expect(result.content[0].text).toContain('Failed to create');
      expect(result.content[0].text).toContain('License unavailable');
      expect(result.isError).toBe(true);
    });

    it('should use custom foundry version and idle time', async () => {
      mockFoundry.createContainer.mockResolvedValue({
        container: { success: true, containerId: 'c-1', accessUrl: '', licenseSource: 'user', port: 30001 },
      });

      await handler.handle('foundry_create_container', {
        guildId: 'guild-1',
        campaignId: 'campaign-1',
        worldName: 'TestWorld',
        foundryVersion: '11',
        maxIdleMinutes: 60,
      });

      expect(mockFoundry.createContainer).toHaveBeenCalledWith({
        guildId: 'guild-1',
        campaignId: 'campaign-1',
        worldName: 'TestWorld',
        foundryVersion: '11',
        maxIdleMinutes: 60,
      });
    });
  });

  describe('foundry_list_containers', () => {
    it('should list containers when found', async () => {
      mockFoundry.listContainers.mockResolvedValue({
        containers: [
          { id: '1', containerId: 'c-1', status: 'running', worldName: 'World1', foundryVersion: '12', guildId: 'g-1', startedAt: '2024-01-01', expiresAt: '2024-01-02' },
        ],
        total: 1,
      });

      const result = await handler.handle('foundry_list_containers', {});

      expect(result.content[0].text).toContain('Found 1 active container');
      expect(result.content[0].text).toContain('World1');
    });

    it('should handle no containers', async () => {
      mockFoundry.listContainers.mockResolvedValue({ containers: [], total: 0 });

      const result = await handler.handle('foundry_list_containers', {});

      expect(result.content[0].text).toContain('No active Foundry containers found');
    });
  });

  describe('foundry_list_guild_containers', () => {
    it('should list guild-specific containers', async () => {
      mockFoundry.listGuildContainers.mockResolvedValue({
        containers: [
          { id: '1', containerId: 'c-1', status: 'running', worldName: 'World1', ownerId: 'owner-1', startedAt: '2024-01-01' },
        ],
        total: 1,
      });

      const result = await handler.handle('foundry_list_guild_containers', { guildId: 'guild-1' });

      expect(mockFoundry.listGuildContainers).toHaveBeenCalledWith('guild-1');
      expect(result.content[0].text).toContain('Found 1 container(s) for guild guild-1');
    });

    it('should handle no guild containers', async () => {
      mockFoundry.listGuildContainers.mockResolvedValue({ containers: [], total: 0 });

      const result = await handler.handle('foundry_list_guild_containers', { guildId: 'guild-1' });

      expect(result.content[0].text).toContain('No active Foundry containers found for guild guild-1');
    });
  });

  describe('foundry_get_container', () => {
    it('should get container details', async () => {
      mockFoundry.getContainer.mockResolvedValue({
        container: {
          containerId: 'c-1',
          status: 'running',
          worldName: 'TestWorld',
          foundryVersion: '12',
          port: 30000,
          startedAt: '2024-01-01',
          expiresAt: '2024-01-02',
          maxIdleMinutes: 120,
          license: { status: 'active', userId: 'user-1' },
        },
      });

      const result = await handler.handle('foundry_get_container', { containerId: 'c-1' });

      expect(mockFoundry.getContainer).toHaveBeenCalledWith('c-1');
      expect(result.content[0].text).toContain('Container Details');
      expect(result.content[0].text).toContain('TestWorld');
      expect(result.content[0].text).toContain('running');
    });
  });

  describe('foundry_stop_container', () => {
    it('should stop container', async () => {
      mockFoundry.stopContainer.mockResolvedValue({ message: 'Container stopped successfully' });

      const result = await handler.handle('foundry_stop_container', { containerId: 'c-1' });

      expect(mockFoundry.stopContainer).toHaveBeenCalledWith('c-1');
      expect(result.content[0].text).toContain('Container stopped');
    });
  });

  describe('foundry_list_worlds', () => {
    it('should list worlds', async () => {
      mockFoundry.listWorlds.mockResolvedValue({
        worlds: [
          { id: 'w-1', title: 'MyWorld', system: 'dnd5e', lastPlayed: '2024-01-01' },
        ],
      });

      const result = await handler.handle('foundry_list_worlds', { containerId: 'c-1' });

      expect(mockFoundry.listWorlds).toHaveBeenCalledWith('c-1');
      expect(result.content[0].text).toContain('Found 1 world(s)');
      expect(result.content[0].text).toContain('MyWorld');
    });

    it('should handle no worlds', async () => {
      mockFoundry.listWorlds.mockResolvedValue({ worlds: [] });

      const result = await handler.handle('foundry_list_worlds', { containerId: 'c-1' });

      expect(result.content[0].text).toContain('No worlds found');
    });
  });

  describe('foundry_get_world', () => {
    it('should get world details', async () => {
      mockFoundry.getWorld.mockResolvedValue({
        world: {
          title: 'MyWorld',
          system: 'dnd5e',
          systemVersion: '3.0.0',
          coreVersion: '12.0.0',
          lastPlayed: '2024-01-01',
          actors: 50,
          items: 100,
          scenes: 10,
          journals: 20,
          tables: 5,
          playlists: 3,
          macros: 15,
          compendiumPacks: 8,
        },
      });

      const result = await handler.handle('foundry_get_world', { containerId: 'c-1', worldId: 'w-1' });

      expect(mockFoundry.getWorld).toHaveBeenCalledWith('c-1', 'w-1');
      expect(result.content[0].text).toContain('MyWorld');
      expect(result.content[0].text).toContain('dnd5e');
      expect(result.content[0].text).toContain('Actors: 50');
    });
  });

  describe('foundry_backup_world', () => {
    it('should backup world', async () => {
      mockFoundry.backupWorld.mockResolvedValue({
        backup: {
          worldTitle: 'MyWorld',
          filename: 'backup_2024-01-01.zip',
          size: 10240000,
          createdAt: '2024-01-01T12:00:00Z',
        },
      });

      const result = await handler.handle('foundry_backup_world', { containerId: 'c-1', worldId: 'w-1' });

      expect(mockFoundry.backupWorld).toHaveBeenCalledWith('c-1', 'w-1');
      expect(result.content[0].text).toContain('Backup created successfully');
      expect(result.content[0].text).toContain('MyWorld');
      expect(result.content[0].text).toContain('10000 KB');
    });
  });

  describe('foundry_list_modules', () => {
    it('should list modules', async () => {
      mockFoundry.listModules.mockResolvedValue({
        modules: [
          { id: 'module-1', title: 'Module One', version: '1.0.0', active: true },
          { id: 'module-2', title: 'Module Two', version: '2.0.0', active: false },
        ],
      });

      const result = await handler.handle('foundry_list_modules', { containerId: 'c-1' });

      expect(mockFoundry.listModules).toHaveBeenCalledWith('c-1');
      expect(result.content[0].text).toContain('Found 2 module(s) (1 active)');
    });

    it('should handle no modules', async () => {
      mockFoundry.listModules.mockResolvedValue({ modules: [] });

      const result = await handler.handle('foundry_list_modules', { containerId: 'c-1' });

      expect(result.content[0].text).toContain('No modules installed');
    });
  });

  describe('foundry_install_module', () => {
    it('should install module successfully', async () => {
      mockFoundry.installModule.mockResolvedValue({
        success: true,
        module: { id: 'cool-module', title: 'Cool Module', version: '1.0.0', author: 'Author Name' },
      });

      const result = await handler.handle('foundry_install_module', {
        containerId: 'c-1',
        manifestUrl: 'https://example.com/module.json',
      });

      expect(mockFoundry.installModule).toHaveBeenCalledWith('c-1', 'https://example.com/module.json');
      expect(result.content[0].text).toContain('installed successfully');
      expect(result.content[0].text).toContain('Cool Module');
    });

    it('should handle installation failure', async () => {
      mockFoundry.installModule.mockResolvedValue({ success: false });

      const result = await handler.handle('foundry_install_module', {
        containerId: 'c-1',
        manifestUrl: 'https://example.com/bad-module.json',
      });

      expect(result.content[0].text).toContain('Failed to install module');
      expect(result.isError).toBe(true);
    });
  });

  describe('foundry_uninstall_module', () => {
    it('should uninstall module successfully', async () => {
      mockFoundry.uninstallModule.mockResolvedValue({ success: true });

      const result = await handler.handle('foundry_uninstall_module', {
        containerId: 'c-1',
        moduleId: 'old-module',
      });

      expect(mockFoundry.uninstallModule).toHaveBeenCalledWith('c-1', 'old-module');
      expect(result.content[0].text).toContain('uninstalled successfully');
    });

    it('should handle uninstallation failure', async () => {
      mockFoundry.uninstallModule.mockResolvedValue({ success: false });

      const result = await handler.handle('foundry_uninstall_module', {
        containerId: 'c-1',
        moduleId: 'stuck-module',
      });

      expect(result.content[0].text).toContain('Failed to uninstall');
      expect(result.isError).toBe(true);
    });
  });

  describe('foundry_list_systems', () => {
    it('should list game systems', async () => {
      mockFoundry.listSystems.mockResolvedValue({
        systems: [
          { id: 'dnd5e', title: 'D&D 5th Edition', version: '3.0.0' },
          { id: 'pf2e', title: 'Pathfinder 2e', version: '5.0.0' },
        ],
      });

      const result = await handler.handle('foundry_list_systems', { containerId: 'c-1' });

      expect(mockFoundry.listSystems).toHaveBeenCalledWith('c-1');
      expect(result.content[0].text).toContain('Found 2 game system(s)');
      expect(result.content[0].text).toContain('dnd5e');
    });

    it('should handle no systems', async () => {
      mockFoundry.listSystems.mockResolvedValue({ systems: [] });

      const result = await handler.handle('foundry_list_systems', { containerId: 'c-1' });

      expect(result.content[0].text).toContain('No game systems installed');
    });
  });

  describe('foundry_list_users', () => {
    it('should list users with role names', async () => {
      mockFoundry.listUsers.mockResolvedValue({
        users: [
          { id: 'u-1', name: 'GameMaster', role: 4, character: null },
          { id: 'u-2', name: 'Player1', role: 1, character: 'Thorgrim' },
        ],
      });

      const result = await handler.handle('foundry_list_users', { containerId: 'c-1' });

      expect(mockFoundry.listUsers).toHaveBeenCalledWith('c-1');
      expect(result.content[0].text).toContain('Found 2 user(s)');
      expect(result.content[0].text).toContain('Gamemaster');
      expect(result.content[0].text).toContain('Player');
    });

    it('should handle no users', async () => {
      mockFoundry.listUsers.mockResolvedValue({ users: [] });

      const result = await handler.handle('foundry_list_users', { containerId: 'c-1' });

      expect(result.content[0].text).toContain('No users found');
    });
  });
});
