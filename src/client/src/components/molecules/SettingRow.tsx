import { type ReactNode } from 'react';
import { Toggle, type SelectOption } from '../atoms';
import { clsx } from 'clsx';

export interface SettingRowProps {
  label: string;
  description?: string;
  children?: ReactNode;
  testId?: string;
  className?: string;
}

export function SettingRow({ label, description, children, testId, className }: SettingRowProps) {
  return (
    <div
      className={clsx(
        'flex justify-between items-center p-4 bg-discord-border rounded-lg',
        className
      )}
      data-testid={testId}
    >
      <div className="flex-1">
        <div className="font-medium mb-1">{label}</div>
        {description && (
          <p className="text-xs text-discord-text-muted m-0">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

export interface SettingToggleRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  testId?: string;
}

export function SettingToggleRow({
  label,
  description,
  checked,
  onChange,
  testId,
}: SettingToggleRowProps) {
  return (
    <SettingRow label={label} description={description} testId={testId}>
      <Toggle
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        testId={testId ? `${testId}-toggle` : undefined}
      />
    </SettingRow>
  );
}

export interface SettingSelectRowProps {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  testId?: string;
}

export function SettingSelectRow({
  label,
  description,
  value,
  onChange,
  options,
  testId,
}: SettingSelectRowProps) {
  return (
    <SettingRow label={label} description={description} testId={testId}>
      <select
        className="px-3 py-2 bg-discord-background-tertiary border-none rounded text-white text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId ? `${testId}-select` : undefined}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </SettingRow>
  );
}
