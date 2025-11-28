import { clsx } from 'clsx';

export type StatusType = 'active' | 'stopped' | 'error' | 'warning' | 'loading';

export interface StatusDotProps {
  status: StatusType;
  testId?: string;
  className?: string;
}

export function StatusDot({ status, testId, className }: StatusDotProps) {
  return (
    <span
      data-testid={testId}
      className={clsx(
        'status-dot',
        {
          'status-dot-active': status === 'active',
          'status-dot-stopped': status === 'stopped',
          'status-dot-error': status === 'error',
          'bg-discord-yellow': status === 'warning',
          'bg-discord-primary animate-pulse': status === 'loading',
        },
        className
      )}
    />
  );
}
