import { useState } from 'react';
import { useAuth } from './context';
import { GuildSelector } from './components/molecules';
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
    error,
    initialize,
    login,
    selectGuild,
  } = useAuth();
  const [currentView, setCurrentView] = useState<View>('dashboard');

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
            Choose a Discord server where you're an administrator to manage FumbleBot.
          </p>
          <GuildSelector
            guilds={guilds}
            selectedGuildId={context?.guildId || null}
            onChange={selectGuild}
            testId={`${testId}-guild-selector`}
          />
          {guilds.length === 0 && (
            <p className="text-discord-text-muted text-sm text-center mt-4">
              No servers found where you have admin permissions.
            </p>
          )}
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
