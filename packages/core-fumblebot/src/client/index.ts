/**
 * @crit-fumble/core-fumblebot Client
 * HTTP client for Core server to communicate with FumbleBot
 */

import type {
  CommandContext,
  CommandResult,
  DiceRollRequest,
  DiceRollResult,
  AIChatRequest,
  AIChatResponse,
  AILookupRequest,
  AILookupResponse,
  AIGenerateNPCRequest,
  AIGenerateNPCResponse,
  AIGenerateDungeonRequest,
  AIGenerateEncounterRequest,
  AIGenerateImageRequest,
  AIGenerateImageResponse,
  VTTPlatform,
  VTTAccount,
  VTTGameLink,
  ActivitySession,
  ActivityType,
  VoiceSession,
  APIError,
  PaginatedResponse,
} from '../types/index.js';

// =============================================================================
// Client Configuration
// =============================================================================

export interface FumbleBotClientConfig {
  /** FumbleBot API base URL (e.g., https://fumblebot.crit-fumble.com/api) */
  baseUrl: string;
  /** API key for server-to-server authentication */
  apiKey: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Custom fetch implementation (for testing) */
  fetch?: typeof fetch;
}

export interface RequestOptions {
  /** Additional headers */
  headers?: Record<string, string>;
  /** Request timeout override */
  timeout?: number;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

// =============================================================================
// Client Implementation
// =============================================================================

export class FumbleBotClient {
  private readonly config: Required<Omit<FumbleBotClientConfig, 'fetch'>> & {
    fetch: typeof fetch;
  };

  constructor(config: FumbleBotClientConfig) {
    this.config = {
      baseUrl: config.baseUrl.replace(/\/$/, ''), // Remove trailing slash
      apiKey: config.apiKey,
      timeout: config.timeout ?? 30000,
      fetch: config.fetch ?? globalThis.fetch.bind(globalThis),
    };
  }

