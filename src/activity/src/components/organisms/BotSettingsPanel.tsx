import { Button } from '../atoms';
import { SettingToggleRow, SettingSelectRow } from '../molecules';
import type { BotSettings } from '@/types';

export interface BotSettingsPanelProps {
  settings: BotSettings;
  onChange: (settings: BotSettings) => void;
  onSave: () => void;
  onReset: () => void;
  isSaving?: boolean;
  testId?: string;
}

export function BotSettingsPanel({
  settings,
  onChange,
  onSave,
  onReset,
  isSaving,
  testId = 'bot-settings',
}: BotSettingsPanelProps) {
  return (
    <div data-testid={testId}>
      {/* Message Handling */}
      <div className="mb-8">
        <h4 className="text-base font-semibold mb-4 pb-2 border-b border-discord-border">
          Message Handling
        </h4>

        <div className="space-y-2">
          <SettingToggleRow
            label="Auto-log IC messages"
            description="Automatically log messages in IC channel during sessions"
            checked={settings.autoLogIC}
            onChange={(checked) => onChange({ ...settings, autoLogIC: checked })}
            testId={`${testId}-autolog`}
          />

          <SettingSelectRow
            label="Default message mode"
            description="Default mode for messages in linked channels"
            value={settings.defaultMode}
            onChange={(value) => onChange({ ...settings, defaultMode: value })}
            options={[
              { value: 'ic', label: 'In-Character' },
              { value: 'ooc', label: 'Out-of-Character' },
            ]}
            testId={`${testId}-default-mode`}
          />

          <SettingToggleRow
            label="Dice roll notifications"
            description="Post roll results to dice channel"
            checked={settings.diceNotify}
            onChange={(checked) => onChange({ ...settings, diceNotify: checked })}
            testId={`${testId}-dice-notify`}
          />
        </div>
      </div>

      {/* Session Management */}
      <div className="mb-8">
        <h4 className="text-base font-semibold mb-4 pb-2 border-b border-discord-border">
          Session Management
        </h4>

        <div className="space-y-2">
          <SettingToggleRow
            label="Auto-start session"
            description="Start session when GM joins voice channel"
            checked={settings.autoSession}
            onChange={(checked) => onChange({ ...settings, autoSession: checked })}
            testId={`${testId}-auto-session`}
          />

          <SettingSelectRow
            label="Session reminders"
            description="Post reminder before scheduled sessions"
            value={settings.reminderTime.toString()}
            onChange={(value) => onChange({ ...settings, reminderTime: parseInt(value) })}
            options={[
              { value: '0', label: 'Disabled' },
              { value: '15', label: '15 minutes before' },
              { value: '30', label: '30 minutes before' },
              { value: '60', label: '1 hour before' },
              { value: '1440', label: '1 day before' },
            ]}
            testId={`${testId}-reminder-time`}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-6 border-t border-discord-border">
        <Button variant="secondary" onClick={onReset} testId={`${testId}-reset-btn`}>
          Reset to Defaults
        </Button>
        <Button
          variant="primary"
          onClick={onSave}
          isLoading={isSaving}
          testId={`${testId}-save-btn`}
        >
          Save Settings
        </Button>
      </div>
    </div>
  );
}
