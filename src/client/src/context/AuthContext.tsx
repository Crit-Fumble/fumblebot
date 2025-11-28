import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { DiscordSDK } from '@discord/embedded-app-sdk';
import type { DiscordUser, DiscordContext } from '@/types';

// Platform detection
export type Platform = 'discord' | 'web';

export interface AuthState {
  platform: Platform;
  isReady: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  user: DiscordUser | null;
  context: DiscordContext | null;
  error: Error | null;
  guilds: Guild[] | null; // For web mode guild selection
}

export interface Guild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

interface AuthContextValue extends AuthState {
  initialize: () => Promise<void>;
  login: () => void;
  logout: () => Promise<void>;
  selectGuild: (guildId: string) => void;
}

interface AuthProviderProps {
  children: ReactNode;
  clientId: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ADMIN_PERMISSION = 0x8n;

/**
 * Detect if we're running inside Discord iframe
 */
function detectPlatform(): Platform {
  // Check for Discord's embedded app indicators
  const isInIframe = window.self !== window.top;
  const hasDiscordParent = window.location.ancestorOrigins?.length > 0 &&
    Array.from(window.location.ancestorOrigins).some(origin =>
      origin.includes('discord.com') || origin.includes('discordsays.com')
    );
  const urlHasDiscord = window.location.pathname.includes('/discord');

  if ((isInIframe && hasDiscordParent) || urlHasDiscord) {
    return 'discord';
  }
  return 'web';
}

/**
 * Get API base path based on platform
 * Discord Activities use /.proxy/ prefix, web uses direct /api/
 */
function getApiPath(platform: Platform): string {
  return platform === 'discord' ? '/.proxy' : '';
}

export function AuthProvider({ children, clientId }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    platform: detectPlatform(),
    isReady: false,
    isAuthenticated: false,
    isAdmin: false,
    user: null,
    context: null,
    error: null,
    guilds: null,
  });

  const apiPath = getApiPath(state.platform);

  // Discord SDK initialization
  const initializeDiscord = useCallback(async () => {
    try {
      const sdk = new DiscordSDK(clientId);
      await sdk.ready();

      setState(prev => ({ ...prev, isReady: true }));

      // Authorize
      const { code } = await sdk.commands.authorize({
        client_id: clientId,
        response_type: 'code',
        state: '',
        prompt: 'none',
        scope: ['identify', 'guilds.members.read'],
      });

      // Exchange token
      const tokenResponse = await fetch(`${apiPath}/api/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      if (!tokenResponse.ok) {
        throw new Error('Token exchange failed');
      }

      const { access_token } = await tokenResponse.json();

      // Authenticate
      const authResult = await sdk.commands.authenticate({ access_token });

      const user: DiscordUser = {
        id: authResult.user.id,
        username: authResult.user.username,
        discriminator: authResult.user.discriminator,
        avatar: authResult.user.avatar ?? null,
        global_name: authResult.user.global_name ?? null,
      };

      const context: DiscordContext = {
        guildId: sdk.guildId,
        channelId: sdk.channelId,
        instanceId: sdk.instanceId,
      };

      // Check permissions
      const { permissions } = await sdk.commands.getChannelPermissions();
      const permBigInt = BigInt(permissions);
      const isAdmin = (permBigInt & ADMIN_PERMISSION) === ADMIN_PERMISSION;

      setState(prev => ({
        ...prev,
        isAuthenticated: true,
        isAdmin,
        user,
        context,
        error: null,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error : new Error('Discord initialization failed'),
      }));
    }
  }, [clientId, apiPath]);

  // Web OAuth initialization - check existing session
  const initializeWeb = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isReady: true }));

      // Check for existing session
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });

      if (!response.ok) {
        // Not authenticated - that's okay for web, show login
        setState(prev => ({
          ...prev,
          isAuthenticated: false,
          error: null,
        }));
        return;
      }

      const data = await response.json();
      const user: DiscordUser = {
        id: data.user.id,
        username: data.user.username,
        discriminator: data.user.discrimator || '0',
        avatar: data.user.avatar,
        global_name: data.user.globalName,
      };

      // Fetch user's guilds
      const guildsResponse = await fetch('/api/auth/guilds', {
        credentials: 'include',
      });

      let guilds: Guild[] = [];
      let selectedGuildId: string | null = null;

      if (guildsResponse.ok) {
        const guildsData = await guildsResponse.json();
        guilds = guildsData.guilds || [];

        // Filter to admin guilds only
        guilds = guilds.filter(g => {
          const permissions = BigInt(g.permissions);
          return (permissions & ADMIN_PERMISSION) === ADMIN_PERMISSION || g.owner;
        });

        // Check for previously selected guild
        selectedGuildId = localStorage.getItem('fumblebot_selected_guild');
        if (selectedGuildId && !guilds.find(g => g.id === selectedGuildId)) {
          selectedGuildId = null;
          localStorage.removeItem('fumblebot_selected_guild');
        }
      }

      const context: DiscordContext = {
        guildId: selectedGuildId,
        channelId: null,
        instanceId: `web-${Date.now()}`,
      };

      setState(prev => ({
        ...prev,
        isAuthenticated: true,
        isAdmin: true, // Web users who reach admin view are admins of selected guild
        user,
        context,
        guilds,
        error: null,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error : new Error('Web initialization failed'),
      }));
    }
  }, []);

  // Main initialize function
  const initialize = useCallback(async () => {
    if (state.platform === 'discord') {
      await initializeDiscord();
    } else {
      await initializeWeb();
    }
  }, [state.platform, initializeDiscord, initializeWeb]);

  // Login for web mode - redirect to Discord OAuth
  const login = useCallback(() => {
    if (state.platform !== 'web') return;

    const scope = 'identify guilds guilds.members.read';
    const redirectUri = encodeURIComponent(`${window.location.origin}/auth/callback`);
    const stateParam = encodeURIComponent(window.location.pathname);
    const authUrl =
      `https://discord.com/api/oauth2/authorize` +
      `?client_id=${clientId}` +
      `&redirect_uri=${redirectUri}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scope)}` +
      `&state=${stateParam}`;

    window.location.href = authUrl;
  }, [state.platform, clientId]);

  // Logout
  const logout = useCallback(async () => {
    if (state.platform === 'web') {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
        });
      } catch {
        // Ignore errors
      }
      localStorage.removeItem('fumblebot_selected_guild');
      window.location.reload();
    }
  }, [state.platform]);

  // Select guild (web mode only)
  const selectGuild = useCallback((guildId: string) => {
    if (state.platform !== 'web') return;

    localStorage.setItem('fumblebot_selected_guild', guildId);
    setState(prev => ({
      ...prev,
      context: prev.context
        ? { ...prev.context, guildId }
        : { guildId, channelId: null, instanceId: `web-${Date.now()}` },
    }));
  }, [state.platform]);

  // Auto-initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        initialize,
        login,
        logout,
        selectGuild,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Hook to get API URL with correct prefix for platform
 */
export function useApiUrl(path: string): string {
  const { platform } = useAuth();
  const prefix = platform === 'discord' ? '/.proxy' : '';
  return `${prefix}${path}`;
}
