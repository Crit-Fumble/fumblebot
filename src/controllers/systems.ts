/**
 * Foundry Systems Controller
 * CRUD API endpoints for managing Foundry VTT game systems
 */

import type { Request, Response } from 'express';
import { fetchAndParseManifest, isValidManifestUrl, SEED_MANIFESTS } from '../services/foundry/index.js';

// In-memory storage for now (will be replaced with Prisma)
// TODO: Replace with actual database queries once Prisma migration is run
interface StoredSystem {
  id: string;
  systemId: string;
  title: string;
  description?: string;
  version?: string;
  manifestUrl: string;
  compatibility?: {
    minimum?: string;
    verified?: string;
    maximum?: string;
  };
  authors?: Array<{ name: string; url?: string; email?: string; discord?: string }>;
  // FumbleBot settings
  iconUrl?: string;
  isEnabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// Temporary in-memory store
const systemsStore: Map<string, StoredSystem> = new Map();

/**
 * GET /api/systems
 * List all registered Foundry systems
 */
export async function handleListSystems(req: Request, res: Response): Promise<void> {
  try {
    const systems = Array.from(systemsStore.values()).sort((a, b) =>
      a.title.localeCompare(b.title)
    );

    res.json({
      systems,
      count: systems.length,
    });
  } catch (error) {
    console.error('[Systems] Error listing systems:', error);
    res.status(500).json({ error: 'Failed to list systems' });
  }
}

/**
 * GET /api/systems/:id
 * Get a specific system by ID
 */
export async function handleGetSystem(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const system = systemsStore.get(id);

    if (!system) {
      res.status(404).json({ error: 'System not found' });
      return;
    }

    res.json(system);
  } catch (error) {
    console.error('[Systems] Error getting system:', error);
    res.status(500).json({ error: 'Failed to get system' });
  }
}

/**
 * POST /api/systems
 * Add a new system from a manifest URL
 */
export async function handleAddSystem(req: Request, res: Response): Promise<void> {
  try {
    const { manifestUrl } = req.body;

    if (!manifestUrl || typeof manifestUrl !== 'string') {
      res.status(400).json({ error: 'manifestUrl is required' });
      return;
    }

    if (!isValidManifestUrl(manifestUrl)) {
      res.status(400).json({ error: 'Invalid manifest URL. Must be HTTPS and end in .json' });
      return;
    }

    // Check if already registered
    const existing = Array.from(systemsStore.values()).find(
      (s) => s.manifestUrl === manifestUrl
    );
    if (existing) {
      res.status(409).json({
        error: 'System already registered',
        system: existing,
      });
      return;
    }

    // Fetch and parse the manifest
    const manifest = await fetchAndParseManifest(manifestUrl);

    // Check if system ID already exists
    const existingBySystemId = Array.from(systemsStore.values()).find(
      (s) => s.systemId === manifest.systemId
    );
    if (existingBySystemId) {
      res.status(409).json({
        error: `System with ID "${manifest.systemId}" already registered`,
        system: existingBySystemId,
      });
      return;
    }

    // Create new system entry
    const id = `sys_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const newSystem: StoredSystem = {
      id,
      systemId: manifest.systemId,
      title: manifest.title,
      description: manifest.description,
      version: manifest.version,
      manifestUrl: manifest.manifestUrl,
      compatibility: manifest.compatibility,
      authors: manifest.authors,
      iconUrl: undefined,
      isEnabled: true,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    };

    systemsStore.set(id, newSystem);

    res.status(201).json(newSystem);
  } catch (error) {
    console.error('[Systems] Error adding system:', error);

    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to add system' });
    }
  }
}

/**
 * POST /api/systems/preview
 * Preview a system manifest without saving it
 */
export async function handlePreviewSystem(req: Request, res: Response): Promise<void> {
  try {
    const { manifestUrl } = req.body;

    if (!manifestUrl || typeof manifestUrl !== 'string') {
      res.status(400).json({ error: 'manifestUrl is required' });
      return;
    }

    if (!isValidManifestUrl(manifestUrl)) {
      res.status(400).json({ error: 'Invalid manifest URL. Must be HTTPS and end in .json' });
      return;
    }

    const manifest = await fetchAndParseManifest(manifestUrl);

    res.json({
      preview: true,
      ...manifest,
    });
  } catch (error) {
    console.error('[Systems] Error previewing system:', error);

    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to preview system' });
    }
  }
}

/**
 * DELETE /api/systems/:id
 * Remove a registered system
 */
export async function handleDeleteSystem(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const system = systemsStore.get(id);

    if (!system) {
      res.status(404).json({ error: 'System not found' });
      return;
    }

    // TODO: Check if system is in use by any campaigns
    // For now, just delete it

    systemsStore.delete(id);

    res.json({ deleted: true, id });
  } catch (error) {
    console.error('[Systems] Error deleting system:', error);
    res.status(500).json({ error: 'Failed to delete system' });
  }
}

/**
 * POST /api/systems/seed
 * Seed the systems store with popular systems
 * This is an admin-only operation
 */
export async function handleSeedSystems(req: Request, res: Response): Promise<void> {
  try {
    const results: Array<{ systemId: string; success: boolean; error?: string }> = [];

    for (const [systemId, manifestUrl] of Object.entries(SEED_MANIFESTS)) {
      try {
        // Skip if already exists
        const existing = Array.from(systemsStore.values()).find(
          (s) => s.systemId === systemId || s.manifestUrl === manifestUrl
        );
        if (existing) {
          results.push({ systemId, success: true, error: 'Already exists' });
          continue;
        }

        const manifest = await fetchAndParseManifest(manifestUrl);

        const id = `sys_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const now = new Date().toISOString();

        const newSystem: StoredSystem = {
          id,
          systemId: manifest.systemId,
          title: manifest.title,
          description: manifest.description,
          version: manifest.version,
          manifestUrl: manifest.manifestUrl,
          compatibility: manifest.compatibility,
          authors: manifest.authors,
          iconUrl: undefined,
          isEnabled: true,
          sortOrder: 0,
          createdAt: now,
          updatedAt: now,
        };

        systemsStore.set(id, newSystem);
        results.push({ systemId, success: true });
      } catch (error) {
        results.push({
          systemId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    res.json({
      seeded: results.filter((r) => r.success && !r.error?.includes('Already')).length,
      skipped: results.filter((r) => r.error?.includes('Already')).length,
      failed: results.filter((r) => !r.success).length,
      results,
    });
  } catch (error) {
    console.error('[Systems] Error seeding systems:', error);
    res.status(500).json({ error: 'Failed to seed systems' });
  }
}
