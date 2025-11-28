/**
 * Controllers Module
 * Re-exports all controller functions
 */

export {
  handleTokenExchange,
  handleOAuthCallback,
  handleGetAuthUser,
  handleLogout,
  handleGetUserGuilds,
  handleGetUserActivities,
} from './auth.js';

export {
  handleSessionCreate,
  handleSessionGet,
} from './sessions.js';

export { detectPlatform } from './detection.js';

export {
  handleListSystems,
  handleGetSystem,
  handleAddSystem,
  handlePreviewSystem,
  handleDeleteSystem,
  handleSeedSystems,
} from './systems.js';
