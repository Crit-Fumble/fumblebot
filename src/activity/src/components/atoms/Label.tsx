import { type LabelHTMLAttributes } from 'react';
import { clsx } from 'clsx';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  testId?: string;
  required?: boolean;
}

export function Label({ className, testId, required, children, ...props }: LabelProps) {
  return (
    <label
      data-testid={testId}
      className={clsx(
        'block text-sm font-medium text-discord-text-muted mb-1',
        className
      )}
      {...props}
    >
      {children}
      {required && <span className="text-discord-red ml-1">*</span>}
    </label>
  );
}
