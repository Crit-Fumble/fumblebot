import { clsx } from 'clsx';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  testId?: string;
  className?: string;
}

export function Spinner({ size = 'md', testId, className }: SpinnerProps) {
  return (
    <div
      data-testid={testId}
      className={clsx(
        'animate-spin rounded-full border-2 border-discord-text-muted border-t-discord-primary',
        {
          'w-4 h-4': size === 'sm',
          'w-6 h-6': size === 'md',
          'w-8 h-8': size === 'lg',
        },
        className
      )}
      role="status"
      aria-label="Loading"
    />
  );
}
