/**
 * Platform Server Routes
 * Centralized route definitions for the multi-platform server
 *
 * Route categories:
 * - API routes: /api/* - JSON endpoints for data exchange
 * - Auth routes: /auth/* - OAuth2 authentication flows
 * - Platform routes: /, /discord, /web - Platform-specific UIs
 * - Activity routes: /discord/activity/* - Legacy/specific activity endpoints
 */

import { type Request, type Response } from 'express';
import type { PlatformServer } from './server.js';

/**
 * Route handler type that receives the server instance
 */
type RouteHandler = (server: PlatformServer) => (req: Request, res: Response) => void | Promise<void>;

/**
 * Route definition
 */
export interface RouteDefinition {
  method: 'get' | 'post' | 'put' | 'delete';
  path: string;
  handler: string; // Method name on PlatformServer
  description?: string;
}

/**
 * All routes organized by category
 */
export const routes: Record<string, RouteDefinition[]> = {
  // Health & Status
  system: [
    {
      method: 'get',
      path: '/health',
      handler: 'handleHealth',
      description: 'Health check endpoint',
    },
    {
      method: 'get',
      path: '/api/platform',
      handler: 'handlePlatformInfo',
      description: 'Returns detected platform context',
    },
  ],

  // Authentication
  auth: [
    {
      method: 'post',
      path: '/api/token',
      handler: 'handleTokenExchange',
      description: 'OAuth2 token exchange for Discord Activity SDK',
    },
    {
      method: 'get',
      path: '/auth/callback',
      handler: 'handleOAuthCallback',
      description: 'OAuth2 callback for web-based authentication',
    },
    {
      method: 'get',
      path: '/api/auth/me',
      handler: 'handleGetAuthUser',
      description: 'Get current authenticated user',
    },
    {
      method: 'post',
      path: '/api/auth/logout',
      handler: 'handleLogout',
      description: 'Logout and destroy session',
    },
    {
      method: 'get',
      path: '/api/auth/guilds',
      handler: 'handleGetUserGuilds',
      description: 'Get user Discord guilds',
    },
  ],

  // Platform-specific landing pages
  platforms: [
    {
      method: 'get',
      path: '/',
      handler: 'handleRoot',
      description: 'Auto-detect platform and serve appropriate UI',
    },
    {
      method: 'get',
      path: '/discord',
      handler: 'handleDiscordRoute',
      description: 'Force Discord Activity UI',
    },
    {
      method: 'get',
      path: '/web',
      handler: 'handleWebRoute',
      description: 'Force Web Dashboard UI',
    },
    {
      method: 'get',
      path: '/web/activity',
      handler: 'handleWebActivityRoute',
      description: 'Web-based Activity UI (session auth)',
    },
    {
      method: 'get',
      path: '/discord/activity',
      handler: 'handleDiscordRoute',
      description: 'Legacy Discord Activity route',
    },
  ],

  // Activity-specific features
  activities: [
    {
      method: 'get',
      path: '/discord/activity/character/:characterId',
      handler: 'serveCharacterSheet',
      description: 'Character sheet viewer',
    },
    {
      method: 'get',
      path: '/discord/activity/dice',
      handler: 'serveDiceRoller',
      description: 'Dice roller activity',
    },
    {
      method: 'get',
      path: '/discord/activity/map',
      handler: 'serveMapViewer',
      description: 'Map viewer activity',
    },
    {
      method: 'get',
      path: '/discord/activity/initiative',
      handler: 'serveInitiativeTracker',
      description: 'Initiative tracker activity',
    },
    {
      method: 'get',
      path: '/discord/activity/spells',
      handler: 'serveSpellLookup',
      description: 'Spell lookup activity',
    },
  ],

  // Session management API
  sessions: [
    {
      method: 'post',
      path: '/discord/activity/api/session',
      handler: 'handleSessionCreate',
      description: 'Create a new session',
    },
    {
      method: 'get',
      path: '/discord/activity/api/session/:sessionId',
      handler: 'handleSessionGet',
      description: 'Get session by ID',
    },
  ],

  // Foundry Systems management API
  systems: [
    {
      method: 'get',
      path: '/api/systems',
      handler: 'handleListSystems',
      description: 'List all registered Foundry systems',
    },
    {
      method: 'get',
      path: '/api/systems/:id',
      handler: 'handleGetSystem',
      description: 'Get a specific system by ID',
    },
    {
      method: 'post',
      path: '/api/systems',
      handler: 'handleAddSystem',
      description: 'Add a new system from manifest URL',
    },
    {
      method: 'post',
      path: '/api/systems/preview',
      handler: 'handlePreviewSystem',
      description: 'Preview a system manifest without saving',
    },
    {
      method: 'delete',
      path: '/api/systems/:id',
      handler: 'handleDeleteSystem',
      description: 'Remove a registered system',
    },
    {
      method: 'post',
      path: '/api/systems/seed',
      handler: 'handleSeedSystems',
      description: 'Seed with popular systems (admin only)',
    },
  ],
};

/**
 * Get all routes as a flat array
 */
export function getAllRoutes(): RouteDefinition[] {
  return Object.values(routes).flat();
}

/**
 * Get routes by category
 */
export function getRoutesByCategory(category: keyof typeof routes): RouteDefinition[] {
  return routes[category] || [];
}

/**
 * Print route table (for debugging/documentation)
 */
export function printRouteTable(): void {
  console.log('\n=== Platform Server Routes ===\n');

  for (const [category, categoryRoutes] of Object.entries(routes)) {
    console.log(`${category.toUpperCase()}:`);
    for (const route of categoryRoutes) {
      const method = route.method.toUpperCase().padEnd(6);
      const path = route.path.padEnd(45);
      console.log(`  ${method} ${path} ${route.description || ''}`);
    }
    console.log('');
  }
}
