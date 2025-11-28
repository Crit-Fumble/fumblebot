import { Spinner, CenteredLayout } from '@crit-fumble/react';

export interface LoadingPageProps {
  message?: string;
  testId?: string;
}

export function LoadingPage({
  message = 'Initializing Discord Activity...',
  testId = 'loading-page',
}: LoadingPageProps) {
  return (
    <CenteredLayout testId={testId}>
      <div className="text-center">
        <Spinner size="lg" testId={`${testId}-spinner`} />
        <p
          className="text-discord-text-muted mt-4"
          data-testid={`${testId}-message`}
        >
          {message}
        </p>
      </div>
    </CenteredLayout>
  );
}
