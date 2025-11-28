import { type ReactNode, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  testId?: string;
  title?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({
  isOpen,
  onClose,
  children,
  testId,
  title,
  className,
  size = 'md',
}: ModalProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid={testId}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        data-testid={testId ? `${testId}-backdrop` : undefined}
      />

      {/* Modal content */}
      <div
        className={clsx(
          'relative z-10 mx-4 w-full',
          'bg-discord-background-primary rounded-lg shadow-xl',
          'border border-discord-border',
          {
            'max-w-sm': size === 'sm',
            'max-w-lg': size === 'md',
            'max-w-2xl': size === 'lg',
          },
          className
        )}
        data-testid={testId ? `${testId}-content` : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? `${testId}-title` : undefined}
      >
        {title && (
          <div className="px-4 py-3 border-b border-discord-border flex items-center justify-between">
            <h2
              id={testId ? `${testId}-title` : undefined}
              className="text-xl font-semibold text-discord-text-normal"
              data-testid={testId ? `${testId}-title` : undefined}
            >
              {title}
            </h2>
            <button
              onClick={onClose}
              className="text-discord-text-muted hover:text-discord-text-normal transition-colors"
              data-testid={testId ? `${testId}-close` : undefined}
            >
              ×
            </button>
          </div>
        )}
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export interface ModalFooterProps {
  children: ReactNode;
  testId?: string;
  className?: string;
}

export function ModalFooter({ children, testId, className }: ModalFooterProps) {
  return (
    <div
      className={clsx('flex justify-end gap-2 pt-4 border-t border-discord-border mt-4', className)}
      data-testid={testId}
    >
      {children}
    </div>
  );
}