  // ---------------------------------------------------------------------------
  // HTTP Methods
  // ---------------------------------------------------------------------------

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    const timeout = options?.timeout ?? this.config.timeout;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await this.config.fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-Client': '@crit-fumble/core-fumblebot',
          ...options?.headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: options?.signal ?? controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          error: `HTTP ${response.status}: ${response.statusText}`,
        })) as APIError;
        throw new FumbleBotError(error.error, response.status, error.code, error.details);
      }

      return response.json() as Promise<T>;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof FumbleBotError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new FumbleBotError('Request timeout', 408, 'TIMEOUT');
      }
      throw new FumbleBotError(
        error instanceof Error ? error.message : 'Unknown error',
        0,
        'NETWORK_ERROR'
      );
    }
  }

  private get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  private post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', path, body, options);
  }

  private put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('PUT', path, body, options);
  }

  private delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', path, undefined, options);
  }

  // ---------------------------------------------------------------------------
  // Dice Rolling
  // ---------------------------------------------------------------------------

  /**
   * Execute a dice roll and record it
   */
  async roll(request: DiceRollRequest, options?: RequestOptions): Promise<DiceRollResult> {
    return this.post<DiceRollResult>('/dice/roll', request, options);
  }

  /**
   * Get roll history for a user or session
   */
  async getRollHistory(
    params: { userId?: string; sessionId?: string; limit?: number },
    options?: RequestOptions
  ): Promise<PaginatedResponse<DiceRollResult>> {
    const query = new URLSearchParams();
    if (params.userId) query.set('userId', params.userId);
    if (params.sessionId) query.set('sessionId', params.sessionId);
    if (params.limit) query.set('limit', params.limit.toString());
    return this.get<PaginatedResponse<DiceRollResult>>(`/dice/history?${query}`, options);
  }

  // ---------------------------------------------------------------------------
  // AI Assistant
  // ---------------------------------------------------------------------------

  /**
   * Send a chat message to the AI assistant
   */
  async chat(request: AIChatRequest, options?: RequestOptions): Promise<AIChatResponse> {
    return this.post<AIChatResponse>('/ai/chat', request, {
      ...options,
      timeout: options?.timeout ?? 60000, // AI requests may take longer
    });
  }

  /**
   * Lookup rules or lore
   */
  async lookup(request: AILookupRequest, options?: RequestOptions): Promise<AILookupResponse> {
    return this.post<AILookupResponse>('/ai/lookup', request, {
      ...options,
      timeout: options?.timeout ?? 45000,
    });
  }

  // ---------------------------------------------------------------------------
  // AI Generators
  // ---------------------------------------------------------------------------

  /**
   * Generate an NPC
   */
  async generateNPC(
    request: AIGenerateNPCRequest,
    options?: RequestOptions
  ): Promise<AIGenerateNPCResponse> {
    return this.post<AIGenerateNPCResponse>('/ai/generate/npc', request, {
      ...options,
      timeout: options?.timeout ?? 45000,
    });
  }

  /**
   * Generate a dungeon
   */
  async generateDungeon(
    request: AIGenerateDungeonRequest,
    options?: RequestOptions
  ): Promise<{ content: string; model: string }> {
    return this.post('/ai/generate/dungeon', request, {
      ...options,
      timeout: options?.timeout ?? 60000,
    });
  }

  /**
   * Generate an encounter
   */
  async generateEncounter(
    request: AIGenerateEncounterRequest,
    options?: RequestOptions
  ): Promise<{ content: string; model: string }> {
    return this.post('/ai/generate/encounter', request, {
      ...options,
      timeout: options?.timeout ?? 45000,
    });
  }

  /**
   * Generate an image
   */
  async generateImage(
    request: AIGenerateImageRequest,
    options?: RequestOptions
  ): Promise<AIGenerateImageResponse> {
    return this.post<AIGenerateImageResponse>('/ai/generate/image', request, {
      ...options,
      timeout: options?.timeout ?? 120000, // Image generation takes longer
    });
  }

  // ---------------------------------------------------------------------------
  // Commands
  // ---------------------------------------------------------------------------

  /**
   * Execute a FumbleBot command
   */
  async executeCommand(
    command: string,
    args: Record<string, unknown>,
    context: CommandContext,
    options?: RequestOptions
  ): Promise<CommandResult> {
    return this.post<CommandResult>('/commands/execute', { command, args, context }, options);
  }

  // ---------------------------------------------------------------------------
  // VTT Integration
  // ---------------------------------------------------------------------------

  /**
   * Link a VTT account to a user
   */
  async linkVTTAccount(
    userId: string,
    platform: VTTPlatform,
    platformUserId: string,
    platformUsername: string,
    options?: RequestOptions
  ): Promise<VTTAccount> {
    return this.post<VTTAccount>('/vtt/accounts/link', {
      userId,
      platform,
      platformUserId,
      platformUsername,
    }, options);
  }

  /**
   * Get linked VTT accounts for a user
   */
  async getVTTAccounts(userId: string, options?: RequestOptions): Promise<VTTAccount[]> {
    return this.get<VTTAccount[]>(`/vtt/accounts/${userId}`, options);
  }

  /**
   * Unlink a VTT account
   */
  async unlinkVTTAccount(accountId: string, options?: RequestOptions): Promise<void> {
    return this.delete(`/vtt/accounts/${accountId}`, options);
  }

  /**
   * Create a game link between VTT and Discord
   */
  async createGameLink(
    link: Omit<VTTGameLink, 'id' | 'createdAt'>,
    options?: RequestOptions
  ): Promise<VTTGameLink> {
    return this.post<VTTGameLink>('/vtt/links', link, options);
  }

  /**
   * Get game links for a guild
   */
  async getGameLinks(guildId: string, options?: RequestOptions): Promise<VTTGameLink[]> {
    return this.get<VTTGameLink[]>(`/vtt/links/guild/${guildId}`, options);
  }

  /**
   * Update a game link
   */
  async updateGameLink(
    linkId: string,
    updates: Partial<Pick<VTTGameLink, 'syncChat' | 'syncRolls'>>,
    options?: RequestOptions
  ): Promise<VTTGameLink> {
    return this.put<VTTGameLink>(`/vtt/links/${linkId}`, updates, options);
  }

  /**
   * Delete a game link
   */
  async deleteGameLink(linkId: string, options?: RequestOptions): Promise<void> {
    return this.delete(`/vtt/links/${linkId}`, options);
  }

  // ---------------------------------------------------------------------------
  // Activities
  // ---------------------------------------------------------------------------

  /**
   * Create an activity session
   */
  async createActivity(
    guildId: string,
    channelId: string,
    userId: string,
    activityType: ActivityType,
    options?: RequestOptions
  ): Promise<ActivitySession> {
    return this.post<ActivitySession>('/activities', {
      guildId,
      channelId,
      userId,
      activityType,
    }, options);
  }

  /**
   * Get an activity session
   */
  async getActivity(sessionId: string, options?: RequestOptions): Promise<ActivitySession | null> {
    return this.get<ActivitySession | null>(`/activities/${sessionId}`, options);
  }

  /**
   * Update activity state
   */
  async updateActivityState(
    sessionId: string,
    state: unknown,
    options?: RequestOptions
  ): Promise<ActivitySession> {
    return this.put<ActivitySession>(`/activities/${sessionId}/state`, { state }, options);
  }

  /**
   * End an activity session
   */
  async endActivity(sessionId: string, options?: RequestOptions): Promise<void> {
    return this.delete(`/activities/${sessionId}`, options);
  }

  // ---------------------------------------------------------------------------
  // Voice Sessions
  // ---------------------------------------------------------------------------

  /**
   * Start a voice session
   */
  async startVoiceSession(
    guildId: string,
    channelId: string,
    userId: string,
    options?: RequestOptions
  ): Promise<VoiceSession> {
    return this.post<VoiceSession>('/voice/sessions', {
      guildId,
      channelId,
      userId,
    }, options);
  }

  /**
   * Get active voice session
   */
  async getVoiceSession(
    guildId: string,
    channelId: string,
    options?: RequestOptions
  ): Promise<VoiceSession | null> {
    return this.get<VoiceSession | null>(`/voice/sessions/${guildId}/${channelId}`, options);
  }

  /**
   * End a voice session
   */
  async endVoiceSession(sessionId: string, options?: RequestOptions): Promise<void> {
    return this.delete(`/voice/sessions/${sessionId}`, options);
  }

  // ---------------------------------------------------------------------------
  // Health & Status
  // ---------------------------------------------------------------------------

  /**
   * Check FumbleBot API health
   */
  async health(options?: RequestOptions): Promise<{ status: string; version: string }> {
    return this.get<{ status: string; version: string }>('/health', options);
  }
}

