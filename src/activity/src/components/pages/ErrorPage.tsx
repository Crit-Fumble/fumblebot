import { Button } from '../atoms';
import { CenteredLayout } from '../templates';

export interface ErrorPageProps {
  error: Error;
  onRetry?: () => void;
  testId?: string;
}

export function ErrorPage({ error, onRetry, testId = 'error-page' }: ErrorPageProps) {
  return (
    <CenteredLayout testId={testId}>
      <div className="text-center max-w-md">
        <div className="text-4xl mb-4" data-testid={`${testId}-icon`}>
          ⚠️
        </div>
        <h2
          className="text-xl font-semibold text-discord-red mb-2"
          data-testid={`${testId}-title`}
        >
          Something went wrong
        </h2>
        <p
          className="text-discord-text-muted mb-6"
          data-testid={`${testId}-message`}
        >
          {error.message}
        </p>
        {onRetry && (
          <Button
            variant="primary"
            onClick={onRetry}
            testId={`${testId}-retry-btn`}
          >
            Try Again
          </Button>
        )}
      </div>
    </CenteredLayout>
  );
}
