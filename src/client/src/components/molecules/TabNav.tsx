import { clsx } from 'clsx';

export interface Tab {
  id: string;
  label: string;
  icon?: string;
}

export interface TabNavProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  testId?: string;
  variant?: 'default' | 'pills';
}

export function TabNav({ tabs, activeTab, onChange, testId, variant = 'default' }: TabNavProps) {
  return (
    <div
      className={clsx(
        'flex gap-1',
        variant === 'pills' && 'p-1 bg-discord-background-tertiary rounded-lg'
      )}
      data-testid={testId}
      role="tablist"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          data-testid={testId ? `${testId}-${tab.id}` : undefined}
          className={clsx(
            'px-4 py-2.5 text-sm font-medium transition-colors',
            variant === 'default'
              ? [
                  'border-b-2',
                  activeTab === tab.id
                    ? 'border-discord-primary text-discord-text-normal'
                    : 'border-transparent text-discord-text-muted hover:text-discord-text-normal',
                ]
              : [
                  'flex-1 rounded-md',
                  activeTab === tab.id
                    ? 'bg-discord-primary text-white'
                    : 'text-discord-text-muted hover:text-white hover:bg-discord-border',
                ]
          )}
          onClick={() => onChange(tab.id)}
        >
          {tab.icon && <span className="mr-2">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
