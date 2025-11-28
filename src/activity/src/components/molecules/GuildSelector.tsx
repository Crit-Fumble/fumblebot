import { Select } from '../atoms';
import type { Guild } from '@/context';

export interface GuildSelectorProps {
  guilds: Guild[];
  selectedGuildId: string | null;
  onChange: (guildId: string) => void;
  testId?: string;
}

export function GuildSelector({
  guilds,
  selectedGuildId,
  onChange,
  testId = 'guild-selector',
}: GuildSelectorProps) {
  const options = guilds.map((guild) => ({
    value: guild.id,
    label: guild.name,
  }));

  return (
    <div className="mb-4" data-testid={testId}>
      <label
        className="block text-xs text-discord-text-muted uppercase mb-2"
        data-testid={`${testId}-label`}
      >
        Select Server
      </label>
      <Select
        options={options}
        value={selectedGuildId || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="-- Choose a server --"
        testId={`${testId}-select`}
      />
    </div>
  );
}
