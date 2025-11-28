import { Button, Select, type SelectOption } from '@crit-fumble/react';
import type { ChannelLinks, DiscordChannel } from '@/types';

export interface ChannelLinkingPanelProps {
  channelLinks: ChannelLinks;
  channels: DiscordChannel[];
  onChange: (links: ChannelLinks) => void;
  onSave: () => void;
  onRefresh?: () => void;
  isSaving?: boolean;
  testId?: string;
}

interface ChannelType {
  key: keyof ChannelLinks;
  icon: string;
  title: string;
  description: string;
  isVoice?: boolean;
}

const channelTypes: ChannelType[] = [
  { key: 'ic', icon: '💬', title: 'In-Character Chat', description: 'Messages logged as character dialogue' },
  { key: 'ooc', icon: '🗨️', title: 'Out-of-Character', description: 'Player discussion, separate from RP' },
  { key: 'dice', icon: '🎲', title: 'Dice Rolls', description: 'Dedicated channel for roll results' },
  { key: 'gm', icon: '📝', title: 'GM Notes', description: 'Private GM channel for session notes' },
  { key: 'announce', icon: '📢', title: 'Announcements', description: 'Session schedules and campaign news' },
  { key: 'voice', icon: '🎤', title: 'Voice Channel', description: 'Default voice channel for sessions', isVoice: true },
];

export function ChannelLinkingPanel({
  channelLinks,
  channels,
  onChange,
  onSave,
  onRefresh,
  isSaving,
  testId = 'channel-linking',
}: ChannelLinkingPanelProps) {
  const textChannels = channels.filter((c) => c.type === 0);
  const voiceChannels = channels.filter((c) => c.type === 2);

  const getChannelOptions = (isVoice: boolean): SelectOption[] => {
    const list = isVoice ? voiceChannels : textChannels;
    return list.map((c) => ({
      value: c.id,
      label: `${isVoice ? '🔊 ' : '#'}${c.name}`,
    }));
  };

  return (
    <div data-testid={testId}>
      <div className="mb-5">
        <h4 className="text-lg font-semibold mb-2">Channel Links</h4>
        <p className="text-discord-text-muted text-sm">
          Link Discord channels to campaign functions
        </p>
      </div>

      <div className="space-y-3">
        {channelTypes.map((type) => (
          <div
            key={type.key}
            className="grid grid-cols-[48px_1fr_200px_80px] items-center gap-4 p-4 bg-discord-border rounded-lg"
            data-testid={`${testId}-${type.key}`}
          >
            <div className="text-2xl text-center">{type.icon}</div>
            <div>
              <div className="font-semibold text-sm">{type.title}</div>
              <div className="text-xs text-discord-text-muted">{type.description}</div>
            </div>
            <Select
              options={getChannelOptions(!!type.isVoice)}
              value={channelLinks[type.key]}
              onChange={(e) => onChange({ ...channelLinks, [type.key]: e.target.value })}
              placeholder="-- Not linked --"
              testId={`${testId}-${type.key}-select`}
            />
            <div
              className={`text-sm text-center ${
                channelLinks[type.key] ? 'text-discord-green' : 'text-discord-text-muted'
              }`}
              data-testid={`${testId}-${type.key}-status`}
            >
              {channelLinks[type.key] ? '✓ Linked' : '○ Unlinked'}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-3 mt-5 pt-5 border-t border-discord-border">
        {onRefresh && (
          <Button variant="secondary" onClick={onRefresh} testId={`${testId}-refresh-btn`}>
            🔄 Refresh Channels
          </Button>
        )}
        <Button
          variant="primary"
          onClick={onSave}
          isLoading={isSaving}
          testId={`${testId}-save-btn`}
        >
          💾 Save Links
        </Button>
      </div>
    </div>
  );
}
