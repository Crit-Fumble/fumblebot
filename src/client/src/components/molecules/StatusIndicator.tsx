import { StatusDot, type StatusType } from '../atoms';
import { clsx } from 'clsx';

export interface StatusIndicatorProps {
  status: StatusType;
  label?: string;
  showLabel?: boolean;
  testId?: string;
  className?: string;
}

const statusLabels: Record<StatusType, string> = {
  active: 'Active',
  stopped: 'Stopped',
  error: 'Error',
  warning: 'Warning',
  loading: 'Loading',
};

export function StatusIndicator({
  status,
  label,
  showLabel = true,
  testId,
  className,
}: StatusIndicatorProps) {
  const displayLabel = label || statusLabels[status];

  return (
    <div className={clsx('flex items-center gap-2', className)} data-testid={testId}>
      <StatusDot status={status} testId={testId ? `${testId}-dot` : undefined} />
      {showLabel && (
        <span
          className="text-sm text-discord-text-muted"
          data-testid={testId ? `${testId}-label` : undefined}
        >
          {displayLabel}
        </span>
      )}
    </div>
  );
}
