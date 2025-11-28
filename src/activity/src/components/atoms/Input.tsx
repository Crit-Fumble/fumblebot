import { forwardRef, type InputHTMLAttributes } from 'react';
import { clsx } from 'clsx';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  testId?: string;
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, testId, error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        data-testid={testId}
        className={clsx(
          'input',
          error && 'border-discord-red focus:border-discord-red',
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
