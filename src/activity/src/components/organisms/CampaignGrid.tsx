import { CampaignCard, CreateCampaignCard } from './CampaignCard';
import { EmptyState } from '../molecules';
import type { Campaign } from '@/types';

export interface CampaignGridProps {
  campaigns: Campaign[];
  onCampaignClick?: (campaign: Campaign) => void;
  onLaunch?: (campaign: Campaign) => void;
  onCreateClick: () => void;
  isLoading?: boolean;
  testId?: string;
}

export function CampaignGrid({
  campaigns,
  onCampaignClick,
  onLaunch,
  onCreateClick,
  isLoading,
  testId = 'campaign-grid',
}: CampaignGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid={testId}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-discord-background-secondary rounded-lg p-4 animate-pulse h-40"
          />
        ))}
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <EmptyState
        icon="🏰"
        title="No campaigns yet"
        description="Create your first campaign to get started with FumbleBot"
        actionLabel="Create Campaign"
        onAction={onCreateClick}
        testId={`${testId}-empty`}
      />
    );
  }

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      data-testid={testId}
    >
      {campaigns.map((campaign) => (
        <CampaignCard
          key={campaign.id}
          campaign={campaign}
          onClick={() => onCampaignClick?.(campaign)}
          onLaunch={() => onLaunch?.(campaign)}
          testId={`${testId}-campaign-${campaign.id}`}
        />
      ))}
      <CreateCampaignCard
        onClick={onCreateClick}
        testId={`${testId}-create-card`}
      />
    </div>
  );
}
