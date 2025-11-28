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
} from './AuthContext';
