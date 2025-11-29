/**
 * Platform Module
 * Multi-platform server for FumbleBot
 *
 * Supports Discord Activities, Web, iOS, and Android
 */

// Main server
export {
  PlatformServer,
  ActivityServer, // Legacy alias
} from './server.js';

// Models
export type {
  Platform,
  PlatformContext,
  PlatformServerConfig,
  ActivityServerConfig,
  ActivitySession,
  ActivityType,
  ActivityConfig,
  DiceRollActivity,
  InitiativeEntry,
  MapAnnotation,
} from './models/index.js';

// Routes
export {
  routes,
  getAllRoutes,
  getRoutesByCategory,
  printRouteTable,
  type RouteDefinition,
} from './routes.js';

// Controllers
export * from './controllers/index.js';
