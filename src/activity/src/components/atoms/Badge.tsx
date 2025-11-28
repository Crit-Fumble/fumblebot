import { clsx } from 'clsx';

export interface BadgeProps {
  variant?: 'default' | 'primary' | 'success' | 'danger' | 'warning';
  children: React.ReactNode;
  testId?: string;
  className?: string;
}

export function Badge({ variant = 'default', children, testId, className }: BadgeProps) {
  return (
    <span
      data-testid={testId}
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        {
          'bg-discord-border text-discord-text-normal': variant === 'default',
          'bg-discord-primary text-white': variant === 'primary',
          'bg-discord-green text-white': variant === 'success',
          'bg-discord-red text-white': variant === 'danger',
          'bg-discord-yellow text-black': variant === 'warning',
        },
        className
      )}
    >
      {children}
    </span>
  );
}
