import { useState, useEffect } from 'react';
import { MainLayout } from '@crit-fumble/react';
import { DashboardHeader, CampaignGrid, CreateCampaignModal, ChatPanel } from '../organisms';
import type { Campaign, FoundrySystem } from '@/types';

export interface AdminDashboardPageProps {
  username: string;
  userId: string;
  guildId: string | null;
  onShowSettings?: () => void;
  onShowActivityHub?: () => void;
  testId?: string;
}

export function AdminDashboardPage({
  username,
  userId,
  guildId,
  onShowSettings,
  onShowActivityHub,
  testId = 'admin-dashboard-page',
}: AdminDashboardPageProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [systems, setSystems] = useState<FoundrySystem[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        // Load systems
        const systemsResponse = await fetch('/.proxy/api/systems');
        if (systemsResponse.ok) {
          const data = await systemsResponse.json();
          setSystems(data.systems || []);
        }

        // Load campaigns
        if (guildId) {
          const campaignsResponse = await fetch(`/.proxy/api/campaigns?guildId=${guildId}`);
          if (campaignsResponse.ok) {
            const data = await campaignsResponse.json();
            setCampaigns(data.campaigns || []);
          }
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [guildId]);

  const handleCreateCampaign = async (name: string, systemId: string, description: string) => {
    setIsSubmitting(true);
    try {
      const system = systems.find((s) => s.id === systemId);
      const now = new Date();
      const newCampaign: Campaign = {
        id: crypto.randomUUID(),
        name,
        foundrySystemId: systemId,
        systemTitle: system?.title || systemId,
        description: description || null,
        guildId: guildId || '',
        status: 'active',
        members: {},
        roleMappings: {},
        containerId: null,
        containerPort: null,
        containerStatus: 'stopped',
        lastActiveAt: null,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      };

      // TODO: API call to create campaign
      setCampaigns((prev) => [...prev, newCampaign]);
      setIsCreateModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLaunchCampaign = (campaign: Campaign) => {
    console.log('Launching campaign:', campaign.id);
    // TODO: Implement campaign launch
  };

  return (
    <MainLayout
      header={
        <h1 className="text-2xl font-bold text-discord-text-normal">FumbleBot</h1>
      }
      testId={testId}
    >
      <div className="p-4" data-testid={`${testId}-content`}>
        <DashboardHeader
          title="Campaign Dashboard"
          username={username}
          userRole="admin"
          onActivityHub={onShowActivityHub}
          onSettings={onShowSettings}
          onChat={() => setIsChatOpen(true)}
          testId={`${testId}-header`}
        />

        <section data-testid={`${testId}-campaigns-section`}>
          <h3 className="text-lg font-medium text-discord-text-muted mb-4">
            Your Campaigns
          </h3>
          <CampaignGrid
            campaigns={campaigns}
            onLaunch={handleLaunchCampaign}
            onCreateClick={() => setIsCreateModalOpen(true)}
            isLoading={isLoading}
            testId={`${testId}-campaign-grid`}
          />
        </section>

        <CreateCampaignModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={handleCreateCampaign}
          systems={systems}
          isSubmitting={isSubmitting}
          testId={`${testId}-create-modal`}
        />

        <ChatPanel
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          userId={userId}
          username={username}
          testId={`${testId}-chat-panel`}
        />
      </div>
    </MainLayout>
  );
}
