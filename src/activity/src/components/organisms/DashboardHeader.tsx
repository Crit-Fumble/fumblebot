import { Button, UserBadge, ChatButton } from '@crit-fumble/react';

export interface DashboardHeaderProps {
  title: string;
  username: string;
  userRole?: 'admin' | 'gm' | 'player';
  onActivityHub?: () => void;
  onSettings?: () => void;
  onChat?: () => void;
  hasUnreadMessages?: boolean;
  testId?: string;
}

export function DashboardHeader({
  title,
  username,
  userRole = 'admin',
  onActivityHub,
  onSettings,
  onChat,
  hasUnreadMessages = false,
  testId = 'dashboard-header',
}: DashboardHeaderProps) {
  return (
    <div
      className="flex items-center justify-between mb-6 pb-5 border-b border-discord-border"
      data-testid={testId}
    >
      <h2 className="text-xl font-semibold text-discord-text-normal" data-testid={`${testId}-title`}>
        {title}
      </h2>
      <div className="flex items-center gap-3">
        {onChat && (
          <ChatButton
            onClick={onChat}
            hasUnread={hasUnreadMessages}
            testId={`${testId}-chat`}
          />
        )}
        {onActivityHub && (
          <Button
            variant="primary"
            onClick={onActivityHub}
            testId={`${testId}-activity-btn`}
          >
            Activity Hub
          </Button>
        )}
        {onSettings && (
          <Button
            variant="secondary"
            onClick={onSettings}
            testId={`${testId}-settings-btn`}
          >
            Settings
          </Button>
        )}
        <UserBadge
          username={username}
          role={userRole}
          testId={`${testId}-user`}
        />
      </div>
    </div>
  );
}
