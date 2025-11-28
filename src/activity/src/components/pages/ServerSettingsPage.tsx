import { useState, useEffect } from 'react';
import { Button } from '../atoms';
import { TabNav, type Tab } from '../molecules';
import { MainLayout } from '../templates';
import { ChannelLinkingPanel, RoleLinkingPanel, BotSettingsPanel } from '../organisms';
import type { ChannelLinks, BotSettings, DiscordChannel, DiscordRole } from '@/types';

export interface ServerSettingsPageProps {
  guildId: string | null;
  onBack: () => void;
  testId?: string;
}

type SettingsTab = 'channels' | 'roles' | 'bot';

const tabs: Tab[] = [
  { id: 'channels', label: 'Channels', icon: '📺' },
  { id: 'roles', label: 'Roles', icon: '👥' },
  { id: 'bot', label: 'Bot Config', icon: '🤖' },
];

const defaultBotSettings: BotSettings = {
  autoLogIC: true,
  defaultMode: 'ic',
  diceNotify: true,
  autoSession: false,
  reminderTime: 60,
};

export function ServerSettingsPage({
  guildId,
  onBack,
  testId = 'server-settings-page',
}: ServerSettingsPageProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('channels');
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [roles, setRoles] = useState<DiscordRole[]>([]);
  const [channelLinks, setChannelLinks] = useState<ChannelLinks>({
    ic: '',
    ooc: '',
    dice: '',
    gm: '',
    announce: '',
    voice: '',
  });
  const [roleMappings, setRoleMappings] = useState<Record<string, string>>({});
  const [botSettings, setBotSettings] = useState<BotSettings>(defaultBotSettings);
  const [_isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Note: setChannels is kept for future use when channels API is implemented
  void setChannels;

  useEffect(() => {
    async function loadSettings() {
      if (!guildId) return;

      setIsLoading(true);
      try {
        const response = await fetch(`/.proxy/api/guilds/${guildId}/settings`);
        if (response.ok) {
          const data = await response.json();
          if (data.channelLinks) setChannelLinks(data.channelLinks);
          if (data.roleMappings) setRoleMappings(data.roleMappings);
          if (data.botSettings) setBotSettings(data.botSettings);
        }

        const rolesResponse = await fetch(`/.proxy/api/guilds/${guildId}/roles`);
        if (rolesResponse.ok) {
          const rolesData = await rolesResponse.json();
          setRoles(rolesData.roles || []);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, [guildId]);

  const handleSave = async () => {
    if (!guildId) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/.proxy/api/guilds/${guildId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelLinks, roleMappings, botSettings }),
      });

      if (!response.ok) throw new Error('Failed to save settings');
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <MainLayout
      header={
        <h1 className="text-2xl font-bold text-discord-text-normal">FumbleBot</h1>
      }
      testId={testId}
    >
      <div className="p-4" data-testid={`${testId}-content`}>
        {/* Header */}
        <div className="flex items-center gap-4 mb-6 pb-4 border-b border-discord-border">
          <Button variant="secondary" onClick={onBack} testId={`${testId}-back-btn`}>
            ← Back
          </Button>
          <h3 className="text-xl font-semibold text-discord-text-normal">
            Server Settings
          </h3>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <TabNav
            tabs={tabs}
            activeTab={activeTab}
            onChange={(id) => setActiveTab(id as SettingsTab)}
            variant="pills"
            testId={`${testId}-tabs`}
          />
        </div>

        {/* Tab Content */}
        <div data-testid={`${testId}-tab-content`}>
          {activeTab === 'channels' && (
            <ChannelLinkingPanel
              channelLinks={channelLinks}
              channels={channels}
              onChange={setChannelLinks}
              onSave={handleSave}
              isSaving={isSaving}
              testId={`${testId}-channels`}
            />
          )}

          {activeTab === 'roles' && (
            <RoleLinkingPanel
              roleMappings={roleMappings}
              roles={roles}
              onChange={setRoleMappings}
              testId={`${testId}-roles`}
            />
          )}

          {activeTab === 'bot' && (
            <BotSettingsPanel
              settings={botSettings}
              onChange={setBotSettings}
              onSave={handleSave}
              onReset={() => setBotSettings(defaultBotSettings)}
              isSaving={isSaving}
              testId={`${testId}-bot`}
            />
          )}
        </div>
      </div>
    </MainLayout>
  );
}
