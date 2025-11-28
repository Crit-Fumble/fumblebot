import { Button } from '../atoms';

export interface ChatButtonProps {
  onClick: () => void;
  hasUnread?: boolean;
  testId?: string;
}

export function ChatButton({
  onClick,
  hasUnread = false,
  testId = 'chat-button',
}: ChatButtonProps) {
  return (
    <div className="relative" data-testid={testId}>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClick}
        testId={`${testId}-btn`}
        aria-label="Open chat"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          data-testid={`${testId}-icon`}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      </Button>
      {hasUnread && (
        <span
          className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-discord-red ring-2 ring-discord-background-primary"
          data-testid={`${testId}-unread`}
        />
      )}
    </div>
  );
}
