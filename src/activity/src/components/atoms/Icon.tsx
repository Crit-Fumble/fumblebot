import { clsx } from 'clsx';

export interface IconProps {
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  testId?: string;
}

// Emoji-based icons for simplicity - can be replaced with SVG icons later
export function Icon({ name, size = 'md', className, testId }: IconProps) {
  const icons: Record<string, string> = {
    dice: '🎲',
    campaign: '🏰',
    settings: '⚙️',
    user: '👤',
    users: '👥',
    add: '+',
    back: '←',
    close: '×',
    check: '✓',
    warning: '⚠️',
    error: '❌',
    chat: '💬',
    voice: '🎤',
    announcements: '📢',
    notes: '📝',
    refresh: '🔄',
    save: '💾',
    play: '▶️',
    stop: '⏹️',
    pause: '⏸️',
  };

  return (
    <span
      data-testid={testId}
      className={clsx(
        'inline-block',
        {
          'text-sm': size === 'sm',
          'text-base': size === 'md',
          'text-xl': size === 'lg',
          'text-2xl': size === 'xl',
        },
        className
      )}
      role="img"
      aria-label={name}
    >
      {icons[name] || '?'}
    </span>
  );
}
