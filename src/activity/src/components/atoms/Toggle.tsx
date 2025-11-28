import { type InputHTMLAttributes } from 'react';
import { clsx } from 'clsx';

export interface ToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  testId?: string;
}

export function Toggle({ className, testId, ...props }: ToggleProps) {
  return (
    <label className={clsx('relative inline-block w-12 h-6 cursor-pointer', className)}>
      <input
        type="checkbox"
        className="sr-only peer"
        data-testid={testId}
        {...props}
      />
      <div className="w-full h-full bg-discord-text-muted rounded-full peer-checked:bg-discord-green transition-colors" />
      <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-6" />
    </label>
  );
}
