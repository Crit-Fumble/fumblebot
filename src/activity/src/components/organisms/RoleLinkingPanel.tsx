import { useState } from 'react';
import { Button, Select, type SelectOption } from '@crit-fumble/react';
import type { DiscordRole } from '@/types';

export interface RoleLinkingPanelProps {
  roleMappings: Record<string, string>;
  roles: DiscordRole[];
  onChange: (mappings: Record<string, string>) => void;
  testId?: string;
}

const FOUNDRY_ROLES: SelectOption[] = [
  { value: '1', label: 'Player' },
  { value: '2', label: 'Trusted Player' },
  { value: '3', label: 'Assistant GM' },
  { value: '4', label: 'Game Master' },
];

const FOUNDRY_ROLE_NAMES: Record<string, string> = {
  '1': 'Player',
  '2': 'Trusted Player',
  '3': 'Assistant GM',
  '4': 'Game Master',
};

export function RoleLinkingPanel({
  roleMappings,
  roles,
  onChange,
  testId = 'role-linking',
}: RoleLinkingPanelProps) {
  const [newDiscordRole, setNewDiscordRole] = useState('');
  const [newFoundryRole, setNewFoundryRole] = useState('');

  const filteredRoles = roles.filter((r) => r.name !== '@everyone' && !r.managed);

  const roleOptions: SelectOption[] = filteredRoles.map((r) => ({
    value: r.id,
    label: r.name,
  }));

  const addMapping = () => {
    if (newDiscordRole && newFoundryRole) {
      onChange({ ...roleMappings, [newDiscordRole]: newFoundryRole });
      setNewDiscordRole('');
      setNewFoundryRole('');
    }
  };

  const removeMapping = (discordRoleId: string) => {
    const updated = { ...roleMappings };
    delete updated[discordRoleId];
    onChange(updated);
  };

  return (
    <div data-testid={testId}>
      <div className="mb-5">
        <h4 className="text-lg font-semibold mb-2">Role Permissions</h4>
        <p className="text-discord-text-muted text-sm">
          Map Discord roles to Foundry VTT permission levels
        </p>
      </div>

      <div className="space-y-2 mb-4" data-testid={`${testId}-list`}>
        {Object.entries(roleMappings).map(([discordRoleId, foundryRole]) => {
          const role = roles.find((r) => r.id === discordRoleId);
          if (!role) return null;

          const roleColor = role.color
            ? `#${role.color.toString(16).padStart(6, '0')}`
            : '#99aab5';

          return (
            <div
              key={discordRoleId}
              className="flex items-center gap-3 p-3 bg-discord-border rounded-lg"
              data-testid={`${testId}-mapping-${discordRoleId}`}
            >
              <div className="flex items-center gap-2 flex-1">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: roleColor }}
                />
                <span>{role.name}</span>
              </div>
              <span className="text-discord-primary font-bold">→</span>
              <div className="flex-1 text-discord-text-muted">
                {FOUNDRY_ROLE_NAMES[foundryRole] || 'Unknown'}
              </div>
              <button
                className="text-discord-red hover:bg-discord-red/10 p-1 rounded text-lg"
                onClick={() => removeMapping(discordRoleId)}
                data-testid={`${testId}-remove-${discordRoleId}`}
              >
                ×
              </button>
            </div>
          );
        })}

        {Object.keys(roleMappings).length === 0 && (
          <p className="text-center text-discord-text-muted py-5">
            No role mappings configured
          </p>
        )}
      </div>

      {/* Add New Mapping */}
      <div
        className="p-4 border-2 border-dashed border-discord-border rounded-lg"
        data-testid={`${testId}-add`}
      >
        <div className="flex items-center gap-3">
          <Select
            options={roleOptions}
            value={newDiscordRole}
            onChange={(e) => setNewDiscordRole(e.target.value)}
            placeholder="Select Discord Role..."
            testId={`${testId}-add-discord-role`}
            className="flex-1"
          />
          <span className="text-discord-primary font-bold">→</span>
          <Select
            options={FOUNDRY_ROLES}
            value={newFoundryRole}
            onChange={(e) => setNewFoundryRole(e.target.value)}
            placeholder="Select Permission..."
            testId={`${testId}-add-foundry-role`}
            className="flex-1"
          />
          <Button variant="primary" size="sm" onClick={addMapping} testId={`${testId}-add-btn`}>
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
