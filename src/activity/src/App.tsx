import { useState } from 'react';
import { useAuth, type UserActivity } from './context';
import { GuildSelector } from '@crit-fumble/react';
import {
  LoadingPage,
  ErrorPage,
  WaitingPage,
  AdminDashboardPage,
  ServerSettingsPage,
  WebLoginPage,
} from './components/pages';

type View = 'dashboard' | 'settings';

export interface AppProps {
  testId?: string;
}

export function App({ testId = 'fumblebot-app' }: AppProps) {
  const {
    platform,
    isReady,
    isAuthenticated,
    isAdmin,
    user,
    context,
    guilds,
    activities,
    error,
    initialize,
    login,
    selectGuild,
  } = useAuth();
  const [currentView, setCurrentView] = useState<View>('dashboard');

  // Helper to get activities for current guild
  const currentGuildActivities: UserActivity | undefined = activities?.find(
    a => a.guildId === context?.guildId
  );

  // Show loading while initializing
  if (!isReady) {
    return <LoadingPage testId={`${testId}-loading`} />;
  }

  // Show error if any
  if (error) {
    return <ErrorPage error={error} onRetry={initialize} testId={`${testId}-error`} />;
  }

  // Web mode: show login page if not authenticated
  if (platform === 'web' && !isAuthenticated) {
    return <WebLoginPage onLogin={login} testId={`${testId}-login`} />;
  }

  // Discord mode: show loading while authenticating
  if (platform === 'discord' && !isAuthenticated) {
    return <LoadingPage testId={`${testId}-loading`} />;
  }

  // Show waiting view for non-admins (Discord mode only)
  if (platform === 'discord' && !isAdmin) {
    return <WaitingPage testId={`${testId}-waiting`} />;
  }

  // Web mode: need to select a guild first
  if (platform === 'web' && !context?.guildId && guilds) {
    return (
      <div className="min-h-screen bg-discord-background-primary flex items-center justify-center p-4">
        <div
          className="bg-discord-background-secondary rounded-lg p-8 max-w-md w-full"
          data-testid={`${testId}-guild-select`}
        >
          <h2 className="text-xl font-bold text-discord-text-normal mb-2">
            Select a Server
          </h2>
          <p className="text-discord-text-muted mb-6 text-sm">
            Choose a Discord server to view FumbleBot activities.
          </p>
          <GuildSelector
            guilds={guilds}
            selectedGuildId={context?.guildId || null}
            onChange={selectGuild}
            testId={`${testId}-guild-selector`}
          />
          {guilds.length === 0 && (
            <p className="text-discord-text-muted text-sm text-center mt-4">
              No servers found. Join a Discord server with FumbleBot to get started.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Web mode: non-admin players see their active activities or "No Active Activities"
  if (platform === 'web' && !isAdmin) {
    // Check if there are active sessions user can join
    const hasActiveActivities = currentGuildActivities && currentGuildActivities.campaigns.length > 0;

    if (hasActiveActivities) {
      // Show active sessions player can join
      return (
        <div
          className="min-h-screen bg-discord-background-primary p-4"
          data-testid={`${testId}-player-activities`}
        >
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-discord-text-normal">
                  Active Sessions
                </h1>
                <p className="text-discord-text-muted text-sm">
                  Join an active game session with your characters
                </p>
              </div>
              <button
                onClick={() => {
                  localStorage.removeItem('fumblebot_selected_guild');
                  window.location.reload();
                }}
                className="text-discord-text-muted hover:text-discord-text-normal text-sm"
                data-testid={`${testId}-change-server`}
              >
                Switch Server
              </button>
            </div>

            <div className="space-y-4">
              {currentGuildActivities.campaigns.map(campaign => (
                <div
                  key={campaign.id}
                  className="bg-discord-background-secondary rounded-lg p-4"
                  data-testid={`${testId}-campaign-${campaign.id}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h2 className="text-lg font-semibold text-discord-text-normal">
                        {campaign.name}
                      </h2>
                      {campaign.activeSession?.name && (
                        <p className="text-discord-text-muted text-sm">
                          {campaign.activeSession.name}
                        </p>
                      )}
                    </div>
                    <span className="px-2 py-1 bg-discord-green/20 text-discord-green text-xs rounded-full">
                      Live
                    </span>
                  </div>

                  <div className="mb-3">
                    <p className="text-discord-text-muted text-xs mb-2">Your Characters:</p>
                    <div className="flex flex-wrap gap-2">
                      {campaign.characters.map(char => (
                        <div
                          key={char.id}
                          className="flex items-center gap-2 bg-discord-background-tertiary rounded px-2 py-1"
                        >
                          {char.avatarUrl ? (
                            <img
                              src={char.avatarUrl}
                              alt={char.name}
                              className="w-5 h-5 rounded-full"
                            />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-discord-brand flex items-center justify-center text-white text-xs">
                              {char.name[0]}
                            </div>
                          )}
                          <span className="text-discord-text-normal text-sm">{char.name}</span>
                          <span className="text-discord-text-muted text-xs">({char.type})</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    className="w-full bg-discord-brand hover:bg-discord-brand-hover text-white py-2 px-4 rounded font-medium transition-colors"
                    data-testid={`${testId}-join-${campaign.id}`}
                  >
                    Join Session
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // No active activities
    return (
      <div
        className="min-h-screen bg-discord-background-primary flex items-center justify-center p-4"
        data-testid={`${testId}-no-activities`}
      >
        <div className="bg-discord-background-secondary rounded-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-discord-background-tertiary flex items-center justify-center">
            <svg
              className="w-8 h-8 text-discord-text-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-discord-text-normal mb-2">
            No Active Activities
          </h2>
          <p className="text-discord-text-muted text-sm mb-4">
            There are no active FumbleBot activities in this server right now.
            Check back when your Game Master starts a session!
          </p>
          <button
            onClick={() => {
              localStorage.removeItem('fumblebot_selected_guild');
              window.location.reload();
            }}
            className="text-discord-brand hover:underline text-sm"
            data-testid={`${testId}-change-server`}
          >
            Switch Server
          </button>
        </div>
      </div>
    );
  }

  // Show settings page
  if (currentView === 'settings') {
    return (
      <ServerSettingsPage
        guildId={context?.guildId || null}
        onBack={() => setCurrentView('dashboard')}
        testId={`${testId}-settings`}
      />
    );
  }

  // Show admin dashboard
  return (
    <AdminDashboardPage
      username={user?.username || 'Unknown'}
      userId={user?.id || ''}
      guildId={context?.guildId || null}
      onShowSettings={() => setCurrentView('settings')}
      testId={`${testId}-dashboard`}
    />
  );
}

export default App;
