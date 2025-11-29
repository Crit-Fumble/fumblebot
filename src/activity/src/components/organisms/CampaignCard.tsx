import { Button, Card, CardFooter, StatusIndicator, type StatusType } from '@crit-fumble/react';
import type { Campaign } from '@/types';

export interface CampaignCardProps {
  campaign: Campaign;
  onClick?: () => void;
  onLaunch?: () => void;
  testId?: string;
}

// Map core CampaignStatus to UI StatusType
const statusMap: Record<Campaign['status'], StatusType> = {
  active: 'active',
  paused: 'stopped',
  completed: 'stopped',
  archived: 'stopped',
};

export function CampaignCard({ campaign, onClick, onLaunch, testId }: CampaignCardProps) {
  const cardTestId = testId || `campaign-card-${campaign.id}`;

  return (
    <Card
      variant="interactive"
      onClick={onClick}
      testId={cardTestId}
      className="bg-discord-background-secondary"
    >
      <div className="font-semibold text-discord-text-normal mb-1" data-testid={`${cardTestId}-name`}>
        {campaign.name}
      </div>
      <div
        className="text-sm text-discord-primary inline-block px-2 py-0.5 bg-discord-background-tertiary rounded mb-2"
        data-testid={`${cardTestId}-system`}
      >
        {campaign.systemTitle || 'Unknown System'}
      </div>
      <p
        className="text-sm text-discord-text-muted mb-3 line-clamp-2"
        data-testid={`${cardTestId}-description`}
      >
        {campaign.description || 'No description'}
      </p>
      <CardFooter testId={`${cardTestId}-footer`}>
        <StatusIndicator
          status={statusMap[campaign.status]}
          testId={`${cardTestId}-status`}
        />
        <Button
          variant="primary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onLaunch?.();
          }}
          testId={`${cardTestId}-launch-btn`}
        >
          Launch
        </Button>
      </CardFooter>
    </Card>
  );
}

export interface CreateCampaignCardProps {
  onClick: () => void;
  testId?: string;
}

export function CreateCampaignCard({ onClick, testId = 'create-campaign-card' }: CreateCampaignCardProps) {
  return (
    <Card
      variant="interactive"
      onClick={onClick}
      testId={testId}
      className="border-2 border-dashed border-discord-border bg-transparent flex flex-col items-center justify-center min-h-[160px]"
    >
      <div className="text-4xl text-discord-text-muted mb-2" data-testid={`${testId}-icon`}>
        +
      </div>
      <div className="text-discord-text-muted font-medium" data-testid={`${testId}-label`}>
        Create Campaign
      </div>
    </Card>
  );
}
