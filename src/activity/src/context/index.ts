/**
 * FumbleBot Activity Contexts
 *
 * TODO: When @crit-fumble/core-activity is published, replace these local
 * exports with re-exports from core:
 *
 *   export {
 *     AuthProvider,
 *     useAuth,
 *     useApiUrl,
 *     DiscordProvider,
 *     useDiscord,
 *     type Platform,
 *     type AuthState,
 *     type Guild,
 *     type UserActivity,
 *   } from '@crit-fumble/core-activity'
 */

// Legacy Discord-only context (deprecated, use AuthProvider instead)
export { DiscordProvider, useDiscord } from './DiscordContext';

// Unified auth context supporting both Discord and Web
export {
  AuthProvider,
  useAuth,
  useApiUrl,
  type Platform,
  type AuthState,
  type Guild,
  type UserActivity,
} from './AuthContext';
