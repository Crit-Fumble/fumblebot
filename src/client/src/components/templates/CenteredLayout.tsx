import { type ReactNode } from 'react';

export interface CenteredLayoutProps {
  children: ReactNode;
  testId?: string;
}

export function CenteredLayout({ children, testId = 'centered-layout' }: CenteredLayoutProps) {
  return (
    <div
      className="min-h-screen bg-discord-background-tertiary flex items-center justify-center p-4"
      data-testid={testId}
    >
      {children}
    </div>
  );
}
