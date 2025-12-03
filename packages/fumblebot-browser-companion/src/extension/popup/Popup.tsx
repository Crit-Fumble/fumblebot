import React, { useEffect, useState } from 'react';
import { Button, Card, Spinner, Badge } from '@crit-fumble/react/shared';
import type { VTTConnectionStatus, VTTPlatform } from '../../types';

interface AuthState {
  isAuthenticated: boolean;
  user: {
    id: string;
    username: string;
    discriminator: string;
    avatar: string | null;
    globalName: string | null;
  } | null;
  token: string | null;
}

interface ExtendedStatus extends VTTConnectionStatus {
  auth?: AuthState;
}

const PLATFORM_NAMES: Record<VTTPlatform, string> = {
  roll20: 'Roll20',
  dndbeyond: 'D&D Beyond',
  foundry: 'Foundry VTT',
};

export function Popup() {
  const [status, setStatus] = useState<ExtendedStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get current status from background
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
      if (response?.payload) {
        setStatus(response.payload);
      }
      setLoading(false);
    });

    // Listen for status updates
    const listener = (message: { type: string; payload: unknown }) => {
      if (message.type === 'STATUS_UPDATE') {
        setStatus((prev) => ({
          ...prev,
          ...(message.payload as VTTConnectionStatus),
        }));
      }
      if (message.type === 'AUTH_UPDATE') {
        setStatus((prev) => ({
          ...prev!,
          auth: message.payload as AuthState,
        }));
      }
    };
    chrome.runtime.onMessage.addListener(listener);

    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, []);

  const handleLogin = async () => {
    setLoginLoading(true);
    setError(null);

    chrome.runtime.sendMessage({ type: 'LOGIN' }, (response) => {
      setLoginLoading(false);
      if (response?.payload?.success) {
        // Auth update will come via message
      } else {
        setError(response?.payload?.error || 'Login failed');
      }
    });
  };

  const handleLogout = () => {
    chrome.runtime.sendMessage({ type: 'LOGOUT' });
  };

  if (loading) {
    return (
      <div className="w-80 p-4 flex items-center justify-center bg-gray-900">
        <Spinner size="lg" />
      </div>
    );
  }

  const isAuthenticated = status?.auth?.isAuthenticated;
  const user = status?.auth?.user;

  return (
    <div className="w-80 bg-gray-900 text-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <img src="/icons/icon-48.png" alt="FumbleBot" className="w-8 h-8" />
          <div>
            <h1 className="font-bold text-lg">FumbleBot</h1>
            <p className="text-xs text-gray-400">VTT Companion</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Auth Section - Show first */}
        <Card className="bg-gray-800 p-3">
          <h2 className="text-sm font-semibold text-gray-300 mb-2">Discord Account</h2>

          {isAuthenticated && user ? (
            <div className="space-y-3">
              {/* User info */}
              <div className="flex items-center gap-3">
                {user.avatar ? (
                  <img
                    src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=40`}
                    alt={user.username}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center">
                    <span className="text-lg font-bold">
                      {(user.globalName || user.username).charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <p className="font-medium">{user.globalName || user.username}</p>
                  <p className="text-xs text-gray-400">@{user.username}</p>
                </div>
                <Badge className="bg-green-600 ml-auto">Connected</Badge>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="w-full text-gray-400 hover:text-white"
              >
                Sign Out
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-400">
                Sign in with Discord to sync your rolls and chat to your server.
              </p>

              <Button
                size="sm"
                onClick={handleLogin}
                disabled={loginLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center gap-2"
              >
                {loginLoading ? (
                  <Spinner size="sm" />
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
                    </svg>
                    Sign in with Discord
                  </>
                )}
              </Button>
            </div>
          )}
        </Card>

        {/* VTT Status - Only show when authenticated */}
        {isAuthenticated && (
          <Card className="bg-gray-800 p-3">
            <h2 className="text-sm font-semibold text-gray-300 mb-2">VTT Connection</h2>
            {status?.platform ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">{PLATFORM_NAMES[status.platform]}</span>
                  <Badge
                    className={`${
                      status.state === 'connected'
                        ? 'bg-green-500'
                        : status.state === 'error'
                          ? 'bg-red-500'
                          : 'bg-yellow-500'
                    }`}
                  >
                    {status.state}
                  </Badge>
                </div>
                {status.gameName && (
                  <p className="text-xs text-gray-400">Game: {status.gameName}</p>
                )}
                {status.username && (
                  <p className="text-xs text-gray-400">Playing as: {status.username}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                No VTT detected. Open Roll20, D&D Beyond, Foundry VTT, 5e.tools, or Cypher Tools.
              </p>
            )}
          </Card>
        )}

        {/* Error display */}
        {(error || status?.error) && (
          <div className="p-2 bg-red-900/50 border border-red-700 rounded text-sm text-red-200">
            {error || status?.error}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-gray-700 text-center">
        <a
          href="https://crit-fumble.com/help/extension"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-500 hover:text-gray-300"
        >
          Need help?
        </a>
      </div>
    </div>
  );
}