// =============================================================================
// Error Class
// =============================================================================

export class FumbleBotError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'FumbleBotError';
  }

  /** Check if error is a network/connection error */
  isNetworkError(): boolean {
    return this.code === 'NETWORK_ERROR' || this.code === 'TIMEOUT';
  }

  /** Check if error is an authentication error */
  isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }

  /** Check if error is a rate limit error */
  isRateLimitError(): boolean {
    return this.status === 429;
  }

  /** Check if error is a validation error */
  isValidationError(): boolean {
    return this.status === 400;
  }

  /** Check if error is a not found error */
  isNotFoundError(): boolean {
    return this.status === 404;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a FumbleBot client instance
 *
 * @example
 * ```typescript
 * import { createFumbleBotClient } from '@crit-fumble/core-fumblebot/client';
 *
 * const fumblebot = createFumbleBotClient({
 *   baseUrl: process.env.FUMBLEBOT_API_URL,
 *   apiKey: process.env.FUMBLEBOT_API_KEY,
 * });
 *
 * // Execute a dice roll
 * const result = await fumblebot.roll({
 *   notation: '2d20kh1+5',
 *   label: 'Attack Roll',
 * });
 * ```
 */
export function createFumbleBotClient(config: FumbleBotClientConfig): FumbleBotClient {
  return new FumbleBotClient(config);
}
