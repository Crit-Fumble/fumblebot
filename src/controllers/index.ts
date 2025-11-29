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

// Admin dashboard
export {
  handleGetGuildMetrics,
  handleGetGuildSettings,
  handleUpdateGuildSettings,
  handleGetGuildActivity,
} from './admin.js';

// Prompt partials
export {
  handleListPromptPartials,
  handleGetPromptPartial,
  handleCreatePromptPartial,
  handleUpdatePromptPartial,
  handleDeletePromptPartial,
  handleGetPromptsForContext,
} from './prompts.js';
