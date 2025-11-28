import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { DiscordSDK } from '@discord/embedded-app-sdk';
import type { DiscordSDKState, DiscordAuth, DiscordContext as DiscordCtx } from '@/types';

interface DiscordProviderProps {
  children: ReactNode;
  clientId: string;
}

interface DiscordContextValue extends DiscordSDKState {
  initialize: () => Promise<void>;
}

const DiscordContext = createContext<DiscordContextValue | null>(null);

const ADMIN_PERMISSION = 0x8n;

export function DiscordProvider({ children, clientId }: DiscordProviderProps) {
  const [state, setState] = useState<DiscordSDKState>({
    sdk: null,
    auth: null,
    context: null,
    isReady: false,
    isAuthenticated: false,
    isAdmin: false,
    error: null,
  });

  const initialize = useCallback(async () => {
    try {
      // Step 1: Initialize SDK
      const sdk = new DiscordSDK(clientId);
      setState(prev => ({ ...prev, sdk }));

      // Step 2: Wait for ready
      await sdk.ready();
      setState(prev => ({ ...prev, isReady: true }));

      // Step 3: Authorize
      const { code } = await sdk.commands.authorize({
        client_id: clientId,
        response_type: 'code',
        state: '',
        prompt: 'none',
        scope: ['identify', 'guilds.members.read'],
      });

      // Step 4: Exchange token
      const tokenResponse = await fetch('/.proxy/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      if (!tokenResponse.ok) {
        throw new Error('Token exchange failed');
      }

      const { access_token } = await tokenResponse.json();

      // Step 5: Authenticate
      const authResult = await sdk.commands.authenticate({ access_token });

      const auth: DiscordAuth = {
        user: {
          id: authResult.user.id,
          username: authResult.user.username,
          discriminator: authResult.user.discriminator,
          avatar: authResult.user.avatar ?? null,
          global_name: authResult.user.global_name ?? null,
        },
        access_token,
      };

      const context: DiscordCtx = {
        guildId: sdk.guildId,
        channelId: sdk.channelId,
        instanceId: sdk.instanceId,
      };

      // Step 6: Check permissions
      const { permissions } = await sdk.commands.getChannelPermissions();
      const permBigInt = BigInt(permissions);
      const isAdmin = (permBigInt & ADMIN_PERMISSION) === ADMIN_PERMISSION;

      setState(prev => ({
        ...prev,
        auth,
        context,
        isAuthenticated: true,
        isAdmin,
        error: null,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error : new Error('Unknown error'),
      }));
    }
  }, [clientId]);

  // Auto-initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <DiscordContext.Provider value={{ ...state, initialize }}>
      {children}
    </DiscordContext.Provider>
  );
}

export function useDiscord() {
  const context = useContext(DiscordContext);
  if (!context) {
    throw new Error('useDiscord must be used within a DiscordProvider');
  }
  return context;
}
