/**
 * Platform Server Routes
 * Centralized route definitions for the multi-platform server
 *
 * Route categories:
 * - API routes: /api/* - JSON endpoints for data exchange
 * - Auth routes: /auth/* - OAuth2 authentication flows
 * - Platform routes: /, /discord, /web - Platform-specific UIs
 * - Activity routes: /discord/activity/* - Legacy/specific activity endpoints
 */

/**
 * Route definition
 */
export interface RouteDefinition {
  method: 'get' | 'post' | 'put' | 'delete';
  path: string;
  handler: string; // Method name on PlatformServer
  description?: string;
}

/**
 * All routes organized by category
 */
export const routes: Record<string, RouteDefinition[]> = {
  // Health & Status
  system: [
    {
      method: 'get',
      path: '/health',
      handler: 'handleHealth',
      description: 'Health check endpoint',
    },
    {
      method: 'get',
      path: '/health/detailed',
      handler: 'handleHealthDetailed',
      description: 'Detailed health check with DB and Core status',
    },
  ],

  // Authentication
  auth: [
    {
      method: 'post',
      path: '/api/token',
      handler: 'handleTokenExchange',
      description: 'OAuth2 token exchange for Discord Activity SDK',
    },
    {
      method: 'get',
      path: '/auth/callback',
      handler: 'handleOAuthCallback',
      description: 'OAuth2 callback for web-based authentication',
    },
    {
      method: 'get',
      path: '/api/auth/me',
      handler: 'handleGetAuthUser',
      description: 'Get current authenticated user',
    },
    {
      method: 'post',
      path: '/api/auth/logout',
      handler: 'handleLogout',
      description: 'Logout and destroy session',
    },
    {
      method: 'get',
      path: '/api/auth/guilds',
      handler: 'handleGetUserGuilds',
      description: 'Get user Discord guilds (use ?botOnly=true to filter)',
    },
    {
      method: 'get',
      path: '/api/auth/activities',
      handler: 'handleGetUserActivities',
      description: 'Get user active activities (campaigns with active sessions)',
    },
  ],

  // Note: All UI routes (/, /activity/*, /discord/activity/*) are handled by core proxy
  // configured in middleware.ts. The proxy forwards to core.crit-fumble.com for:
  // - /api/core/* - Core API endpoints
  // - /activity/* - React activity UI
  // - /wiki/* - Wiki content

  // Session management API
  sessions: [
    {
      method: 'post',
      path: '/discord/activity/api/session',
      handler: 'handleSessionCreate',
      description: 'Create a new session',
    },
    {
      method: 'get',
      path: '/discord/activity/api/session/:sessionId',
      handler: 'handleSessionGet',
      description: 'Get session by ID',
    },
  ],

  // Chat API (website → FumbleBot)
  chat: [
    {
      method: 'post',
      path: '/api/chat',
      handler: 'handleChat',
      description: 'Process chat message from website (requires bot secret)',
    },
    {
      method: 'get',
      path: '/api/chat/history',
      handler: 'handleChatHistory',
      description: 'Get chat history for user (requires bot secret)',
    },
  ],

  // Cross-platform commands API
  commands: [
    {
      method: 'get',
      path: '/api/commands',
      handler: 'handleListCommands',
      description: 'List all available commands',
    },
    {
      method: 'post',
      path: '/api/commands',
      handler: 'handleExecuteCommandString',
      description: 'Execute command from string input',
    },
    {
      method: 'post',
      path: '/api/commands/:command',
      handler: 'handleExecuteCommand',
      description: 'Execute a specific command',
    },
  ],

  // Admin Dashboard API (requires guild admin auth)
  admin: [
    {
      method: 'get',
      path: '/api/admin/guilds/:guildId/metrics',
      handler: 'handleGetGuildMetrics',
      description: 'Get server metrics and statistics',
    },
    {
      method: 'get',
      path: '/api/admin/guilds/:guildId/settings',
      handler: 'handleGetGuildSettings',
      description: 'Get guild settings',
    },
    {
      method: 'post',
      path: '/api/admin/guilds/:guildId/settings',
      handler: 'handleUpdateGuildSettings',
      description: 'Update guild settings',
    },
    {
      method: 'get',
      path: '/api/admin/guilds/:guildId/activity',
      handler: 'handleGetGuildActivity',
      description: 'Get recent activity timeline',
    },
  ],

  // Prompt Partials API (channel/category/role-specific AI prompts)
  prompts: [
    {
      method: 'get',
      path: '/api/admin/guilds/:guildId/prompts',
      handler: 'handleListPromptPartials',
      description: 'List all prompt partials for a guild',
    },
    {
      method: 'get',
      path: '/api/admin/guilds/:guildId/prompts/for-context',
      handler: 'handleGetPromptsForContext',
      description: 'Get applicable prompts for a specific context',
    },
    {
      method: 'get',
      path: '/api/admin/guilds/:guildId/prompts/:id',
      handler: 'handleGetPromptPartial',
      description: 'Get a specific prompt partial',
    },
    {
      method: 'post',
      path: '/api/admin/guilds/:guildId/prompts',
      handler: 'handleCreatePromptPartial',
      description: 'Create a new prompt partial',
    },
    {
      method: 'post',
      path: '/api/admin/guilds/:guildId/prompts/:id',
      handler: 'handleUpdatePromptPartial',
      description: 'Update a prompt partial',
    },
    {
      method: 'delete',
      path: '/api/admin/guilds/:guildId/prompts/:id',
      handler: 'handleDeletePromptPartial',
      description: 'Delete a prompt partial',
    },
  ],

  // Channel KB Sources API (Discord channels as knowledge base)
  channelKB: [
    {
      method: 'get',
      path: '/api/admin/guilds/:guildId/channel-kb',
      handler: 'handleListChannelKBSources',
      description: 'List all channel KB sources for a guild',
    },
    {
      method: 'get',
      path: '/api/admin/guilds/:guildId/channel-kb/:id',
      handler: 'handleGetChannelKBSource',
      description: 'Get a specific channel KB source',
    },
    {
      method: 'post',
      path: '/api/admin/guilds/:guildId/channel-kb',
      handler: 'handleCreateChannelKBSource',
      description: 'Create a new channel KB source',
    },
    {
      method: 'post',
      path: '/api/admin/guilds/:guildId/channel-kb/:id',
      handler: 'handleUpdateChannelKBSource',
      description: 'Update a channel KB source',
    },
    {
      method: 'delete',
      path: '/api/admin/guilds/:guildId/channel-kb/:id',
      handler: 'handleDeleteChannelKBSource',
      description: 'Delete a channel KB source',
    },
    {
      method: 'post',
      path: '/api/admin/guilds/:guildId/channel-kb/:id/sync',
      handler: 'handleSyncChannelKBSource',
      description: 'Trigger sync for a channel KB source',
    },
    {
      method: 'get',
      path: '/api/admin/guilds/:guildId/channels',
      handler: 'handleListGuildChannels',
      description: 'List available Discord channels for KB configuration',
    },
  ],

  // AI API (for Core and external services)
  ai: [
    {
      method: 'get',
      path: '/api/ai/health',
      handler: 'handleAIHealth',
      description: 'Check AI service availability',
    },
    {
      method: 'post',
      path: '/api/ai/chat',
      handler: 'handleAIChat',
      description: 'General chat completion (Claude Sonnet)',
    },
    {
      method: 'post',
      path: '/api/ai/complete',
      handler: 'handleAIComplete',
      description: 'Low-level completion with provider choice',
    },
    {
      method: 'post',
      path: '/api/ai/lookup',
      handler: 'handleAILookup',
      description: 'Fast lookup (Claude Haiku) for rules/concepts',
    },
    {
      method: 'post',
      path: '/api/ai/dm',
      handler: 'handleAIDMResponse',
      description: 'Generate DM narration for a scenario',
    },
    {
      method: 'post',
      path: '/api/ai/creature-behavior',
      handler: 'handleAICreatureBehavior',
      description: 'Fast AI decision for creature/NPC behavior',
    },
    {
      method: 'post',
      path: '/api/ai/generate/npc',
      handler: 'handleAIGenerateNPC',
      description: 'Generate NPC description',
    },
    {
      method: 'post',
      path: '/api/ai/generate/dungeon',
      handler: 'handleAIGenerateDungeon',
      description: 'Generate dungeon with structured data (GPT-4o)',
    },
    {
      method: 'post',
      path: '/api/ai/generate/encounter',
      handler: 'handleAIGenerateEncounter',
      description: 'Generate encounter with structured data (GPT-4o)',
    },
    {
      method: 'post',
      path: '/api/ai/generate/image',
      handler: 'handleAIGenerateImage',
      description: 'Generate image (DALL-E 3)',
    },
  ],

  // Voice API (for Discord voice channel control via API)
  voice: [
    {
      method: 'get',
      path: '/api/voice/status',
      handler: 'handleVoiceStatus',
      description: 'Get voice connection status for a guild',
    },
    {
      method: 'get',
      path: '/api/voice/sessions',
      handler: 'handleVoiceSessions',
      description: 'Get all active voice sessions',
    },
    {
      method: 'post',
      path: '/api/voice/join',
      handler: 'handleVoiceJoin',
      description: 'Join a voice channel',
    },
    {
      method: 'post',
      path: '/api/voice/leave',
      handler: 'handleVoiceLeave',
      description: 'Leave a voice channel',
    },
    {
      method: 'post',
      path: '/api/voice/play',
      handler: 'handleVoicePlay',
      description: 'Play audio from URL',
    },
    {
      method: 'post',
      path: '/api/voice/stop',
      handler: 'handleVoiceStop',
      description: 'Stop audio playback',
    },
    {
      method: 'post',
      path: '/api/voice/listen/start',
      handler: 'handleVoiceListenStart',
      description: 'Start voice transcription/assistant (with mode: transcribe|assistant)',
    },
    {
      method: 'post',
      path: '/api/voice/listen/stop',
      handler: 'handleVoiceListenStop',
      description: 'Stop voice transcription/assistant',
    },
    {
      method: 'get',
      path: '/api/voice/transcript/:guildId',
      handler: 'handleVoiceTranscript',
      description: 'Get transcript for an active session',
    },
    {
      method: 'post',
      path: '/api/voice/mode',
      handler: 'handleVoiceMode',
      description: 'Change voice mode (transcribe -> assistant)',
    },
  ],
};

/**
 * Get all routes as a flat array
 */
export function getAllRoutes(): RouteDefinition[] {
  return Object.values(routes).flat();
}

/**
 * Get routes by category
 */
export function getRoutesByCategory(category: keyof typeof routes): RouteDefinition[] {
  return routes[category] || [];
}

/**
 * Print route table (for debugging/documentation)
 */
export function printRouteTable(): void {
  console.log('\n=== Platform Server Routes ===\n');

  for (const [category, categoryRoutes] of Object.entries(routes)) {
    console.log(`${category.toUpperCase()}:`);
    for (const route of categoryRoutes) {
      const method = route.method.toUpperCase().padEnd(6);
      const path = route.path.padEnd(45);
      console.log(`  ${method} ${path} ${route.description || ''}`);
    }
    console.log('');
  }
}
