import { Badge } from '../atoms';
import { clsx } from 'clsx';

export interface UserBadgeProps {
  username: string;
  avatar?: string | null;
  role?: 'admin' | 'gm' | 'player';
  showRole?: boolean;
  testId?: string;
  className?: string;
}

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  gm: 'GM',
  player: 'Player',
};

const roleVariants: Record<string, 'success' | 'primary' | 'default'> = {
  admin: 'success',
  gm: 'primary',
  player: 'default',
};

export function UserBadge({
  username,
  avatar,
  role,
  showRole = true,
  testId,
  className,
}: UserBadgeProps) {
  const avatarUrl = avatar
    ? avatar.startsWith('http')
      ? avatar
      : `https://cdn.discordapp.com/avatars/${avatar}`
    : 'https://cdn.discordapp.com/embed/avatars/0.png';

  return (
    <div
      className={clsx(
        'flex items-center gap-2 px-3 py-1.5 bg-discord-background-secondary rounded',
        className
      )}
      data-testid={testId}
    >
      <img
        src={avatarUrl}
        alt={username}
        className="w-6 h-6 rounded-full"
        data-testid={testId ? `${testId}-avatar` : undefined}
      />
      <span
        className="text-discord-text-normal text-sm"
        data-testid={testId ? `${testId}-name` : undefined}
      >
        {username}
      </span>
      {showRole && role && (
        <Badge
          variant={roleVariants[role]}
          testId={testId ? `${testId}-role` : undefined}
        >
          {roleLabels[role]}
        </Badge>
      )}
    </div>
  );
}
